import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import type { Document } from 'linkedom';
import {
  CSSStyleRule,
  CSSContainerRule,
  CSSGroupingRule,
  CSSNestedDeclarations,
  type CSSRule,
  type CSSStyleDeclaration as CssomnomStyleDeclaration,
} from 'cssomnom';

const targetFiles: string[] = getTargetFiles(
  // @ts-ignore - package.json omits "type": "module" in this target
  import.meta.url,
);

function getCardElements(document: Document): any[] {
  const byClass = Array.from(document.querySelectorAll('.card'));
  if (byClass.length > 0) return byClass;
  return Array.from(document.querySelectorAll('article'));
}

interface FlattenedStyleEntry {
  selector: string;
  style: CssomnomStyleDeclaration;
  inContainer: boolean;
  containerCondition: string;
}

function flattenCssRules(
  rules: Iterable<CSSRule>,
  parentSelector = '',
  inContainer = false,
  containerCondition = '',
): FlattenedStyleEntry[] {
  const entries: FlattenedStyleEntry[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      const resolvedSelector = parentSelector
        ? rule.selectorText
            .split(',')
            .map((s) => {
              const trimmed = s.trim();
              return trimmed.includes('&')
                ? trimmed.replace(/&/g, parentSelector)
                : `${parentSelector} ${trimmed}`;
            })
            .join(', ')
        : rule.selectorText;
      if (rule.style.length > 0) {
        entries.push({
          selector: resolvedSelector,
          style: rule.style,
          inContainer,
          containerCondition,
        });
      }
      if (rule.cssRules && rule.cssRules.length > 0) {
        entries.push(
          ...flattenCssRules(rule.cssRules, resolvedSelector, inContainer, containerCondition),
        );
      }
    } else if (rule instanceof CSSNestedDeclarations) {
      if (rule.style.length > 0) {
        entries.push({
          selector: parentSelector,
          style: rule.style,
          inContainer,
          containerCondition,
        });
      }
    } else if (rule instanceof CSSContainerRule) {
      const cond = containerCondition
        ? `${containerCondition} and ${rule.conditionText}`
        : rule.conditionText;
      entries.push(...flattenCssRules(rule.cssRules, parentSelector, true, cond));
    } else if (rule instanceof CSSGroupingRule) {
      entries.push(
        ...flattenCssRules(rule.cssRules, parentSelector, inContainer, containerCondition),
      );
    }
  }
  return entries;
}

test.describe('card Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The card root is an <article>; a single link may wrap it only if the card contains no other interactive elements', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => getCardElements(d.document));
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      expect(card.tagName.toLowerCase()).toBe('article');
      const wrappingLink = card.closest('a');
      if (wrappingLink) {
        const innerInteractive = card.querySelectorAll('a, button, input, select, textarea');
        expect(innerInteractive.length).toBe(0);
      }
    }
  });

  test("A card's regions (media, heading or header, content, footer) are direct children of the card, with single elements unwrapped", () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => getCardElements(d.document));
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      const children = Array.from(card.children) as any[];
      expect(children.length).toBeGreaterThanOrEqual(2);

      // Media and heading must be direct children of the card, not trapped inside a .card__body wrapper
      const hasDirectMedia = children.some((c) =>
        ['img', 'picture', 'video', 'svg'].includes(c.tagName.toLowerCase()),
      );
      expect(hasDirectMedia).toBe(true);

      const hasDirectHeader = children.some((c) =>
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup', 'header'].includes(c.tagName.toLowerCase()),
      );
      expect(hasDirectHeader).toBe(true);

      for (const child of children) {
        const tag = child.tagName.toLowerCase();
        if (['hgroup', 'header', 'div'].includes(tag)) {
          // A wrapper appears only around multiple elements
          expect(child.children.length).toBeGreaterThan(1);
        }
      }
    }
  });

  test("A card's descendants adapt with @container rules, and the size container is the card itself, not the grid or list parent", () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const entries = flattenCssRules(stylesheet.cssRules);
    expect(entries.length).toBeGreaterThan(0);

    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => getCardElements(d.document));
    expect(cards.length).toBeGreaterThan(0);

    const cardAncestors = new Set<any>();
    for (const card of cards) {
      for (let p = card.parentElement; p; p = p.parentElement) cardAncestors.add(p);
    }

    const matchesAny = (selectorText: string, elements: Iterable<any>) => {
      const parts = selectorText.split(',').map((s) => s.trim()).filter(Boolean);
      for (const el of elements) {
        for (const part of parts) {
          try {
            if (el.matches(part)) return true;
          } catch {
            const stripped = part.replace(/::?[\w-]+(\([^)]*\))?/g, '').trim();
            try {
              if (stripped && el.matches(stripped)) return true;
            } catch {
              // ignore selectors the DOM parser cannot evaluate
            }
          }
        }
      }
      return false;
    };

    const sizeContainerRules = entries.filter((e) =>
      /\b(inline-size|size)\b/i.test(
        e.style.getPropertyValue('container-type') || e.style.getPropertyValue('container'),
      ),
    );

    const cardIsContainer = sizeContainerRules.some((e) => matchesAny(e.selector, cards));
    expect(cardIsContainer).toBe(true);

    const gridParentIsContainer = sizeContainerRules.some((e) =>
      matchesAny(e.selector, cardAncestors),
    );
    expect(gridParentIsContainer).toBe(false);

    const hasContainerAdaptation = entries.some((e) => e.inContainer);
    expect(hasContainerAdaptation).toBe(true);
  });

  test('Card media elements (<img> or <video>) set aspect-ratio and object-fit directly on the media element itself rather than on a wrapper', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => getCardElements(d.document));
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      const media = card.querySelector('img, video');
      expect(media).not.toBeNull();
      const region = media.parentElement?.tagName.toLowerCase() === 'picture' ? media.parentElement : media;
      expect(region.parentElement).toBe(card);
    }

    const stylesheet = getCssStyleSheet(targetFiles);
    const entries = flattenCssRules(stylesheet.cssRules);

    const hasAspectRatioOnMedia = entries.some(
      (e) =>
        /\b(img|video)\b/i.test(e.selector) && Boolean(e.style.getPropertyValue('aspect-ratio')),
    );
    const hasObjectFitOnMedia = entries.some(
      (e) =>
        /\b(img|video)\b/i.test(e.selector) && Boolean(e.style.getPropertyValue('object-fit')),
    );
    expect(hasAspectRatioOnMedia).toBe(true);
    expect(hasObjectFitOnMedia).toBe(true);
  });

  test('Informative card images have a non-empty alt attribute', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => getCardElements(d.document));
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      const imgs = Array.from(card.querySelectorAll('img')) as any[];
      expect(imgs.length).toBeGreaterThan(0);
      for (const img of imgs) {
        const alt = img.getAttribute('alt');
        expect(alt).toBeTruthy();
        expect(alt.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('When a content card has a primary destination and secondary actions, its heading contains the primary <a> link, secondary actions remain separate native controls outside the link, at most one link in the card is a stretched link, and any secondary footer link to the same href provides a distinct descriptive accessible name', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => getCardElements(d.document));
    expect(cards.length).toBeGreaterThan(0);

    const stylesheet = getCssStyleSheet(targetFiles);
    const entries = flattenCssRules(stylesheet.cssRules);
    const stretchedLinkClasses = new Set<string>(['card-link']);
    for (const e of entries) {
      if (
        e.selector.includes('::after') &&
        e.style.getPropertyValue('position') === 'absolute' &&
        (e.style.getPropertyValue('inset') === '0' ||
          e.style.getPropertyValue('inset') === '0px' ||
          e.style.getPropertyValue('top') === '0' ||
          e.style.getPropertyValue('top') === '0px')
      ) {
        const classMatches = e.selector.match(/\.([a-zA-Z0-9_-]+)/g) || [];
        for (const m of classMatches) {
          const cls = m.slice(1);
          if (cls !== 'card') stretchedLinkClasses.add(cls);
        }
      }
    }

    for (const card of cards) {
      const buttons = Array.from(card.querySelectorAll('button')) as any[];
      expect(buttons.length).toBeGreaterThan(0);

      // Secondary actions must remain outside any <a> link
      for (const ctrl of Array.from(card.querySelectorAll('button, input, select, textarea')) as any[]) {
        expect(ctrl.closest('a')).toBeNull();
      }

      const links = Array.from(card.querySelectorAll('a[href]')) as any[];
      expect(links.length).toBeGreaterThan(0);

      // Check stretched links in card
      const stretchedLinks = links.filter((a) =>
        Array.from(a.classList || []).some((c: any) => stretchedLinkClasses.has(String(c))),
      );
      expect(stretchedLinks.length).toBeLessThanOrEqual(1);
      if (stretchedLinks.length === 1) {
        const inHeading = Boolean(stretchedLinks[0].closest('h1, h2, h3, h4, h5, h6'));
        expect(inHeading).toBe(true);
      }

      // Check duplicate hrefs: if a card has both a heading link and a footer "read more / view details" link with the same href,
      // the secondary link must include descriptive accessible text (e.g., sr-only / visually-hidden span) and not be a stretched link
      const hrefGroups = new Map<string, any[]>();
      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) continue;
        const list = hrefGroups.get(href) || [];
        list.push(link);
        hrefGroups.set(href, list);
      }

      for (const [, sameHrefLinks] of hrefGroups) {
        expect(sameHrefLinks.length).toBeLessThanOrEqual(2);
        if (sameHrefLinks.length === 2) {
          const [first, second] = sameHrefLinks;
          expect(Boolean(first.closest('h1, h2, h3, h4, h5, h6'))).toBe(true);
          expect(Boolean(second.closest('footer'))).toBe(true);
          // Accessible name of second link must be distinct / descriptive (contains hidden drink name or aria-label)
          const firstName = (first.getAttribute('aria-label') || first.textContent || '').trim();
          const secondName = (second.getAttribute('aria-label') || second.textContent || '').trim();
          expect(secondName.toLowerCase()).not.toBe(firstName.toLowerCase());
          expect(secondName.toLowerCase()).toContain(firstName.toLowerCase());
        }
      }
    }
  });

  test('Choice controls inside a card use either native radio buttons or checkboxes with associated labels, or a native <select> with <option> elements', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const cards = docs.flatMap((d) => getCardElements(d.document));
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      const radiosOrCheckboxes = Array.from(
        card.querySelectorAll('input[type="radio"], input[type="checkbox"]'),
      ) as any[];
      const selects = Array.from(card.querySelectorAll('select')) as any[];

      expect(radiosOrCheckboxes.length + selects.length).toBeGreaterThan(0);

      if (radiosOrCheckboxes.length > 0) {
        expect(radiosOrCheckboxes.length).toBeGreaterThanOrEqual(3);
        for (const input of radiosOrCheckboxes) {
          const id = input.getAttribute('id');
          const hasWrappingLabel = Boolean(input.closest('label'));
          const hasForLabel = Boolean(id && card.querySelector(`label[for="${id}"]`));
          expect(hasWrappingLabel || hasForLabel).toBe(true);
        }
      }

      if (selects.length > 0) {
        for (const select of selects) {
          const options = Array.from(select.querySelectorAll('option')) as any[];
          expect(options.length).toBeGreaterThanOrEqual(3);
          const id = select.getAttribute('id');
          const hasWrappingLabel = Boolean(select.closest('label'));
          const hasForLabel = Boolean(id && card.querySelector(`label[for="${id}"]`));
          const hasAriaLabel = Boolean(
            select.getAttribute('aria-label') || select.getAttribute('aria-labelledby'),
          );
          expect(hasWrappingLabel || hasForLabel || hasAriaLabel).toBe(true);
        }
      }
    }
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('A card with media stacks its media above its text content in a single column when its container is narrow, regardless of viewport width', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const cards = page.locator('article.card, main article');
      await expect(cards.first()).toBeVisible();

      const layout = await cards.first().evaluate((card) => {
        const htmlCard = card as HTMLElement;
        const prevWidth = htmlCard.style.width;
        const prevMaxWidth = htmlCard.style.maxWidth;
        htmlCard.style.width = '260px';
        htmlCard.style.maxWidth = '260px';

        const media = htmlCard.querySelector('img, picture, video, svg') as HTMLElement | null;
        const heading = htmlCard.querySelector(
          'h1, h2, h3, h4, h5, h6, hgroup, header',
        ) as HTMLElement | null;

        const mediaRect = media?.getBoundingClientRect();
        const headingRect = heading?.getBoundingClientRect();

        htmlCard.style.width = prevWidth;
        htmlCard.style.maxWidth = prevMaxWidth;

        return {
          hasMedia: Boolean(mediaRect),
          hasHeading: Boolean(headingRect),
          mediaBottom: mediaRect?.bottom ?? 0,
          mediaLeft: mediaRect?.left ?? 0,
          headingTop: headingRect?.top ?? 0,
          headingLeft: headingRect?.left ?? 0,
        };
      });

      expect(layout.hasMedia).toBe(true);
      expect(layout.hasHeading).toBe(true);
      expect(layout.headingTop).toBeGreaterThanOrEqual(layout.mediaBottom - 2);
    });

    test('A card with media places its media in a side column beside its text content when its container is wide', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const cards = page.locator('article.card, main article');
      await expect(cards.first()).toBeVisible();

      const layout = await cards.first().evaluate((card) => {
        const htmlCard = card as HTMLElement;
        const parent = htmlCard.parentElement;
        const prevGridCols = parent?.style.gridTemplateColumns ?? '';
        const prevWidth = htmlCard.style.width;
        if (parent) parent.style.gridTemplateColumns = '1fr';
        htmlCard.style.width = '640px';

        const media = htmlCard.querySelector('img, picture, video, svg') as HTMLElement | null;
        const heading = htmlCard.querySelector(
          'h1, h2, h3, h4, h5, h6, hgroup, header',
        ) as HTMLElement | null;
        const cardChildren = Array.from(htmlCard.children) as HTMLElement[];
        const nonMediaChildren = cardChildren.filter((c) => c !== media);

        const mediaRect = media?.getBoundingClientRect();
        const headingRect = heading?.getBoundingClientRect();
        const nonMediaRects = nonMediaChildren.map((c) => c.getBoundingClientRect());
        const textBlockTop =
          nonMediaRects.length > 0 ? Math.min(...nonMediaRects.map((r) => r.top)) : 0;
        const textBlockBottom =
          nonMediaRects.length > 0 ? Math.max(...nonMediaRects.map((r) => r.bottom)) : 0;
        const allNonMediaInRightCol = mediaRect
          ? nonMediaRects.every((r) => r.left >= mediaRect.right - 2)
          : false;

        if (parent) parent.style.gridTemplateColumns = prevGridCols;
        htmlCard.style.width = prevWidth;

        return {
          hasMedia: Boolean(mediaRect),
          hasHeading: Boolean(headingRect),
          mediaRight: mediaRect?.right ?? 0,
          mediaTop: mediaRect?.top ?? 0,
          mediaBottom: mediaRect?.bottom ?? 0,
          headingLeft: headingRect?.left ?? 0,
          headingTop: headingRect?.top ?? 0,
          textBlockTop,
          textBlockBottom,
          allNonMediaInRightCol,
        };
      });

      expect(layout.hasMedia).toBe(true);
      expect(layout.hasHeading).toBe(true);
      expect(layout.headingLeft).toBeGreaterThanOrEqual(layout.mediaRight - 2);
      expect(layout.allNonMediaInRightCol).toBe(true);
      expect(layout.mediaTop).toBeLessThan(layout.textBlockBottom);
    });

    test('Side-column media layout rules apply only to cards that contain media (such as via :has()), so a card without media renders in a single-column layout at both narrow and wide container widths with no empty media column', async ({
      page,
    }) => {
      const stylesheet = getCssStyleSheet(targetFiles);
      const entries = flattenCssRules(stylesheet.cssRules);
      expect(entries.length).toBeGreaterThan(0);

      const hasMediaScopedContainerRules = entries.some(
        (e) =>
          e.inContainer &&
          e.selector.includes(':has(') &&
          /\b(img|picture|video|svg|media)\b/i.test(e.selector),
      );
      expect(hasMediaScopedContainerRules).toBe(true);

      await page.setViewportSize({ width: 1280, height: 800 });
      const cards = page.locator('article.card, main article');
      await expect(cards.first()).toBeVisible();

      const noMediaCheck = await cards.first().evaluate((card) => {
        const clone = card.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll('img, picture, video, svg, .media')
          .forEach((el) => el.remove());
        card.parentElement?.appendChild(clone);

        const parent = clone.parentElement;
        const prevGridCols = parent?.style.gridTemplateColumns ?? '';
        if (parent) parent.style.gridTemplateColumns = '1fr';

        const measureAtWidth = (widthPx: string) => {
          clone.style.width = widthPx;
          const style = window.getComputedStyle(clone);
          const padLeft = parseFloat(style.paddingLeft) || 0;
          const borderLeft = parseFloat(style.borderLeftWidth) || 0;
          const contentLeft = clone.getBoundingClientRect().left + borderLeft + padLeft;

          const children = Array.from(clone.children) as HTMLElement[];
          const childRects = children.map((c) => c.getBoundingClientRect());
          return {
            contentLeft,
            firstChildLeft: childRects[0]?.left ?? 0,
            isStackedVertically: childRects.every(
              (r, i) => i === 0 || r.top >= childRects[i - 1].bottom - 2,
            ),
          };
        };

        const narrow = measureAtWidth('260px');
        const wide = measureAtWidth('640px');

        if (parent) parent.style.gridTemplateColumns = prevGridCols;
        clone.remove();

        return { narrow, wide };
      });

      // No empty left media column at narrow or wide width: children start at the left content edge and stack vertically
      expect(noMediaCheck.narrow.firstChildLeft - noMediaCheck.narrow.contentLeft).toBeLessThan(20);
      expect(noMediaCheck.narrow.isStackedVertically).toBe(true);
      expect(noMediaCheck.wide.firstChildLeft - noMediaCheck.wide.contentLeft).toBeLessThan(20);
      expect(noMediaCheck.wide.isStackedVertically).toBe(true);
    });

    test('Hovering, focusing, or selecting a card does not change its layout box (no change to border-width, padding, font-weight, or size)', async ({
      page,
    }) => {
      const cards = page.locator('article.card, main article');
      await expect(cards.first()).toBeVisible();

      const getBoxMetrics = async () =>
        cards.first().evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          return {
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
            borderTopWidth: cs.borderTopWidth,
            borderRightWidth: cs.borderRightWidth,
            borderBottomWidth: cs.borderBottomWidth,
            borderLeftWidth: cs.borderLeftWidth,
            paddingTop: cs.paddingTop,
            paddingRight: cs.paddingRight,
            paddingBottom: cs.paddingBottom,
            paddingLeft: cs.paddingLeft,
            fontWeight: cs.fontWeight,
          };
        });

      const initialMetrics = await getBoxMetrics();

      // Hover card and primary link
      await cards.first().hover();
      const hoverMetrics = await getBoxMetrics();
      expect(hoverMetrics).toEqual(initialMetrics);

      // Focus interactive control inside card
      const firstControl = cards.first().locator('a, button, input, select').first();
      await firstControl.focus();
      const focusMetrics = await getBoxMetrics();
      expect(focusMetrics).toEqual(initialMetrics);

      // Select a different size option (radio or select)
      const radios = cards.first().locator('input[type="radio"]');
      const selects = cards.first().locator('select');
      if ((await radios.count()) > 0) {
        await radios.first().check({ force: true });
      } else if ((await selects.count()) > 0) {
        await selects.first().selectOption({ index: 0 });
      }
      const selectedMetrics = await getBoxMetrics();
      expect(selectedMetrics).toEqual(initialMetrics);
    });

    test('Focusing a control inside a card shows a visible focus indicator on that control; only a stretched primary link delegates its indicator to the card', async ({
      page,
    }) => {
      const cards = page.locator('article.card, main article');
      await expect(cards.first()).toBeVisible();

      // Ensure nothing inside the card starts focused, and set keyboard modality for :focus-visible
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
      await page.keyboard.press('Shift');

      const button = cards.first().locator('button').first();
      const readButtonIndicators = () =>
        button.evaluate((el) => {
          const targets: Element[] = [el, ...Array.from((el as HTMLInputElement).labels ?? [])];
          if (el.nextElementSibling) targets.push(el.nextElementSibling);
          return targets.map((t) => {
            t.getAnimations().forEach((a) => {
              try {
                a.finish();
              } catch {
                // ignore infinite animations
              }
            });
            const s = window.getComputedStyle(t);
            const r = t.getBoundingClientRect();
            return {
              rendered:
                s.visibility !== 'hidden' &&
                parseFloat(s.opacity) > 0 &&
                r.width > 1 &&
                r.height > 1,
              outlineStyle: s.outlineStyle,
              outlineWidth: s.outlineWidth,
              outlineColor: s.outlineColor,
              boxShadow: s.boxShadow,
            };
          });
        });

      const btnBefore = await readButtonIndicators();
      await button.focus();
      const btnAfter = await readButtonIndicators();

      const hasChangedFocusIndicator = (
        before: {
          rendered?: boolean;
          outlineStyle: string;
          outlineWidth: string;
          outlineColor: string;
          boxShadow: string;
        },
        after: {
          rendered?: boolean;
          outlineStyle: string;
          outlineWidth: string;
          outlineColor: string;
          boxShadow: string;
        },
      ) => {
        if (after.rendered === false) return false;
        const outlineVisible =
          after.outlineStyle !== 'none' && parseFloat(after.outlineWidth) > 0;
        const shadowVisible = after.boxShadow !== 'none';
        const outlineChanged =
          outlineVisible &&
          (after.outlineStyle !== before.outlineStyle ||
            after.outlineWidth !== before.outlineWidth ||
            after.outlineColor !== before.outlineColor);
        const shadowChanged = shadowVisible && after.boxShadow !== before.boxShadow;
        return outlineChanged || shadowChanged;
      };

      const btnIndicator = btnAfter.some((a, i) => hasChangedFocusIndicator(btnBefore[i], a));
      expect(btnIndicator).toBe(true);

      // Check primary link focus: stretched primary link delegates indicator to card; non-stretched link shows indicator on itself
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
      const primaryLinkFocus = await cards.first().evaluate((card) => {
        const readStyle = (el: Element) => {
          el.getAnimations().forEach((a) => {
            try {
              a.finish();
            } catch {
              // ignore infinite animations
            }
          });
          const s = window.getComputedStyle(el);
          return {
            outlineStyle: s.outlineStyle,
            outlineWidth: s.outlineWidth,
            outlineColor: s.outlineColor,
            boxShadow: s.boxShadow,
          };
        };
        const styleChangedToVisibleIndicator = (
          b: ReturnType<typeof readStyle>,
          a: ReturnType<typeof readStyle>,
        ) => {
          const outlineVisible = a.outlineStyle !== 'none' && parseFloat(a.outlineWidth) > 0;
          const shadowVisible = a.boxShadow !== 'none';
          const outlineChanged =
            outlineVisible &&
            (a.outlineStyle !== b.outlineStyle ||
              a.outlineWidth !== b.outlineWidth ||
              a.outlineColor !== b.outlineColor);
          const shadowChanged = shadowVisible && a.boxShadow !== b.boxShadow;
          return outlineChanged || shadowChanged;
        };

        const links = Array.from(card.querySelectorAll('a')) as HTMLElement[];
        if (links.length === 0) return { hasStretchedLink: false, valid: false };
        const stretchedLink = links.find((a) => {
          const after = window.getComputedStyle(a, '::after');
          return after.position === 'absolute' && after.content !== 'none';
        });
        if (!stretchedLink) {
          const primaryLink = (card.querySelector('h1 a, h2 a, h3 a, h4 a, h5 a, h6 a') ||
            links[0]) as HTMLElement;
          const linkBefore = readStyle(primaryLink);
          primaryLink.focus();
          const linkAfter = readStyle(primaryLink);
          return {
            hasStretchedLink: false,
            valid: styleChangedToVisibleIndicator(linkBefore, linkAfter),
          };
        }

        const cardBefore = readStyle(card);
        stretchedLink.focus();
        const linkAfter = readStyle(stretchedLink);
        const cardAfter = readStyle(card);
        const linkOutlineRemoved =
          linkAfter.outlineStyle === 'none' || parseFloat(linkAfter.outlineWidth) === 0;
        const cardHasFocusRing = styleChangedToVisibleIndicator(cardBefore, cardAfter);
        return {
          hasStretchedLink: true,
          valid: linkOutlineRemoved && cardHasFocusRing,
        };
      });

      expect(primaryLinkFocus.valid).toBe(true);
    });

    test('The visual order of card regions matches their DOM reading order across container sizes', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const cards = page.locator('article.card, main article');
      await expect(cards.first()).toBeVisible();

      const orderCheck = await cards.first().evaluate((card) => {
        const htmlCard = card as HTMLElement;
        const parent = htmlCard.parentElement;
        const prevGridCols = parent?.style.gridTemplateColumns ?? '';
        const prevWidth = htmlCard.style.width;
        if (parent) parent.style.gridTemplateColumns = '1fr';

        const checkOrderAtWidth = (widthPx: string) => {
          htmlCard.style.width = widthPx;
          const children = Array.from(htmlCard.children) as HTMLElement[];
          // No child uses CSS order != 0
          const hasNonZeroCssOrder = children.some(
            (c) => parseInt(window.getComputedStyle(c).order, 10) !== 0,
          );
          const rects = children.map((c) => c.getBoundingClientRect());
          // Each subsequent DOM sibling is either below or to the right of the previous one
          let monotonic = true;
          for (let i = 1; i < rects.length; i++) {
            const prev = rects[i - 1];
            const curr = rects[i];
            const isBelow = curr.top >= prev.top - 2;
            const isRight = curr.left >= prev.left - 2;
            if (!isBelow && !isRight) {
              monotonic = false;
            }
          }
          // Non-media regions (heading, content, footer) strictly increase in vertical position
          const nonMediaRects = children
            .filter(
              (c) => !['img', 'picture', 'video', 'svg'].includes(c.tagName.toLowerCase()),
            )
            .map((c) => c.getBoundingClientRect());
          let nonMediaTopIncreasing = true;
          for (let i = 1; i < nonMediaRects.length; i++) {
            if (nonMediaRects[i].top < nonMediaRects[i - 1].top) {
              nonMediaTopIncreasing = false;
            }
          }
          return !hasNonZeroCssOrder && monotonic && nonMediaTopIncreasing;
        };

        const narrowValid = checkOrderAtWidth('260px');
        const wideValid = checkOrderAtWidth('640px');

        if (parent) parent.style.gridTemplateColumns = prevGridCols;
        htmlCard.style.width = prevWidth;

        return { narrowValid, wideValid };
      });

      expect(orderCheck.narrowValid).toBe(true);
      expect(orderCheck.wideValid).toBe(true);
    });
  });
});
