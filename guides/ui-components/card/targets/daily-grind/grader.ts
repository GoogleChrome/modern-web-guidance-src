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
  type CSSStyleDeclaration,
} from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getCards(docs: Array<{ file: string; document: Document }>): any[] {
  return docs.flatMap((d) => Array.from(d.document.querySelectorAll('.card')));
}

function resolveSelector(parentSelector: string, childSelector: string): string {
  if (!parentSelector) return childSelector;
  const parents = parentSelector.split(',').map((s) => s.trim());
  const children = childSelector.split(',').map((s) => s.trim());
  const combined: string[] = [];
  for (const p of parents) {
    for (const c of children) {
      if (c.includes('&')) {
        combined.push(c.replace(/&/g, p));
      } else {
        combined.push(`${p} ${c}`);
      }
    }
  }
  return combined.join(', ');
}

interface FlatStyleRule {
  selectorText: string;
  style: CSSStyleDeclaration;
  inContainer: boolean;
  containerCondition: string;
}

function collectFlatStyleRules(
  rules: Iterable<CSSRule>,
  parentSelector = '',
  inContainer = false,
  containerCondition = '',
): FlatStyleRule[] {
  const result: FlatStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      const sel = resolveSelector(parentSelector, rule.selectorText);
      if (rule.style.length > 0) {
        result.push({
          selectorText: sel,
          style: rule.style,
          inContainer,
          containerCondition,
        });
      }
      if (rule.cssRules && rule.cssRules.length > 0) {
        result.push(...collectFlatStyleRules(rule.cssRules, sel, inContainer, containerCondition));
      }
    } else if (rule instanceof CSSNestedDeclarations) {
      if (rule.style.length > 0) {
        result.push({
          selectorText: parentSelector,
          style: rule.style,
          inContainer,
          containerCondition,
        });
      }
    } else if (rule instanceof CSSContainerRule) {
      result.push(
        ...collectFlatStyleRules(rule.cssRules, parentSelector, true, rule.conditionText || rule.containerQuery || ''),
      );
    } else if (rule instanceof CSSGroupingRule) {
      result.push(...collectFlatStyleRules(rule.cssRules, parentSelector, inContainer, containerCondition));
    }
  }
  return result;
}

function collectContainerRules(rules: Iterable<CSSRule>): CSSContainerRule[] {
  const result: CSSContainerRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSContainerRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectContainerRules(rule.cssRules));
    }
  }
  return result;
}

test.describe('card Target Grader', () => {
  test('The card root is an <article>; a single link may wrap it only if the card contains no other interactive elements', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cards = getCards(docs);
    const allValidArticleRoots =
      cards.length > 0 &&
      cards.every((card) => {
        if (card.tagName.toLowerCase() !== 'article') return false;
        const wrappingLink = card.closest('a');
        if (wrappingLink) {
          const innerInteractives = card.querySelectorAll('a, button, input, select, textarea');
          return innerInteractives.length === 0;
        }
        return true;
      });
    expect(allValidArticleRoots).toBe(true);
  });

  test("A card's regions (media, heading or header, content, footer) are direct children of the card without unnecessary wrappers", () => {
    const docs = getHtmlDocuments(targetFiles);
    const cards = getCards(docs);
    const mediaTags = new Set(['img', 'picture', 'video', 'svg']);
    const headerTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup', 'header']);

    const allRegionsValid =
      cards.length > 0 &&
      cards.every((card) => {
        const children: any[] = Array.from(card.children);
        if (children.length < 2 || children.length > 4) return false;

        let hasHeadingOrHeader = false;
        let hasMedia = false;
        let hasFooter = false;
        for (const child of children) {
          const tag = child.tagName.toLowerCase();
          const isMedia = mediaTags.has(tag) || child.classList?.contains('media');
          const isHeader = headerTags.has(tag);
          const isFooter = tag === 'footer';

          if (isMedia) {
            hasMedia = true;
            if (child.classList?.contains('media') && child.children.length === 1) {
              const innerTag = child.children[0].tagName.toLowerCase();
              if (mediaTags.has(innerTag)) return false;
            }
          } else if (isHeader) {
            hasHeadingOrHeader = true;
            if ((tag === 'header' || tag === 'hgroup') && child.children.length < 2) {
              return false;
            }
          } else if (isFooter) {
            hasFooter = true;
          } else {
            if (tag === 'div' && child.children.length < 2) {
              return false;
            }
          }
        }
        return hasHeadingOrHeader && hasMedia && hasFooter;
      });

    expect(allRegionsValid).toBe(true);
  });

  test("A card's descendants adapt with @container rules, and the size container is the card itself, not the grid or list parent", () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const flatRules = collectFlatStyleRules(stylesheet.cssRules);
    const containerRules = collectContainerRules(stylesheet.cssRules);

    const cardIsContainer = flatRules.some((r) => {
      if (!r.selectorText.includes('.card')) return false;
      const cType = r.style.getPropertyValue('container-type');
      const cShort = r.style.getPropertyValue('container');
      return /\b(inline-size|size)\b/.test(cType) || /\b(inline-size|size)\b/.test(cShort);
    });

    const parentIsContainer = flatRules.some((r) => {
      if (r.selectorText.includes('.card')) return false;
      const cType = r.style.getPropertyValue('container-type');
      const cShort = r.style.getPropertyValue('container');
      return /\b(inline-size|size)\b/.test(cType) || /\b(inline-size|size)\b/.test(cShort);
    });

    expect(cardIsContainer && !parentIsContainer && containerRules.length > 0).toBe(true);
  });

  test('When card images or video fill a fixed-ratio area, aspect-ratio and object-fit are set on the media element itself', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cards = getCards(docs);
    const hasCardMedia = cards.some((card) => Boolean(card.querySelector('img, video')));

    const stylesheet = getCssStyleSheet(targetFiles);
    const flatRules = collectFlatStyleRules(stylesheet.cssRules);
    const mediaHasRatioAndFit = flatRules.some((r) => {
      if (!/\b(img|video)\b/.test(r.selectorText)) return false;
      const ratio = r.style.getPropertyValue('aspect-ratio').trim();
      const fit = r.style.getPropertyValue('object-fit').trim();
      return ratio.length > 0 && ratio !== 'auto' && fit.length > 0;
    });

    expect(hasCardMedia && mediaHasRatioAndFit).toBe(true);
  });

  test('Informative card images have a non-empty alt attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cards = getCards(docs);
    const images = cards.flatMap((card) => Array.from(card.querySelectorAll('img')));

    const allHaveNonEmptyAlt =
      images.length > 0 &&
      images.every((img: any) => {
        const alt = img.getAttribute('alt');
        return typeof alt === 'string' && alt.trim().length > 0;
      });

    expect(allHaveNonEmptyAlt).toBe(true);
  });

  test('When a content card has a primary destination and secondary actions, its heading contains the primary link or actions are distinct native controls, with no ambiguous duplicate links and at most one stretched link', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cards = getCards(docs);

    const allCardsFollowActionRules =
      cards.length > 0 &&
      cards.every((card) => {
        const buttonsAndInputs = card.querySelectorAll('button, input, select');
        if (buttonsAndInputs.length === 0) return false;

        const links: any[] = Array.from(card.querySelectorAll('a[href]'));
        if (links.length === 0) return false;

        const headingLink = card.querySelector(':is(h1, h2, h3, h4, h5, h6) a[href]');
        if (links.length > 1 && !headingLink) return false;

        const stretchedLinks = links.filter((a) => a.classList?.contains('card-link'));
        if (stretchedLinks.length > 1) return false;
        if (stretchedLinks.length === 1 && stretchedLinks[0] !== headingLink) return false;

        const hrefGroups = new Map<string, any[]>();
        for (const a of links) {
          const href = a.getAttribute('href')?.trim() || '';
          const group = hrefGroups.get(href) || [];
          group.push(a);
          hrefGroups.set(href, group);
        }

        for (const [, group] of hrefGroups) {
          if (group.length > 2) return false;
          if (group.length === 2) {
            if (!headingLink || !group.includes(headingLink)) return false;
            const otherLink = group.find((a) => a !== headingLink);
            if (!otherLink || !otherLink.closest('footer')) return false;
            const headingText = (headingLink.textContent || '').trim();
            const otherText = (otherLink.textContent || '').trim();
            if (!otherText || otherText === headingText) return false;
          }
        }

        return true;
      });

    expect(allCardsFollowActionRules).toBe(true);
  });

  test('Choice controls use native radio buttons or checkboxes with associated labels, or dropdown choices use a native <select> and <option> elements', () => {
    const docs = getHtmlDocuments(targetFiles);
    const cards = getCards(docs);

    const allCardsHaveValidChoices =
      cards.length > 0 &&
      cards.every((card) => {
        const radiosOrCheckboxes: any[] = Array.from(
          card.querySelectorAll('input[type="radio"], input[type="checkbox"]'),
        );
        const selects: any[] = Array.from(card.querySelectorAll('select'));

        if (radiosOrCheckboxes.length === 0 && selects.length === 0) return false;

        const radiosValid = radiosOrCheckboxes.every((input) => {
          if (input.closest('label')) return true;
          const id = input.getAttribute('id');
          return Boolean(id && card.querySelector(`label[for="${id}"]`));
        });

        const selectsValid = selects.every((select) => {
          const options = select.querySelectorAll('option');
          if (options.length < 2) return false;
          if (select.closest('label')) return true;
          const id = select.getAttribute('id');
          return Boolean(id && card.querySelector(`label[for="${id}"]`));
        });

        return radiosValid && selectsValid;
      });

    expect(allCardsHaveValidChoices).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('A card with media stacks its media above its text content in a single column when its container is narrow, regardless of viewport width', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const stackedInNarrowContainer = await page.evaluate(() => {
        const card = document.querySelector('article.card') as HTMLElement | null;
        if (!card) return false;
        const media = card.querySelector(':scope > :is(img, picture, video, svg, .media)') as HTMLElement | null;
        const heading = card.querySelector(':scope > :is(h1, h2, h3, h4, h5, h6, hgroup, header)') as HTMLElement | null;
        if (!media || !heading) return false;

        const prevWidth = card.style.width;
        card.style.width = '240px';
        const mediaRect = media.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        card.style.width = prevWidth;

        return (
          headingRect.top >= mediaRect.bottom - 2 && Math.abs(headingRect.left - mediaRect.left) < 40
        );
      });

      expect(stackedInNarrowContainer).toBe(true);
    });

    test('A card with media places its media in a side column beside its text content when its container is wide', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const sideBySideInWideContainer = await page.evaluate(() => {
        const card = document.querySelector('article.card') as HTMLElement | null;
        if (!card) return false;
        const media = card.querySelector(':scope > :is(img, picture, video, svg, .media)') as HTMLElement | null;
        const heading = card.querySelector(':scope > :is(h1, h2, h3, h4, h5, h6, hgroup, header)') as HTMLElement | null;
        if (!media || !heading) return false;

        const prevWidth = card.style.width;
        const prevGridCols = card.parentElement ? (card.parentElement as HTMLElement).style.gridTemplateColumns : '';
        if (card.parentElement) {
          (card.parentElement as HTMLElement).style.gridTemplateColumns = '1fr';
        }
        card.style.width = '650px';

        const mediaRect = media.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        const mediaGridCol = window.getComputedStyle(media).gridColumnStart;
        const headingGridCol = window.getComputedStyle(heading).gridColumnStart;

        card.style.width = prevWidth;
        if (card.parentElement) {
          (card.parentElement as HTMLElement).style.gridTemplateColumns = prevGridCols;
        }

        const isBeside = headingRect.left >= mediaRect.left + Math.min(mediaRect.width * 0.5, 40);
        const overlapsVertically =
          headingRect.top < mediaRect.bottom + 2 && headingRect.bottom > mediaRect.top - 2;
        if (isBeside && overlapsVertically) return true;

        return (
          mediaGridCol !== 'auto' &&
          headingGridCol !== 'auto' &&
          mediaGridCol !== headingGridCol
        );
      });

      expect(sideBySideInWideContainer).toBe(true);
    });

    test('A card without media renders in a single-column layout at both narrow and wide container widths, with no empty media column', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const singleColumnWithoutMedia = await page.evaluate(() => {
        const card = document.querySelector('article.card') as HTMLElement | null;
        if (!card) return false;

        const clone = card.cloneNode(true) as HTMLElement;
        const media = clone.querySelector(':scope > :is(img, picture, video, svg, .media)');
        if (!media) return false;
        media.remove();

        const parent = card.parentElement || document.body;
        parent.appendChild(clone);

        const getLayoutMetrics = (widthPx: string) => {
          clone.style.width = widthPx;
          const cardRect = clone.getBoundingClientRect();
          const style = window.getComputedStyle(clone);
          const padLeft = parseFloat(style.paddingLeft) || 0;
          const borderLeft = parseFloat(style.borderLeftWidth) || 0;
          const heading = clone.querySelector(':scope > :is(h1, h2, h3, h4, h5, h6, hgroup, header)') as HTMLElement | null;
          const content = clone.querySelector(
            ':scope > :not(img, picture, video, svg, .media, h1, h2, h3, h4, h5, h6, hgroup, header, footer)',
          ) as HTMLElement | null;
          if (!heading || !content) return null;
          const hRect = heading.getBoundingClientRect();
          const cRect = content.getBoundingClientRect();
          const hStyle = window.getComputedStyle(heading);
          const marginLeft = parseFloat(hStyle.marginLeft) || 0;
          const expectedLeft = cardRect.left + borderLeft + padLeft + marginLeft;
          return {
            leftOffset: Math.abs(hRect.left - expectedLeft),
            stacked: cRect.top >= hRect.bottom - 2,
          };
        };

        const narrow = getLayoutMetrics('240px');
        const wide = getLayoutMetrics('650px');
        clone.remove();

        if (!narrow || !wide) return false;
        return narrow.leftOffset < 15 && narrow.stacked && wide.leftOffset < 15 && wide.stacked;
      });

      const stylesheet = getCssStyleSheet(targetFiles);
      const flatRules = collectFlatStyleRules(stylesheet.cssRules);
      const mediaScopedInCss = flatRules.some(
        (r) =>
          r.selectorText.includes(':has(') &&
          /\b(img|picture|video|svg|media)\b/.test(r.selectorText) &&
          (r.style.getPropertyValue('grid-template-columns').trim() !== '' ||
            r.style.getPropertyValue('grid-column').trim() !== ''),
      );

      expect(singleColumnWithoutMedia || mediaScopedInCss).toBe(true);
    });

    test('Hovering, focusing, or selecting a card does not change its layout box (no change to border-width, padding, font-weight, or size)', async ({
      page,
    }) => {
      const card = page.locator('article.card').first();
      const before = await card.evaluate((el) => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          borderTopWidth: s.borderTopWidth,
          borderRightWidth: s.borderRightWidth,
          borderBottomWidth: s.borderBottomWidth,
          borderLeftWidth: s.borderLeftWidth,
          paddingTop: s.paddingTop,
          paddingRight: s.paddingRight,
          paddingBottom: s.paddingBottom,
          paddingLeft: s.paddingLeft,
          fontWeight: s.fontWeight,
        };
      });

      await card.hover();
      const firstControl = card.locator('a, button, input, select').first();
      await firstControl.focus();

      const after = await card.evaluate((el) => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          borderTopWidth: s.borderTopWidth,
          borderRightWidth: s.borderRightWidth,
          borderBottomWidth: s.borderBottomWidth,
          borderLeftWidth: s.borderLeftWidth,
          paddingTop: s.paddingTop,
          paddingRight: s.paddingRight,
          paddingBottom: s.paddingBottom,
          paddingLeft: s.paddingLeft,
          fontWeight: s.fontWeight,
        };
      });

      expect(after).toEqual(before);
    });

    test('Focusing a control inside a card shows a visible focus indicator on that control; only a stretched primary link delegates its indicator to the card', async ({
      page,
    }) => {
      const stylesheet = getCssStyleSheet(targetFiles);
      const flatRules = collectFlatStyleRules(stylesheet.cssRules);
      const hasFocusVisibleRule = flatRules.some(
        (r) =>
          (r.selectorText.includes(':focus-visible') || r.selectorText.includes(':focus')) &&
          (r.style.getPropertyValue('outline').trim() !== '' ||
            r.style.getPropertyValue('box-shadow').trim() !== ''),
      );

      const card = page.locator('article.card').first();
      const nonStretchedControl = card
        .locator('button, select, input:not([type="hidden"]), a:not(.card-link)')
        .first();
      await nonStretchedControl.focus();

      const controlHasVisibleOutline = await nonStretchedControl.evaluate((el) => {
        const hasVisibleIndicator = (target: Element | null) => {
          if (!target) return false;
          const s = window.getComputedStyle(target);
          return (
            (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
            s.boxShadow !== 'none'
          );
        };
        return (
          hasVisibleIndicator(el) ||
          hasVisibleIndicator(el.closest('label')) ||
          hasVisibleIndicator(el.nextElementSibling)
        );
      });

      const stretchedLinksCount = await card.locator('a.card-link').count();
      let stretchedDelegationValid = true;
      if (stretchedLinksCount > 0) {
        const stretchedLink = card.locator('a.card-link').first();
        await stretchedLink.focus();
        stretchedDelegationValid = await card.evaluate((cardEl) => {
          const linkEl = cardEl.querySelector('a.card-link');
          if (!linkEl) return false;
          const linkStyle = window.getComputedStyle(linkEl);
          const cardStyle = window.getComputedStyle(cardEl);
          const linkOutlineHidden = linkStyle.outlineStyle === 'none' || parseFloat(linkStyle.outlineWidth) === 0;
          const cardHasIndicator =
            (cardStyle.outlineStyle !== 'none' && parseFloat(cardStyle.outlineWidth) > 0) ||
            cardStyle.boxShadow !== 'none';
          return linkOutlineHidden && cardHasIndicator;
        });
      }

      expect(hasFocusVisibleRule && controlHasVisibleOutline && stretchedDelegationValid).toBe(true);
    });

    test('The visual order of card regions matches their DOM reading order across container sizes', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const visualOrderMatchesDom = await page.evaluate(() => {
        const card = document.querySelector('article.card') as HTMLElement | null;
        if (!card) return false;

        const checkOrderAtWidth = (widthPx: string) => {
          const prevWidth = card.style.width;
          card.style.width = widthPx;
          const children = Array.from(card.children) as HTMLElement[];
          if (children.length < 2) {
            card.style.width = prevWidth;
            return false;
          }

          for (const child of children) {
            const orderVal = parseInt(window.getComputedStyle(child).order, 10);
            if (!Number.isNaN(orderVal) && orderVal !== 0) {
              card.style.width = prevWidth;
              return false;
            }
          }

          const rects = children.map((c) => c.getBoundingClientRect());
          card.style.width = prevWidth;

          for (let i = 0; i < rects.length - 1; i++) {
            const curr = rects[i];
            const next = rects[i + 1];
            const isAbove = curr.top <= next.top + 2;
            const isLeft = curr.left <= next.left + 2;
            if (!isAbove && !isLeft) return false;
            if (Math.abs(curr.left - next.left) < 10 && curr.top > next.top + 2) {
              return false;
            }
          }
          return true;
        };

        return checkOrderAtWidth('240px') && checkOrderAtWidth('650px');
      });

      expect(visualOrderMatchesDom).toBe(true);
    });
  });
});
