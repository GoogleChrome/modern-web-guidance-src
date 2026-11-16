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
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Page } from '@playwright/test';

const targetFiles: string[] = getTargetFiles(
  // @ts-ignore - package.json omits "type": "module" so nodenext treats .ts as CommonJS
  import.meta.url
);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

/**
 * Ensures the breadcrumb trail in the browser has at least 2 items (both ancestor and current page links).
 * Some implementations only show a single item ("Home") on `/` and expand the trail when navigating
 * to a menu or product page (or clicking a link in the page).
 */
async function ensureMultiItemBreadcrumbTrail(page: Page, baseUrl: string): Promise<void> {
  const getTrailItemCount = async () => {
    return page.evaluate(() => {
      const navs = Array.from(document.querySelectorAll('nav'));
      const bcNav =
        navs.find((n) => n.querySelector('ol')) ||
        navs.find((n) => /breadcrumb/i.test(n.getAttribute('aria-label') || '') || /breadcrumb/i.test(n.className));
      if (!bcNav) return 0;
      const items = Array.from(bcNav.querySelectorAll<HTMLLIElement>('ol > li, ul > li')).filter(
        (li) => !li.hidden && window.getComputedStyle(li).display !== 'none'
      );
      return items.length;
    });
  };

  if ((await getTrailItemCount()) >= 2) {
    return;
  }

  // Try navigating to a sub-route like /menu/seasonal or /menu where index.html is served or try History pushState
  const baseNormalized = baseUrl.replace(/\/+$/, '');
  const candidatePaths = ['/menu/seasonal', '/menu'];

  for (const candidatePath of candidatePaths) {
    const response = await page.goto(`${baseNormalized}${candidatePath}`).catch(() => null);
    if (response && response.ok() && (await getTrailItemCount()) >= 2) {
      return;
    }
  }

  // Return to baseUrl and try pushState + script re-evaluation or clicking an item
  await page.goto(baseUrl);
  if ((await getTrailItemCount()) >= 2) {
    return;
  }

  await page.evaluate(() => {
    window.history.pushState({}, '', '/menu/seasonal');
    window.dispatchEvent(new PopStateEvent('popstate'));
    // Re-execute inline scripts that inspect window.location.pathname on load
    for (const s of Array.from(document.querySelectorAll<HTMLScriptElement>('body script'))) {
      if (!s.src && s.textContent) {
        try {
          new Function(s.textContent)();
        } catch {
          // ignore
        }
      }
    }
  });

  if ((await getTrailItemCount()) >= 2) {
    return;
  }

  // Or try clicking a card's "View Details" link if prevented by JS; restore baseUrl if it navigated to 404
  const detailBtn = page.locator('.card a.btn').first();
  if ((await detailBtn.count()) > 0) {
    await detailBtn.click().catch(() => {});
    if ((await getTrailItemCount()) === 0) {
      await page.goto(baseUrl);
    }
  }
}

test.describe('breadcrumbs Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The breadcrumb trail is wrapped in a <nav> element with a non-empty aria-label', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const breadcrumbNavs = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('nav')).filter(
        (nav: any) =>
          Boolean(nav.querySelector('ol')) ||
          /breadcrumb/i.test(nav.getAttribute('aria-label') || '') ||
          /breadcrumb/i.test(nav.getAttribute('class') || '')
      )
    );
    expect(breadcrumbNavs.length).toBeGreaterThan(0);

    const hasValidAriaLabel = breadcrumbNavs.some((nav: any) => {
      const label = (nav.getAttribute('aria-label') || '').trim();
      const labelledBy = (nav.getAttribute('aria-labelledby') || '').trim();
      return label.length > 0 || labelledBy.length > 0;
    });
    expect(hasValidAriaLabel).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      await ensureMultiItemBreadcrumbTrail(page, TARGET_URL);
    });

    test('The <nav> contains an ordered list (<ol>) whose breadcrumb trail <li> items (excluding any collapsed overflow <li>) each contain an <a>', async ({
      page,
    }) => {
      const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
      const staticLists = docs.flatMap((d) =>
        Array.from(d.document.querySelectorAll('nav ol'))
      );
      expect(staticLists.length).toBeGreaterThan(0);

      const listState = await page.evaluate(() => {
        const navs = Array.from(document.querySelectorAll('nav'));
        const bcNav =
          navs.find((n) => n.querySelector('ol')) ||
          navs.find((n) => /breadcrumb/i.test(n.getAttribute('aria-label') || '') || /breadcrumb/i.test(n.className));
        if (!bcNav) return null;

        const ol = bcNav.querySelector(':scope > ol, ol');
        if (!ol) return { hasOl: false, trailItemCount: 0, everyItemHasAnchor: false };

        const allLiItems = Array.from(ol.children).filter(
          (el): el is HTMLLIElement =>
            el.tagName.toLowerCase() === 'li' &&
            !(el as HTMLLIElement).hidden &&
            window.getComputedStyle(el).display !== 'none'
        );

        // Exclude collapsed overflow <li> (holds a toggle <button> and no direct trail <a>)
        const trailLiItems = allLiItems.filter((li) => {
          const hasDirectAnchor = Boolean(li.querySelector(':scope > a'));
          const hasOverflowButton = Boolean(li.querySelector(':scope > button'));
          return !(hasOverflowButton && !hasDirectAnchor);
        });

        return {
          hasOl: true,
          trailItemCount: trailLiItems.length,
          everyItemHasAnchor: trailLiItems.every((li) => Boolean(li.querySelector(':scope > a'))),
        };
      });

      expect(listState).not.toBeNull();
      expect(listState!.hasOl).toBe(true);
      expect(listState!.trailItemCount).toBeGreaterThanOrEqual(2);
      expect(listState!.everyItemHasAnchor).toBe(true);
    });

    test('The last item\'s link has aria-current="page", and no other trail link has it', async ({
      page,
    }) => {
      const ariaCurrentState = await page.evaluate(() => {
        const navs = Array.from(document.querySelectorAll('nav'));
        const bcNav =
          navs.find(
            (n) =>
              /breadcrumb/i.test(n.getAttribute('aria-label') || '') ||
              /breadcrumb/i.test(n.className)
          ) || navs.find((n) => n.querySelector('ol'));
        if (!bcNav) return null;

        const list = bcNav.querySelector('ol, ul');
        const allLi = list
          ? Array.from(list.querySelectorAll<HTMLLIElement>(':scope > li'))
          : Array.from(bcNav.querySelectorAll<HTMLLIElement>('li'));

        const items = allLi.filter((li) => {
          if (li.hidden || window.getComputedStyle(li).display === 'none') return false;
          const hasDirectAnchor = Boolean(li.querySelector(':scope > a'));
          const hasOverflowButton = Boolean(li.querySelector(':scope > button'));
          return !(hasOverflowButton && !hasDirectAnchor);
        });

        const getAriaCurrent = (li: HTMLLIElement) => {
          return (
            li.getAttribute('aria-current') ||
            li.querySelector('a[aria-current]')?.getAttribute('aria-current') ||
            li.querySelector('[aria-current]')?.getAttribute('aria-current') ||
            li.querySelector(':scope > a')?.getAttribute('aria-current') ||
            null
          );
        };

        return {
          count: items.length,
          ariaCurrents: items.map(getAriaCurrent),
        };
      });

      expect(ariaCurrentState).not.toBeNull();
      expect(ariaCurrentState!.count).toBeGreaterThanOrEqual(2);

      const { ariaCurrents } = ariaCurrentState!;
      expect(ariaCurrents[ariaCurrents.length - 1]).toBe('page');
      for (let i = 0; i < ariaCurrents.length - 1; i++) {
        expect(ariaCurrents[i]).not.toBe('page');
      }
    });

    test('Divider characters are not present as text nodes in the DOM; when dividers are rendered between items, they are generated via CSS so the accessible names of the list items contain no divider characters', async ({
      page,
    }) => {
      // Static CSS check + runtime DOM and accessibility tree check
      const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
      const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));
      const hasCssGeneratedSeparatorOrShape = styleRules.some((rule) => {
        const sel = rule.selectorText || '';
        const contentVal = (rule.style.getPropertyValue('content') || '').trim();
        const maskVal =
          rule.style.getPropertyValue('mask') ||
          rule.style.getPropertyValue('mask-image') ||
          rule.style.getPropertyValue('-webkit-mask') ||
          rule.style.getPropertyValue('-webkit-mask-image') ||
          '';
        const cornerShapeVal = rule.style.getPropertyValue('corner-shape') || '';
        const borderShapeVal = rule.style.getPropertyValue('border-shape') || '';
        const clipPathVal = rule.style.getPropertyValue('clip-path') || '';

        const hasEmptyAltContent = /\/\s*(?:""|'')\s*$/.test(contentVal);
        const isEmptyContentWithMask =
          (contentVal === '""' || contentVal === "''") && maskVal.length > 0;
        const isPseudoWithAltOrMask =
          /::?(before|after)\b/.test(sel) && (hasEmptyAltContent || isEmptyContentWithMask);
        const isShapedSegment =
          cornerShapeVal.length > 0 ||
          borderShapeVal.length > 0 ||
          clipPathVal.includes('polygon');

        return isPseudoWithAltOrMask || isShapedSegment;
      });
      expect(hasCssGeneratedSeparatorOrShape).toBe(true);

      const domAndA11yDividerCheck = await page.evaluate(() => {
        const navs = Array.from(document.querySelectorAll('nav'));
        const bcNav = navs.find((n) => n.querySelector('ol'));
        if (!bcNav) return null;

        const ol = bcNav.querySelector('ol')!;
        const dividerRegex = /[/›>»\\|]/;
        const edgeDividerRegex = /^[/›>»\\|]|[/›>»\\|]$/;

        // Check text nodes outside <a> (or inside aria-hidden spans) and leading/trailing dividers on <a>
        const hasDividerTextNode = (root: Node): boolean => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let node: Node | null;
          while ((node = walker.nextNode())) {
            const text = (node.textContent || '').trim();
            if (!text) continue;
            const anchor = node.parentElement?.closest('a');
            if (!anchor) {
              if (dividerRegex.test(text)) return true;
            } else if (edgeDividerRegex.test(text)) {
              return true;
            }
          }
          return false;
        };

        const items = Array.from(ol.querySelectorAll<HTMLLIElement>(':scope > li')).filter(
          (li) => !li.hidden && window.getComputedStyle(li).display !== 'none' && li.querySelector(':scope > a')
        );

        // Verify any non-empty text pseudo-element on trail items uses empty alt text (/ "")
        const hasExposedPseudoDivider = items.some((li) => {
          const link = li.querySelector(':scope > a')!;
          for (const [el, pseudo] of [
            [li, '::before'],
            [li, '::after'],
            [link, '::before'],
            [link, '::after'],
          ] as const) {
            const c = window.getComputedStyle(el, pseudo).content.trim();
            if (c && c !== 'none' && c !== 'normal' && c !== '""' && c !== "''") {
              if (!/\/\s*(?:""|'')\s*$/.test(c)) return true;
            }
          }
          return false;
        });

        return {
          itemCount: items.length,
          hasDomDividerText: hasDividerTextNode(ol),
          hasExposedPseudoDivider,
        };
      });

      expect(domAndA11yDividerCheck).not.toBeNull();
      expect(domAndA11yDividerCheck!.itemCount).toBeGreaterThanOrEqual(2);
      expect(domAndA11yDividerCheck!.hasDomDividerText).toBe(false);
      expect(domAndA11yDividerCheck!.hasExposedPseudoDivider).toBe(false);

      // Verify the accessibility tree of the list contains no standalone divider text nodes
      const a11ySnapshot = await page.locator('nav:has(ol) ol').first().ariaSnapshot();
      expect(a11ySnapshot).not.toMatch(/-\s*text:\s*["']?[/›>»\\|]["']?\s*$/m);
    });

    test('Each trail item after the first has a visible separator before it: a generated ::before or ::after divider, or an arrow or slant segment shape', async ({
      page,
    }) => {
      const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
      const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));

      // Check CSS rules for either pseudo-element divider or shaped segment rules
      const hasStaticSeparatorRule = styleRules.some((rule) => {
        const sel = rule.selectorText || '';
        const content = rule.style.getPropertyValue('content') || '';
        const mask =
          rule.style.getPropertyValue('mask') ||
          rule.style.getPropertyValue('mask-image') ||
          rule.style.getPropertyValue('-webkit-mask') ||
          rule.style.getPropertyValue('-webkit-mask-image') ||
          '';
        const cornerShape = rule.style.getPropertyValue('corner-shape') || '';
        const borderShape = rule.style.getPropertyValue('border-shape') || '';
        const clipPath = rule.style.getPropertyValue('clip-path') || '';

        const hasPseudoSeparator =
          /::?(before|after)\b/.test(sel) &&
          ((content !== '' && content !== 'none' && content !== 'normal') || mask !== '');
        const hasShape =
          cornerShape.includes('bevel') ||
          borderShape.includes('polygon') ||
          clipPath.includes('polygon');

        return hasPseudoSeparator || hasShape;
      });
      expect(hasStaticSeparatorRule).toBe(true);

      // Verify in the live browser that every trail item after the first has a rendered pseudo-element separator or segment shape
      const runtimeCheck = await page.evaluate(() => {
        const navs = Array.from(document.querySelectorAll('nav'));
        const bcNav = navs.find((n) => n.querySelector('ol'));
        if (!bcNav) return null;

        const items = Array.from(bcNav.querySelectorAll<HTMLLIElement>('ol > li')).filter(
          (li) => !li.hidden && window.getComputedStyle(li).display !== 'none' && li.querySelector(':scope > a')
        );
        if (items.length < 2) return { itemCount: items.length, allAfterFirstSeparated: false };

        const isPseudoActive = (st: CSSStyleDeclaration) => {
          const c = st.content;
          const hasTextContent =
            Boolean(c) && c !== 'none' && c !== 'normal' && c !== '""' && c !== "''";
          const hasMask =
            (st.maskImage && st.maskImage !== 'none') ||
            (st.webkitMaskImage && st.webkitMaskImage !== 'none');
          const hasVisibleBgOrBorder =
            (st.backgroundImage && st.backgroundImage !== 'none') ||
            (st.backgroundColor &&
              st.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
              st.backgroundColor !== 'transparent' &&
              parseFloat(st.width) > 0 &&
              parseFloat(st.height) > 0) ||
            parseFloat(st.borderTopWidth) > 0 ||
            parseFloat(st.borderRightWidth) > 0 ||
            parseFloat(st.borderBottomWidth) > 0 ||
            parseFloat(st.borderLeftWidth) > 0;
          return Boolean(hasTextContent || hasMask || (c === '""' && hasVisibleBgOrBorder));
        };

        const checkItemSeparated = (li: Element, index: number): boolean => {
          const prevLi = items[index - 1];
          const link = li.querySelector(':scope > a')!;
          const prevLink = prevLi.querySelector(':scope > a')!;

          const liBefore = window.getComputedStyle(li, '::before');
          const prevLiAfter = window.getComputedStyle(prevLi, '::after');
          const linkBefore = window.getComputedStyle(link, '::before');
          const prevLinkAfter = window.getComputedStyle(prevLink, '::after');

          if (
            isPseudoActive(liBefore) ||
            isPseudoActive(prevLiAfter) ||
            isPseudoActive(linkBefore) ||
            isPseudoActive(prevLinkAfter)
          ) {
            return true;
          }

          // Check for shaped segment (corner-shape, border-shape, clip-path, or asymmetric/slanted radii)
          const linkStyle = window.getComputedStyle(link);
          const cornerShape = linkStyle.getPropertyValue('corner-shape').trim();
          const borderShape = linkStyle.getPropertyValue('border-shape').trim();
          const clipPath = linkStyle.clipPath;
          const hasAsymmetricRadius =
            linkStyle.borderTopLeftRadius.includes(' ') ||
            linkStyle.borderBottomRightRadius.includes(' ') ||
            linkStyle.borderTopRightRadius.includes(' ') ||
            linkStyle.borderBottomLeftRadius.includes(' ');

          return Boolean(
            (cornerShape && cornerShape !== 'round') ||
              (borderShape && borderShape !== 'none') ||
              (clipPath && clipPath !== 'none') ||
              hasAsymmetricRadius
          );
        };

        const firstLink = items[0].querySelector(':scope > a')!;
        const firstHasLeadingDivider =
          isPseudoActive(window.getComputedStyle(items[0], '::before')) ||
          isPseudoActive(window.getComputedStyle(firstLink, '::before'));

        const allAfterFirstSeparated =
          !firstHasLeadingDivider &&
          items.slice(1).every((li, idx) => checkItemSeparated(li, idx + 1));

        return {
          itemCount: items.length,
          allAfterFirstSeparated,
        };
      });

      expect(runtimeCheck).not.toBeNull();
      expect(runtimeCheck!.itemCount).toBeGreaterThanOrEqual(2);
      expect(runtimeCheck!.allAfterFirstSeparated).toBe(true);
    });

    test('Links in the trail show a visible focus indicator (non-zero outline or distinct style) when focused with the keyboard', async ({
      page,
    }) => {
      const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
      const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));
      const hasAuthorFocusRule = styleRules.some((rule) =>
        /:focus(-visible)?\b/.test(rule.selectorText || '')
      );
      expect(hasAuthorFocusRule).toBe(true);

      const linkLocator = page.locator('nav:has(ol) ol > li > a').first();
      expect(await linkLocator.count()).toBeGreaterThan(0);

      // Ensure unfocused initial state
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });

      const beforeFocus = await linkLocator.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return {
          outlineWidth: parseFloat(s.outlineWidth) || 0,
          outlineStyle: s.outlineStyle,
          outlineColor: s.outlineColor,
          backgroundColor: s.backgroundColor,
          color: s.color,
          boxShadow: s.boxShadow,
          textDecorationLine: s.textDecorationLine,
        };
      });

      // Focus the link via keyboard navigation or focus + Tab so :focus-visible triggers
      await linkLocator.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');

      // If focus didn't land on a breadcrumb link after Shift+Tab -> Tab, focus directly after keyboard modality is active
      const isFocusedInBreadcrumb = await page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(active && active.closest('nav')?.querySelector('ol'));
      });
      if (!isFocusedInBreadcrumb) {
        await linkLocator.focus();
      }

      const afterFocus = await linkLocator.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return {
          matchesFocusVisible: el.matches(':focus-visible'),
          outlineWidth: parseFloat(s.outlineWidth) || 0,
          outlineStyle: s.outlineStyle,
          outlineColor: s.outlineColor,
          backgroundColor: s.backgroundColor,
          color: s.color,
          boxShadow: s.boxShadow,
          textDecorationLine: s.textDecorationLine,
        };
      });

      const hasVisibleCustomOutline =
        afterFocus.outlineStyle !== 'none' &&
        afterFocus.outlineStyle !== 'auto' &&
        afterFocus.outlineWidth > 0;
      const hasDistinctStyle =
        afterFocus.backgroundColor !== beforeFocus.backgroundColor ||
        afterFocus.color !== beforeFocus.color ||
        afterFocus.boxShadow !== beforeFocus.boxShadow ||
        afterFocus.textDecorationLine !== beforeFocus.textDecorationLine;

      expect(afterFocus.matchesFocusVisible).toBe(true);
      expect(hasVisibleCustomOutline || hasDistinctStyle).toBe(true);
    });

    test('Hovering a non-current trail link changes its computed color, background color, or text decoration', async ({
      page,
    }) => {
      const nonCurrentLink = page
        .locator('nav:has(ol) ol > li > a:not([aria-current="page"])')
        .first();
      expect(await nonCurrentLink.count()).toBeGreaterThan(0);

      // Ensure the link is not hovered or focused before measuring rest styles
      await page.mouse.move(0, 0);
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });

      const getLinkVisualStyle = async () =>
        nonCurrentLink.evaluate((el) => {
          const s = window.getComputedStyle(el);
          return {
            color: s.color,
            backgroundColor: s.backgroundColor,
            textDecoration: s.textDecoration,
            textDecorationLine: s.textDecorationLine,
            textDecorationThickness: s.textDecorationThickness,
            textDecorationColor: s.textDecorationColor,
            textUnderlineOffset: s.textUnderlineOffset,
          };
        });

      const restStyle = await getLinkVisualStyle();

      await nonCurrentLink.hover();
      // Wait briefly in case a CSS transition is applied to color or background-color
      await page.waitForTimeout(350);

      const hoverStyle = await getLinkVisualStyle();

      const changed =
        hoverStyle.color !== restStyle.color ||
        hoverStyle.backgroundColor !== restStyle.backgroundColor ||
        hoverStyle.textDecoration !== restStyle.textDecoration ||
        hoverStyle.textDecorationLine !== restStyle.textDecorationLine ||
        hoverStyle.textDecorationThickness !== restStyle.textDecorationThickness ||
        hoverStyle.textDecorationColor !== restStyle.textDecorationColor ||
        hoverStyle.textUnderlineOffset !== restStyle.textUnderlineOffset;

      expect(changed).toBe(true);
    });

    test('The current-page link has a computed color or font weight different from the other trail links', async ({
      page,
    }) => {
      const stylesComparison = await page.evaluate(() => {
        const navs = Array.from(document.querySelectorAll('nav'));
        const bcNav = navs.find((n) => n.querySelector('ol'));
        if (!bcNav) return null;

        const allTrailLinks = Array.from(
          bcNav.querySelectorAll<HTMLAnchorElement>('ol > li > a')
        ).filter((a) => {
          const li = a.closest('li');
          return Boolean(li && !li.hidden && window.getComputedStyle(li).display !== 'none');
        });
        const currentLink =
          bcNav.querySelector<HTMLAnchorElement>('ol > li > a[aria-current="page"]') ||
          allTrailLinks[allTrailLinks.length - 1] ||
          null;
        const otherLinks = allTrailLinks.filter((a) => a !== currentLink);
        if (!currentLink || otherLinks.length === 0) return null;

        const curStyle = window.getComputedStyle(currentLink);
        const current = {
          color: curStyle.color,
          fontWeight: curStyle.fontWeight,
        };

        const others = otherLinks.map((a) => {
          const st = window.getComputedStyle(a);
          return {
            color: st.color,
            fontWeight: st.fontWeight,
          };
        });

        return { current, others };
      });

      expect(stylesComparison).not.toBeNull();
      const { current, others } = stylesComparison!;
      expect(others.length).toBeGreaterThan(0);

      const differsFromAllOthers = others.every(
        (other) =>
          current.color !== other.color || current.fontWeight !== other.fontWeight
      );
      expect(differsFromAllOthers).toBe(true);
    });

    test('When a trail uses shaped (arrow or slant) segments, inside an rtl container the shaped corners sit on the opposite physical side from the ltr container, through mirrored polygon() coordinates or logical corner radii', async ({
      page,
    }) => {
      // First verify breadcrumb exists on the page (ensures zero-passrate fails)
      const hasBreadcrumb = await page.locator('nav:has(ol) ol > li > a').count();
      expect(hasBreadcrumb).toBeGreaterThan(0);

      const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
      const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));

      // Determine whether the implementation uses shaped (arrow or slant) segments
      const shapeRules = styleRules.filter((rule) => {
        const cornerShape = rule.style.getPropertyValue('corner-shape') || '';
        const borderShape = rule.style.getPropertyValue('border-shape') || '';
        const clipPath = rule.style.getPropertyValue('clip-path') || '';
        const rawText = rule.cssText || '';
        return (
          cornerShape.includes('bevel') ||
          borderShape !== '' ||
          clipPath.includes('polygon') ||
          /polygon\s*\(/.test(rawText)
        );
      });

      if (shapeRules.length > 0) {
        // Check static CSS for logical corner radii or RTL polygon mirroring
        const usesLogicalCornerRadii = styleRules.some((rule) => {
          const s = rule.style;
          return Boolean(
            s.getPropertyValue('border-start-start-radius') ||
              s.getPropertyValue('border-end-end-radius') ||
              s.getPropertyValue('border-start-end-radius') ||
              s.getPropertyValue('border-end-start-radius')
          );
        });

        const usesRtlPolygonMirror = styleRules.some((rule) => {
          const sel = rule.selectorText || '';
          const text = rule.cssText || '';
          return (
            (sel.includes(':dir(rtl)') || sel.includes('[dir="rtl"]') || sel.includes("[dir='rtl']")) &&
            text.includes('polygon(')
          );
        });

        expect(usesLogicalCornerRadii || usesRtlPolygonMirror).toBe(true);

        // Verify in the browser that switching an ancestor container from dir="ltr" to dir="rtl" flips the physical corner radii or polygon shape
        const rtlComparison = await page.evaluate(() => {
          const navs = Array.from(document.querySelectorAll('nav'));
          const bcNav = navs.find((n) => n.querySelector('ol')) as HTMLElement | undefined;
          if (!bcNav) return null;

          const links = Array.from(bcNav.querySelectorAll<HTMLElement>('ol > li > a'));
          if (links.length === 0) return null;

          const dirTarget = bcNav.parentElement || document.documentElement;
          const prevDir = dirTarget.getAttribute('dir');

          const snapshotLinks = () =>
            links.map((link) => {
              const st = window.getComputedStyle(link);
              return {
                tl: st.borderTopLeftRadius,
                tr: st.borderTopRightRadius,
                br: st.borderBottomRightRadius,
                bl: st.borderBottomLeftRadius,
                clipPath: st.clipPath,
                borderShape: st.getPropertyValue('border-shape').trim(),
                shapeVar: st.getPropertyValue('--shape').trim(),
              };
            });

          dirTarget.setAttribute('dir', 'ltr');
          const ltrSnapshots = snapshotLinks();

          dirTarget.setAttribute('dir', 'rtl');
          const rtlSnapshots = snapshotLinks();

          if (prevDir === null) dirTarget.removeAttribute('dir');
          else dirTarget.setAttribute('dir', prevDir);

          // Check if physical top-left / top-right or bottom-left / bottom-right swapped or polygon changed
          const radiiMirrored = ltrSnapshots.some((ltr, i) => {
            const rtl = rtlSnapshots[i];
            return (
              (ltr.tl !== ltr.tr || ltr.bl !== ltr.br) &&
              ltr.tl === rtl.tr &&
              ltr.tr === rtl.tl &&
              ltr.bl === rtl.br &&
              ltr.br === rtl.bl
            );
          });

          const polygonMirrored = ltrSnapshots.some((ltr, i) => {
            const rtl = rtlSnapshots[i];
            return (
              (ltr.clipPath !== 'none' && ltr.clipPath !== rtl.clipPath) ||
              (ltr.borderShape !== '' && ltr.borderShape !== rtl.borderShape) ||
              (ltr.shapeVar !== '' && ltr.shapeVar !== rtl.shapeVar)
            );
          });

          return { radiiMirrored, polygonMirrored };
        });

        expect(rtlComparison).not.toBeNull();
        expect(rtlComparison!.radiiMirrored || rtlComparison!.polygonMirrored).toBe(true);
      } else {
        // When a trail does not use shaped segments, verify it uses a valid non-shaped separator
        const hasValidSeparator = styleRules.some((rule) => {
          const sel = rule.selectorText || '';
          const content = rule.style.getPropertyValue('content') || '';
          const mask =
            rule.style.getPropertyValue('mask') ||
            rule.style.getPropertyValue('mask-image') ||
            rule.style.getPropertyValue('-webkit-mask') ||
            rule.style.getPropertyValue('-webkit-mask-image') ||
            '';
          return (
            /::?(before|after)\b/.test(sel) &&
            ((content !== '' && content !== 'none' && content !== 'normal') || mask !== '')
          );
        });
        expect(hasValidSeparator).toBe(true);
      }
    });
  });
});
