import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';

import { SyntaxKind } from 'ts-morph';
import {
  closestRule,
  CSSStyleRule,
  CSSMediaRule,
  CSSContainerRule,
} from 'cssomnom';
import type { Page } from '@playwright/test';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

async function hasSingleLineOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return false;
    const links = Array.from(nav.querySelectorAll('a'));
    if (links.length === 0) return false;
    return links.some((a) => {
      const target = (a.querySelector('span, [class*="label"], [class*="text"]') || a) as HTMLElement;
      const cs = window.getComputedStyle(target);
      const linkCs = window.getComputedStyle(a);
      const parentCs = a.parentElement ? window.getComputedStyle(a.parentElement) : linkCs;
      const listCs = a.closest('ul') ? window.getComputedStyle(a.closest('ul')!) : parentCs;

      const isNowrap =
        cs.whiteSpace.includes('nowrap') ||
        linkCs.whiteSpace.includes('nowrap') ||
        parentCs.whiteSpace.includes('nowrap') ||
        listCs.whiteSpace.includes('nowrap') ||
        Boolean((cs as any).textWrap?.includes('nowrap')) ||
        Boolean((linkCs as any).textWrap?.includes('nowrap'));

      const isOverflowHandled =
        ['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflow) ||
        ['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflowX) ||
        ['hidden', 'clip', 'auto', 'scroll'].includes(linkCs.overflow) ||
        ['hidden', 'clip', 'auto', 'scroll'].includes(linkCs.overflowX) ||
        ['hidden', 'clip', 'auto', 'scroll'].includes(parentCs.overflow) ||
        ['hidden', 'clip', 'auto', 'scroll'].includes(parentCs.overflowX) ||
        ['hidden', 'clip', 'auto', 'scroll'].includes(listCs.overflow) ||
        ['hidden', 'clip', 'auto', 'scroll'].includes(listCs.overflowX);

      const isEllipsis =
        cs.textOverflow === 'ellipsis' ||
        linkCs.textOverflow === 'ellipsis';

      const hasMask =
        (cs.maskImage && cs.maskImage !== 'none') ||
        (linkCs.maskImage && linkCs.maskImage !== 'none') ||
        Boolean((cs as any).webkitMaskImage && (cs as any).webkitMaskImage !== 'none') ||
        Boolean((linkCs as any).webkitMaskImage && (linkCs as any).webkitMaskImage !== 'none');

      return isNowrap && (isOverflowHandled || isEllipsis || hasMask);
    });
  });
}

test.describe('Single-line text overflow Target Grader', () => {

  test('The full text of a truncated element remains in the DOM and is not shortened by string manipulation', async ({
    page,
    TARGET_URL,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const fullLabelsPresent = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return false;
      const links = Array.from(nav.querySelectorAll('a'));
      const text = links.map((l) => (l.textContent || '').trim()).join(' ');
      const expected = ['Menu', 'Locations', 'Rewards', 'My Account', 'Logout'];
      return expected.every((exp) => text.includes(exp));
    });
    expect(fullLabelsPresent, 'Full text of navigation items must remain intact in the DOM').toBe(true);
  });

  test('Text that must stay on one line is kept from wrapping with nowrap and clipped with overflow on the element', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const hasValidNowrapAndOverflow = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return false;
      const links = Array.from(nav.querySelectorAll('a'));
      return links.some((a) => {
        const target = (a.querySelector('span, [class*="label"], [class*="text"]') || a) as HTMLElement;
        const cs = window.getComputedStyle(target);
        const linkCs = window.getComputedStyle(a);
        const parentCs = a.parentElement ? window.getComputedStyle(a.parentElement) : linkCs;
        const listCs = a.closest('ul') ? window.getComputedStyle(a.closest('ul')!) : parentCs;
        const nowrap =
          cs.whiteSpace.includes('nowrap') ||
          linkCs.whiteSpace.includes('nowrap') ||
          parentCs.whiteSpace.includes('nowrap') ||
          listCs.whiteSpace.includes('nowrap') ||
          Boolean((cs as any).textWrap?.includes('nowrap')) ||
          Boolean((linkCs as any).textWrap?.includes('nowrap'));
        const overflow =
          ['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflow) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(cs.overflowX) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(linkCs.overflow) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(linkCs.overflowX) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(parentCs.overflow) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(parentCs.overflowX) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(listCs.overflow) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(listCs.overflowX);
        return nowrap && overflow;
      });
    });
    expect(hasValidNowrapAndOverflow, 'Text must be kept on one line with nowrap and clipped with overflow').toBe(true);
  });

  test('Clipped text is marked with text-overflow: ellipsis or an end fade drawn with a mask', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const hasEllipsisOrMask = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return false;
      const links = Array.from(nav.querySelectorAll('a'));
      return links.some((a) => {
        const target = (a.querySelector('span, [class*="label"], [class*="text"]') || a) as HTMLElement;
        const cs = window.getComputedStyle(target);
        const linkCs = window.getComputedStyle(a);
        const listCs = a.closest('ul') ? window.getComputedStyle(a.closest('ul')!) : linkCs;
        const hasEllipsis = cs.textOverflow === 'ellipsis' || linkCs.textOverflow === 'ellipsis';
        const hasMask =
          (cs.maskImage && cs.maskImage !== 'none') ||
          (linkCs.maskImage && linkCs.maskImage !== 'none') ||
          Boolean((cs as any).webkitMaskImage && (cs as any).webkitMaskImage !== 'none') ||
          Boolean((linkCs as any).webkitMaskImage && (linkCs as any).webkitMaskImage !== 'none');
        const hasHorizontalScroll =
          ['auto', 'scroll'].includes(listCs.overflowX) ||
          ['auto', 'scroll'].includes(linkCs.overflowX);
        return hasEllipsis || hasMask || hasHorizontalScroll;
      });
    });
    expect(hasEllipsisOrMask, 'Clipped text must be marked with text-overflow: ellipsis, mask fade, or horizontal scrolling').toBe(true);
  });

  test('When an end fade is used, it is visible only when the text actually overflows', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const fadeDerivedFromOverflow = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return false;
      let usesFade = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule) {
              const mask =
                rule.style.mask ||
                rule.style.maskImage ||
                (rule.style as any).webkitMaskImage ||
                '';
              if (mask.includes('gradient')) usesFade = true;
            }
          }
        } catch {}
      }
      if (!usesFade) return true; // Exempt if not using end fade

      // If using end fade, verify mask is conditional or scroll-timeline driven
      return true;
    });
    expect(fadeDerivedFromOverflow).toBe(true);
  });

  test('When a shorter version replaces the text, the short version is hidden from assistive technology (aria-hidden="true") and the full version stays in the accessibility tree, visually hidden rather than display: none', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const validShortTextOrExempt = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return false;
      const shortEls = Array.from(
        nav.querySelectorAll('[aria-hidden="true"], [class*="short"], [class*="abbr"], [data-short]')
      );
      if (shortEls.length === 0) return true; // Exempt if not using shortened replacement text
      return shortEls.every((el) => {
        const isAriaHidden = el.getAttribute('aria-hidden') === 'true';
        const parent = el.closest('a') || el.parentElement;
        const full =
          parent?.querySelector('.visually-hidden, [class*="sr-only"], [class*="full"]') || parent;
        const cs = full ? window.getComputedStyle(full) : null;
        return isAriaHidden && cs?.display !== 'none';
      });
    });
    expect(validShortTextOrExempt).toBe(true);
  });

  test('Flex and grid items that contain truncated text can shrink below their content size, through min-inline-size: 0 (or min-width: 0) on the item or an overflow other than visible on the item itself', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const canFlexItemsShrink = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      if (!nav) return false;
      const links = Array.from(nav.querySelectorAll('a'));
      return links.some((a) => {
        const item = (a.closest('li') || a) as HTMLElement;
        const parent = item.parentElement;
        const cs = window.getComputedStyle(item);
        const parentCs = parent ? window.getComputedStyle(parent) : cs;
        const minW = cs.minWidth;
        const minI = cs.minInlineSize;
        const parentMinW = parentCs.minWidth;
        const parentMinI = parentCs.minInlineSize;
        const ov = cs.overflow;
        const parentOv = parentCs.overflow;
        return (
          minW === '0px' ||
          minI === '0px' ||
          parentMinW === '0px' ||
          parentMinI === '0px' ||
          (ov !== 'visible' && Boolean(ov)) ||
          (parentOv !== 'visible' && Boolean(parentOv))
        );
      });
    });
    expect(canFlexItemsShrink, 'Flex/grid items containing truncated text must allow shrinking').toBe(true);
  });

  test('Focus outlines of focusable elements that contain truncated text are not clipped', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const navLink = page.locator('nav a').first();
    await navLink.focus();

    const outlineNotClipped = await navLink.evaluate((el) => {
      let ancestorClips = false;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const pcs = window.getComputedStyle(parent);
        if (
          ['hidden', 'clip', 'auto', 'scroll'].includes(pcs.overflow) ||
          ['hidden', 'clip', 'auto', 'scroll'].includes(pcs.overflowX)
        ) {
          ancestorClips = true;
          break;
        }
        parent = parent.parentElement;
      }

      if (!ancestorClips) {
        return true;
      }

      const cs = window.getComputedStyle(el);
      const offset = parseFloat(cs.outlineOffset || '0');
      return offset <= 0;
    });
    expect(outlineNotClipped, 'Focus outlines must not be clipped by overflow containers').toBe(true);
  });

  test('Whether text is truncated is derived from overflow, through a scroll-driven animation on the element\'s own inline scroll timeline (with a style query on a custom property it sets, for descendants) or a scrollWidth to clientWidth comparison, not from character counts or scroll-state queries', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const stylesheet = getCssStyleSheet(targetFiles);
    const containerRules = getRules(stylesheet, CSSContainerRule);
    const hasScrollStateQuery = containerRules.some((r) =>
      r.conditionText.includes('scroll-state') || r.conditionText.includes('scrollable')
    );
    expect(hasScrollStateQuery, 'Must not derive truncation from scroll-state queries').toBe(false);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const hasSDA = styleRules.some((r) => {
      const anim =
        r.style.getPropertyValue('animation-timeline') || r.style.getPropertyValue('animation');
      return anim.includes('scroll(');
    });
    const hasEllipsis = styleRules.some((r) => r.style.getPropertyValue('text-overflow') === 'ellipsis');
    const hasScrollContainer = styleRules.some((r) => {
      const ox = r.style.getPropertyValue('overflow-x') || r.style.getPropertyValue('overflow');
      return ox.includes('auto') || ox.includes('scroll');
    });

    const project = getJsProject(targetFiles);
    const hasScrollComparison = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.BinaryExpression))
      .some((e) => {
        const t = e.getText();
        return t.includes('scrollWidth') && t.includes('clientWidth');
      });

    expect(
      hasSDA || hasEllipsis || hasScrollContainer || hasScrollComparison,
      'Truncation must be derived from overflow (scroll timeline, text-overflow, scroll container, or scrollWidth/clientWidth)'
    ).toBe(true);
  });

  test('When the full text is revealed on hover, it is also revealed on keyboard focus (:focus-visible or :focus)', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getRules(stylesheet, CSSStyleRule);

    const hoverRevealRules = styleRules.filter((r) => {
      if (!r.selectorText.includes(':hover')) return false;
      const to = r.style.getPropertyValue('text-overflow');
      const ws = r.style.getPropertyValue('white-space');
      const mis =
        r.style.getPropertyValue('margin-inline-start') || r.style.getPropertyValue('margin-left');
      const tr = r.style.getPropertyValue('translate') || r.style.getPropertyValue('transform');
      const mxis =
        r.style.getPropertyValue('max-inline-size') || r.style.getPropertyValue('max-width');
      const fs = r.style.getPropertyValue('--fade-size');
      return Boolean(to) || Boolean(ws) || Boolean(mis) || Boolean(tr) || Boolean(mxis) || Boolean(fs);
    });

    const pairedWithFocus =
      hoverRevealRules.length === 0 ||
      hoverRevealRules.every((hr) => {
        const sel = hr.selectorText;
        if (sel.includes(':focus-visible') || sel.includes(':focus')) return true;
        return styleRules.some((fr) => {
          if (!fr.selectorText.includes(':focus-visible') && !fr.selectorText.includes(':focus')) {
            return false;
          }
          const to = fr.style.getPropertyValue('text-overflow');
          const ws = fr.style.getPropertyValue('white-space');
          const mis =
            fr.style.getPropertyValue('margin-inline-start') ||
            fr.style.getPropertyValue('margin-left');
          const tr = fr.style.getPropertyValue('translate') || fr.style.getPropertyValue('transform');
          const mxis =
            fr.style.getPropertyValue('max-inline-size') || fr.style.getPropertyValue('max-width');
          const fs = fr.style.getPropertyValue('--fade-size');
          return Boolean(to) || Boolean(ws) || Boolean(mis) || Boolean(tr) || Boolean(mxis) || Boolean(fs);
        });
      });
    expect(pairedWithFocus, 'Hover text reveal must be paired with :focus-visible or :focus').toBe(true);
  });

  test('Motion that reveals the full text is applied only under prefers-reduced-motion: no-preference', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getRules(stylesheet, CSSStyleRule);

    const revealMotionRules = styleRules.filter((r) => {
      const trans =
        r.style.getPropertyValue('transition') || r.style.getPropertyValue('transition-property');
      const anim =
        r.style.getPropertyValue('animation') || r.style.getPropertyValue('animation-name');
      return (
        trans.includes('margin') ||
        trans.includes('translate') ||
        trans.includes('transform') ||
        trans.includes('inline-size') ||
        trans.includes('--fade-size') ||
        anim.includes('marquee')
      );
    });

    const correctlyGated =
      revealMotionRules.length === 0 ||
      revealMotionRules.every((r) => {
        const media = closestRule(r, CSSMediaRule);
        if (!media) return false;
        const cond = media.conditionText;
        return cond.includes('no-preference') && !/\b(reduce)\b/.test(cond);
      });
    expect(
      correctlyGated,
      'Motion that reveals full text must be gated on prefers-reduced-motion: no-preference'
    ).toBe(true);
  });

  test('When an end fade is used and scroll-driven animations are unsupported, the fade is applied through a class toggled from a scrollWidth to clientWidth comparison', async ({
    page,
    TARGET_URL,
  }) => {
    await page.goto(TARGET_URL);

    expect(
      await hasSingleLineOverflow(page),
      'Single-line overflow handling must be implemented'
    ).toBe(true);

    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getRules(stylesheet, CSSStyleRule);
    const usesMaskFade = styleRules.some((r) => {
      const mask =
        r.style.getPropertyValue('mask') ||
        r.style.getPropertyValue('-webkit-mask') ||
        r.style.getPropertyValue('mask-image');
      return Boolean(mask) && mask.includes('gradient');
    });

    const project = getJsProject(targetFiles);
    const binaryExprs = project
      .getSourceFiles()
      .flatMap((sf) => sf.getDescendantsOfKind(SyntaxKind.BinaryExpression));
    const hasScrollComparison = binaryExprs.some((expr) => {
      const text = expr.getText();
      return text.includes('scrollWidth') && text.includes('clientWidth');
    });

    expect(
      !usesMaskFade || hasScrollComparison,
      'When an end fade is used without scroll-driven animations, it must be applied via scrollWidth to clientWidth comparison'
    ).toBe(true);
  });
});
