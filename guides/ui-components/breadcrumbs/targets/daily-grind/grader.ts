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
      const items = Array.from(bcNav.querySelectorAll<HTMLLIElement>('ol > li')).filter(
        (li) => !li.hidden && li.querySelector('a')
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

  // Or try clicking a card's "View Details" link if prevented by JS
  const detailBtn = page.locator('.card a.btn').first();
  if ((await detailBtn.count()) > 0) {
    await detailBtn.click().catch(() => {});
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

  test('The <nav> contains an ordered list (<ol>) whose breadcrumb trail <li> items (excluding any collapsed overflow <li>) each contain an <a>', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const breadcrumbLists = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('nav ol'))
    );
    expect(breadcrumbLists.length).toBeGreaterThan(0);

    const ol = breadcrumbLists[0] as any;
    const allLiItems = Array.from(ol.children).filter(
      (el: any) => el.tagName?.toLowerCase() === 'li'
    );
    expect(allLiItems.length).toBeGreaterThan(0);

    // Filter out any collapsed overflow <li> (which typically holds a "..." toggle button and no trail link)
    const trailLiItems = allLiItems.filter((li: any) => {
      const hasOverflowButtonOnly =
        Boolean(li.querySelector('button')) && !li.querySelector('a');
      return !hasOverflowButtonOnly;
    });
    expect(trailLiItems.length).toBeGreaterThan(0);

    const everyItemHasAnchor = trailLiItems.every((li: any) =>
      Boolean(li.querySelector('a'))
    );
    expect(everyItemHasAnchor).toBe(true);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      await ensureMultiItemBreadcrumbTrail(page, TARGET_URL);
    });

    test('The last item\'s link has aria-current="page", and no other trail link has it', async ({
      page,
    }) => {
      const ariaCurrentState = await page.evaluate(() => {
        const navs = Array.from(document.querySelectorAll('nav'));
        const bcNav = navs.find((n) => n.querySelector('ol'));
        if (!bcNav) return null;

        const items = Array.from(bcNav.querySelectorAll<HTMLLIElement>('ol > li')).filter(
          (li) => !li.hidden && li.querySelector('a')
        );
        const links = items.map((li) => li.querySelector('a')!);
        return {
          count: links.length,
          ariaCurrents: links.map((a) => a.getAttribute('aria-current')),
        };
      });

      expect(ariaCurrentState).not.toBeNull();
      expect(ariaCurrentState!.count).toBeGreaterThan(0);

      const { ariaCurrents } = ariaCurrentState!;
      expect(ariaCurrents[ariaCurrents.length - 1]).toBe('page');
      for (let i = 0; i < ariaCurrents.length - 1; i++) {
        expect(ariaCurrents[i]).not.toBe('page');
      }
    });

    test('Divider characters are not present as text nodes in the DOM; when dividers are rendered between items, they are generated via CSS so the accessible names of the list items contain no divider characters', async ({
      page,
    }) => {
      // Static CSS check + runtime DOM check
      const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
      const styleRules = collectStyleRules(Array.from(stylesheet.cssRules));
      const hasCssGeneratedSeparatorOrShape = styleRules.some((rule) => {
        const sel = rule.selectorText || '';
        const contentVal = rule.style.getPropertyValue('content') || '';
        const maskVal =
          rule.style.getPropertyValue('mask') ||
          rule.style.getPropertyValue('mask-image') ||
          rule.style.getPropertyValue('-webkit-mask') ||
          rule.style.getPropertyValue('-webkit-mask-image') ||
          '';
        const cornerShapeVal = rule.style.getPropertyValue('corner-shape') || '';
        const borderShapeVal = rule.style.getPropertyValue('border-shape') || '';
        const clipPathVal = rule.style.getPropertyValue('clip-path') || '';

        const isPseudoWithAltOrMask =
          /::?(before|after)\b/.test(sel) &&
          (contentVal.includes('/') || maskVal.length > 0 || contentVal.length > 0);
        const isShapedSegment =
          cornerShapeVal.length > 0 ||
          borderShapeVal.length > 0 ||
          clipPathVal.includes('polygon');

        return isPseudoWithAltOrMask || isShapedSegment;
      });
      expect(hasCssGeneratedSeparatorOrShape).toBe(true);

      const domDividerCheck = await page.evaluate(() => {
        const navs = Array.from(document.querySelectorAll('nav'));
        const bcNav = navs.find((n) => n.querySelector('ol'));
        if (!bcNav) return null;

        const ol = bcNav.querySelector('ol')!;
        const dividerRegex = /[/›>»\\|]/;

        // Check direct text nodes inside <ol> and <li> (outside <a>) and inside <a>
        const hasDividerTextNode = (root: Node): boolean => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let node: Node | null;
          while ((node = walker.nextNode())) {
            const parentEl = node.parentElement;
            if (parentEl && parentEl.getAttribute('aria-hidden') === 'true') {
              // Still shouldn't be a raw text node divider in DOM per expectation
              if (dividerRegex.test((node.textContent || '').trim())) {
                return true;
              }
            }
            if (dividerRegex.test((node.textContent || '').trim())) {
              return true;
            }
          }
          return false;
        };

        const items = Array.from(ol.querySelectorAll<HTMLLIElement>(':scope > li')).filter(
          (li) => !li.hidden && li.querySelector('a')
        );

        return {
          itemCount: items.length,
          hasDomDividerText: hasDividerTextNode(ol),
          itemTexts: items.map((li) => (li.textContent || '').trim()),
        };
      });

      expect(domDividerCheck).not.toBeNull();
      expect(domDividerCheck!.itemCount).toBeGreaterThanOrEqual(2);
      expect(domDividerCheck!.hasDomDividerText).toBe(false);
      for (const text of domDividerCheck!.itemTexts) {
        expect(text).not.toMatch(/[/›>»\\|]/);
      }
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
          (li) => !li.hidden && li.querySelector('a')
        );
        if (items.length < 2) return { itemCount: items.length, allAfterFirstSeparated: false };

        const checkItemSeparated = (li: Element, index: number): boolean => {
          const prevLi = items[index - 1];
          const link = li.querySelector('a')!;

          const liBefore = window.getComputedStyle(li, '::before');
          const liAfter = window.getComputedStyle(li, '::after');
          const prevLiAfter = window.getComputedStyle(prevLi, '::after');
          const linkBefore = window.getComputedStyle(link, '::before');

          const isPseudoActive = (st: CSSStyleDeclaration) => {
            const c = st.content;
            const hasContent = c && c !== 'none' && c !== 'normal' && c !== '""' && c !== "''";
            const hasMask =
              (st.maskImage && st.maskImage !== 'none') ||
              (st.webkitMaskImage && st.webkitMaskImage !== 'none');
            const hasBgOrBorder =
              (st.backgroundImage && st.backgroundImage !== 'none') ||
              parseFloat(st.borderTopWidth) > 0 ||
              parseFloat(st.borderRightWidth) > 0 ||
              parseFloat(st.width) > 0;
            return Boolean(hasContent || hasMask || (c === '""' && hasBgOrBorder));
          };

          if (
            isPseudoActive(liBefore) ||
            isPseudoActive(liAfter) ||
            isPseudoActive(prevLiAfter) ||
            isPseudoActive(linkBefore)
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

        const allAfterFirstSeparated = items
          .slice(1)
          .every((li, idx) => checkItemSeparated(li, idx + 1));

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

      const hasVisibleOutline =
        afterFocus.outlineStyle !== 'none' && afterFocus.outlineWidth > 0;
      const hasDistinctStyle =
        afterFocus.backgroundColor !== beforeFocus.backgroundColor ||
        afterFocus.color !== beforeFocus.color ||
        afterFocus.boxShadow !== beforeFocus.boxShadow ||
        afterFocus.textDecorationLine !== beforeFocus.textDecorationLine;

      expect(hasVisibleOutline || hasDistinctStyle).toBe(true);
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

        const currentLink = bcNav.querySelector('ol > li > a[aria-current="page"]');
        const otherLinks = Array.from(
          bcNav.querySelectorAll('ol > li > a:not([aria-current="page"])')
        );
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

        // Also verify in the browser that switching dir="ltr" to dir="rtl" flips the physical corner radii or polygon shape
        const rtlComparison = await page.evaluate(() => {
          const navs = Array.from(document.querySelectorAll('nav'));
          const bcNav = navs.find((n) => n.querySelector('ol')) as HTMLElement | undefined;
          if (!bcNav) return null;

          const link = bcNav.querySelector('ol > li:last-child > a') as HTMLElement | null;
          if (!link) return null;

          const prevDir = bcNav.getAttribute('dir');
          bcNav.setAttribute('dir', 'ltr');
          const ltrStyle = window.getComputedStyle(link);
          const ltrSnapshot = {
            tl: ltrStyle.borderTopLeftRadius,
            tr: ltrStyle.borderTopRightRadius,
            br: ltrStyle.borderBottomRightRadius,
            bl: ltrStyle.borderBottomLeftRadius,
            clipPath: ltrStyle.clipPath,
            borderShape: ltrStyle.getPropertyValue('border-shape').trim(),
            shapeVar: ltrStyle.getPropertyValue('--shape').trim(),
          };

          bcNav.setAttribute('dir', 'rtl');
          const rtlStyle = window.getComputedStyle(link);
          const rtlSnapshot = {
            tl: rtlStyle.borderTopLeftRadius,
            tr: rtlStyle.borderTopRightRadius,
            br: rtlStyle.borderBottomRightRadius,
            bl: rtlStyle.borderBottomLeftRadius,
            clipPath: rtlStyle.clipPath,
            borderShape: rtlStyle.getPropertyValue('border-shape').trim(),
            shapeVar: rtlStyle.getPropertyValue('--shape').trim(),
          };

          if (prevDir === null) bcNav.removeAttribute('dir');
          else bcNav.setAttribute('dir', prevDir);

          // Check if physical top-left / top-right or bottom-left / bottom-right swapped or polygon changed
          const radiiMirrored =
            (ltrSnapshot.tl !== ltrSnapshot.tr || ltrSnapshot.bl !== ltrSnapshot.br) &&
            ltrSnapshot.tl === rtlSnapshot.tr &&
            ltrSnapshot.tr === rtlSnapshot.tl &&
            ltrSnapshot.bl === rtlSnapshot.br &&
            ltrSnapshot.br === rtlSnapshot.bl;

          const polygonMirrored =
            (ltrSnapshot.clipPath !== 'none' && ltrSnapshot.clipPath !== rtlSnapshot.clipPath) ||
            (ltrSnapshot.borderShape !== '' && ltrSnapshot.borderShape !== rtlSnapshot.borderShape) ||
            (ltrSnapshot.shapeVar !== '' && ltrSnapshot.shapeVar !== rtlSnapshot.shapeVar);

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
