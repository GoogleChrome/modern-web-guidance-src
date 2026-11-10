import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';

import { SyntaxKind } from 'ts-morph';
import {
  closestRule,
  CSSStyleRule,
  CSSMediaRule,
  CSSContainerRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function hasNavSingleLineOverflowHandling(
  stylesheet: CSSStyleSheet,
  docs: Array<{ file: string; document: any }>
): boolean {
  const styleRules = getRules(stylesheet, CSSStyleRule);
  const navRules = styleRules.filter(r => /(^|\s|,|>|\+)nav\b/.test(r.selectorText));

  const hasNowrap = navRules.some(r => {
    const ws = r.style.getPropertyValue('white-space');
    const tw = r.style.getPropertyValue('text-wrap');
    return ws.includes('nowrap') || tw.includes('nowrap');
  }) || docs.some(d => Boolean(d.document.querySelector('nav .whitespace-nowrap, nav [class*="nowrap"]')));

  const hasOverflowOrShrink = navRules.some(r => {
    const ov = r.style.getPropertyValue('overflow') || r.style.getPropertyValue('overflow-x');
    const mis = r.style.getPropertyValue('min-inline-size') || r.style.getPropertyValue('min-width');
    return (Boolean(ov) && ov !== 'visible') || mis === '0' || mis === '0px';
  }) || docs.some(d => Boolean(d.document.querySelector('nav [class*="overflow"], nav [class*="min-w-0"]')));

  return hasNowrap && hasOverflowOrShrink;
}

test.describe('Single-line text overflow Target Grader', () => {

  test('The full text of a truncated element remains in the DOM and is not shortened by string manipulation', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const navLinks = docs.flatMap(d => Array.from(d.document.querySelectorAll('nav a')));
    expect(navLinks.length).toBeGreaterThanOrEqual(5);

    const linkTexts = navLinks.map((l: any) => (l.textContent || '').trim());
    const expectedLabels = ['Menu', 'Locations', 'Rewards', 'My Account', 'Logout'];
    const allLabelsPresent = expectedLabels.every(label =>
      linkTexts.some(text => text.includes(label))
    );
    expect(allLabelsPresent, 'Full text of navigation items must remain intact in the DOM').toBe(true);

    const project = getJsProject(targetFiles);
    const callExprs = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );
    const hasStringSliceTruncation = callExprs.some(call => {
      const exprText = call.getExpression().getText();
      return (
        (exprText.endsWith('.slice') || exprText.endsWith('.substring') || exprText.endsWith('.substr')) &&
        call.getArguments().length > 0
      );
    });
    expect(hasStringSliceTruncation, 'Text should not be shortened via string manipulation').toBe(false);
  });

  test('Text that must stay on one line is kept from wrapping with nowrap and clipped with overflow on the element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const navRules = styleRules.filter(r => /(^|\s|,|>|\+)nav\b/.test(r.selectorText));

    const hasNowrap = navRules.some(r => {
      const ws = r.style.getPropertyValue('white-space');
      const tw = r.style.getPropertyValue('text-wrap');
      return ws.includes('nowrap') || tw.includes('nowrap');
    }) || docs.some(d => Boolean(d.document.querySelector('nav a.whitespace-nowrap, nav a[class*="nowrap"]')));
    expect(hasNowrap, 'Text must be kept from wrapping with white-space: nowrap or text-wrap: nowrap').toBe(true);

    const hasOverflowHandling = navRules.some(r => {
      const ov = r.style.getPropertyValue('overflow') || r.style.getPropertyValue('overflow-x');
      return ov === 'hidden' || ov === 'clip' || ov === 'auto';
    }) || docs.some(d => Boolean(d.document.querySelector('nav a[class*="overflow-hidden"], nav [class*="overflow-x-auto"]')));
    expect(hasOverflowHandling, 'Text or container must handle overflow via clipping (overflow: hidden) or scrolling').toBe(true);
  });

  test('Clipped text is marked with text-overflow: ellipsis or an end fade drawn with a mask', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const navRules = styleRules.filter(r => /(^|\s|,|>|\+)nav\b/.test(r.selectorText));

    const hasEllipsisOrFade = navRules.some(r => {
      const to = r.style.getPropertyValue('text-overflow');
      const mask = r.style.getPropertyValue('mask') || r.style.getPropertyValue('-webkit-mask');
      const ox = r.style.getPropertyValue('overflow-x') || r.style.getPropertyValue('overflow');
      return to.includes('ellipsis') || (Boolean(mask) && mask.includes('gradient')) || ox.includes('auto');
    }) || docs.some(d => Boolean(d.document.querySelector('nav [class*="truncate"], nav [class*="ellipsis"], nav [class*="overflow-x-auto"]')));

    expect(hasEllipsisOrFade, 'Clipped text must be marked with text-overflow: ellipsis, an end fade mask, or horizontal scrolling').toBe(true);
  });

  test('When an end fade is used, it is visible only when the text actually overflows', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const navRules = styleRules.filter(r => /(^|\s|,|>|\+)nav\b/.test(r.selectorText));

    const usesMaskFade = navRules.some(r => {
      const mask = r.style.getPropertyValue('mask') || r.style.getPropertyValue('-webkit-mask');
      return Boolean(mask) && mask.includes('gradient');
    });

    if (usesMaskFade) {
      const hasOverflowConditioning = navRules.some(r => {
        const animTimeline = r.style.getPropertyValue('animation-timeline');
        const anim = r.style.getPropertyValue('animation');
        return animTimeline.includes('scroll') || anim.includes('truncated');
      });
      expect(hasOverflowConditioning, 'End fade mask must be active only when text overflows').toBe(true);
    } else {
      expect(usesMaskFade).toBe(false);
    }
  });

  test('When a shorter version replaces the text, the short version is hidden from assistive technology and full version stays in accessibility tree', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const navLinks = docs.flatMap(d => Array.from(d.document.querySelectorAll('nav a')));
    const shortEls = docs.flatMap(d =>
      Array.from(d.document.querySelectorAll('nav a [aria-hidden="true"], nav a .short'))
    );

    if (shortEls.length > 0) {
      const allHiddenFromAT = shortEls.every((el: any) => el.getAttribute('aria-hidden') === 'true');
      expect(allHiddenFromAT, 'Short text version must be hidden from assistive technology with aria-hidden="true"').toBe(true);
    } else {
      const linksAriaHidden = navLinks.some((l: any) => l.getAttribute('aria-hidden') === 'true');
      expect(linksAriaHidden, 'Full navigation links must remain accessible in the accessibility tree').toBe(false);
    }
  });

  test('Flex and grid items that contain truncated text can shrink below their content size', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const flexItemRules = styleRules.filter(r => /(^|\s|,|>|\+)nav\s+(ul|li|a)\b/.test(r.selectorText));

    const canShrink = flexItemRules.some(r => {
      const mis = r.style.getPropertyValue('min-inline-size');
      const mw = r.style.getPropertyValue('min-width');
      const ov = r.style.getPropertyValue('overflow') || r.style.getPropertyValue('overflow-x');
      return mis === '0' || mis === '0px' || mw === '0' || mw === '0px' || (Boolean(ov) && ov !== 'visible');
    }) || docs.some(d => Boolean(d.document.querySelector('nav [class*="min-w-0"], nav [class*="min-inline-0"], nav [class*="overflow"]')));

    expect(
      canShrink,
      'Flex/grid items containing truncated text must allow shrinking via min-inline-size: 0, min-width: 0, or overflow != visible'
    ).toBe(true);
  });

  test('Focus outlines of focusable elements that contain truncated text are not clipped', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const navRules = styleRules.filter(r => /(^|\s|,|>|\+)nav\b/.test(r.selectorText));

    const ancestorClipsOverflow = navRules.some(r => {
      const isAncestor = /nav\s+ul\b/.test(r.selectorText);
      const ov = r.style.getPropertyValue('overflow') || r.style.getPropertyValue('overflow-x');
      return isAncestor && (ov === 'hidden' || ov === 'auto' || ov === 'scroll');
    });

    const focusRules = navRules.filter(r =>
      r.selectorText.includes(':focus') || r.selectorText.includes(':focus-visible')
    );
    const hasOutlineOffset = focusRules.some(r => r.style.getPropertyValue('outline-offset') !== '');

    const outlineNotClipped = !ancestorClipsOverflow || hasOutlineOffset;
    expect(
      outlineNotClipped,
      'Focus outlines must not be clipped by overflowing ancestors; use inset outline-offset or direct element truncation'
    ).toBe(true);
  });

  test('Whether text is truncated is derived from overflow rather than character counts or scroll-state queries', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const containerRules = getRules(stylesheet, CSSContainerRule);
    const hasScrollStateQuery = containerRules.some(r =>
      r.conditionText.includes('scroll-state') || r.conditionText.includes('scrollable')
    );
    expect(hasScrollStateQuery, 'Must not use scroll-state queries for truncation detection').toBe(false);

    const hasScrollAnimation = styleRules.some(r => {
      const timeline = r.style.getPropertyValue('animation-timeline');
      return timeline.includes('scroll') && timeline.includes('inline');
    });

    const project = getJsProject(targetFiles);
    const binaryExprs = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    );
    const hasScrollWidthComparison = binaryExprs.some(expr => {
      const text = expr.getText();
      return text.includes('scrollWidth') && text.includes('clientWidth');
    });

    const hasScrollContainer = styleRules.some(r => {
      const ox = r.style.getPropertyValue('overflow-x') || r.style.getPropertyValue('overflow');
      return ox.includes('auto');
    });

    const derivesFromOverflow = hasScrollAnimation || hasScrollWidthComparison || hasScrollContainer;
    expect(
      derivesFromOverflow,
      'Truncation state must be derived from overflow (scroll-driven animation, scrollWidth > clientWidth, or native scrolling)'
    ).toBe(true);
  });

  test('When the full text is revealed on hover, it is also revealed on keyboard focus', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const navHoverRules = styleRules.filter(r =>
      /(^|\s|,|>|\+)nav\b/.test(r.selectorText) && r.selectorText.includes(':hover')
    );

    const textRevealHoverRules = navHoverRules.filter(r => {
      const to = r.style.getPropertyValue('text-overflow');
      const mis = r.style.getPropertyValue('margin-inline-start') || r.style.getPropertyValue('margin-left');
      const tr = r.style.getPropertyValue('translate') || r.style.getPropertyValue('transform');
      const mxis = r.style.getPropertyValue('max-inline-size') || r.style.getPropertyValue('max-width');
      const fs = r.style.getPropertyValue('--fade-size');
      return Boolean(to) || Boolean(mis) || Boolean(tr) || Boolean(mxis) || Boolean(fs);
    });

    const pairedWithFocus = textRevealHoverRules.every(r => {
      const sel = r.selectorText;
      return sel.includes(':focus-visible') || sel.includes(':focus');
    });
    expect(
      pairedWithFocus,
      'When full text is revealed on hover, it must also be revealed on keyboard focus (:focus-visible or :focus)'
    ).toBe(true);
  });

  test('Motion that reveals the full text is applied only under prefers-reduced-motion: no-preference', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const revealMotionRules = styleRules.filter(r => {
      const trans = r.style.getPropertyValue('transition') || r.style.getPropertyValue('transition-property');
      return (
        trans.includes('margin') ||
        trans.includes('translate') ||
        trans.includes('transform') ||
        trans.includes('inline-size') ||
        trans.includes('--fade-size')
      );
    });

    const motionGatedOnNoPreference = revealMotionRules.every(r => {
      const media = closestRule(r, CSSMediaRule);
      return (
        media?.conditionText.includes('prefers-reduced-motion: no-preference') ||
        media?.conditionText.includes('prefers-reduced-motion')
      );
    });
    expect(
      motionGatedOnNoPreference,
      'Motion that reveals full text must be applied only under prefers-reduced-motion: no-preference'
    ).toBe(true);
  });

  test('When an end fade is used and scroll-driven animations are unsupported, the fade is applied through a class toggled from scrollWidth to clientWidth comparison', () => {
    const docs = getHtmlDocuments(targetFiles);
    const stylesheet = getCssStyleSheet(targetFiles);

    expect(
      hasNavSingleLineOverflowHandling(stylesheet, docs),
      'Navigation items must be configured for single-line overflow'
    ).toBe(true);

    const styleRules = getRules(stylesheet, CSSStyleRule);
    const usesMaskFade = styleRules.some(r => {
      const mask = r.style.getPropertyValue('mask') || r.style.getPropertyValue('-webkit-mask');
      return Boolean(mask) && mask.includes('gradient');
    });

    const project = getJsProject(targetFiles);
    const binaryExprs = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    );
    const hasScrollComparison = binaryExprs.some(expr => {
      const text = expr.getText();
      return text.includes('scrollWidth') && text.includes('clientWidth');
    });

    const validFadeFallback = !usesMaskFade || hasScrollComparison;
    expect(
      validFadeFallback,
      'When an end fade is used without scroll-driven animations, it must be applied via scrollWidth to clientWidth comparison'
    ).toBe(true);
  });
});
