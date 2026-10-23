// Expectation Relevance Assessment:
// 1: SKIPPED - Base application already uses `display: flex` on `nav` and `nav ul`.
// 2: TESTED - Base application uses `margin-left: 20px` on `nav ul li` instead of `gap` on `nav ul`.
// 3: SKIPPED - No individual flex item sizing (`flex-grow`/`flex-shrink`/`flex-basis`) exists or is needed in the base application.
// 4: TESTED - Flex containers `nav` and `nav ul` lack `flex-wrap: wrap` (or `flex-flow`) in the base application.
// 5: SKIPPED - `nav` uses `justify-content: space-between` rather than pushing an item with `justify-self`.
// 6: TESTED - Flex containers in the base application use unsafe `align-items: center` instead of `safe center`.
// 7: SKIPPED - Base application does not contain flex items with long unbreakable URLs or code strings.
// 8: SKIPPED - Base application does not declare `flex-basis` or conflicting widths on flex items.
// 9: SKIPPED - Base application does not reorder interactive content and has no requirement to do so.
// 10: SKIPPED - Base application already uses `display: grid` on `.grid`.
// 11: SKIPPED - Base application is a simple single-column flow without a multi-region sidebar/shell layout.
// 12: SKIPPED - Base application already uses `repeat(auto-fit, minmax(250px, 1fr))` on `.grid`.
// 13: SKIPPED - Base application already uses `auto-fit` on `.grid`.
// 14: SKIPPED - Base application already uses `minmax(250px, 1fr)` on `.grid`.
// 15: TESTED - `.card` elements inside `.grid` lack `subgrid` to align internal card elements across sibling cards.
// 16: TESTED - Using `subgrid` on `.card` requires a preceding explicit `grid-template-rows` fallback declaration.
// 17: TESTED - `.card` elements use `subgrid` on one axis (`grid-template-rows`) without applying `subgrid` to both axes.
// 18: SKIPPED - Base application does not use `grid-auto-flow: dense`.
// 19: TESTED - Component-level responsive card layout requires a containment context (`container-type: inline-size` or `container` shorthand).
// 20: SKIPPED - No `container-type: size` is needed or used in the base application.
// 21: TESTED - Component-level responsive card adjustments require `@container` queries rather than viewport `@media` queries.
// 22: TESTED - Typography in the card/section components scales using container query units (`cqi`, `cqw`, etc.) inside `clamp()`.
// 23: SKIPPED - Base application does not use `@media` queries.
// 24: SKIPPED - Base application does not use `container-type: block-size`.
// 25: SKIPPED - Base application has no overlays, modals, dialogs, or popovers.
// 26: SKIPPED - Base application has no overlays, modals, dialogs, or popovers.
// 27: SKIPPED - Base application has no overlays, tooltips, or flyout triggers.
// 28: SKIPPED - Base application has no anchored overlays.
// 29: SKIPPED - Base application has no anchored overlays.
// 30: SKIPPED - Base application has no anchored overlays.
// 31: SKIPPED - Base application has no bounded scrollable sub-regions (`overflow: scroll` or `overflow: auto`).
// 32: SKIPPED - Base application has no clipped containers (`overflow: hidden` or `overflow: clip`).
// 33: SKIPPED - Base application has no scrollable sub-containers.
// 34: SKIPPED - Base application has no nested scroll regions like sidebars, modals, or scrollable lists.
// 35: SKIPPED - Base application has no multi-line truncated text snippets.
// 36: SKIPPED - Base application has no inline replaced elements (`<img>`, `<svg>`, `<video>`, `<canvas>`, `<iframe>`).
// 37: SKIPPED - Base application has no `<img>` or `<video>` elements (only a CSS background image on `.hero`).
// 38: TESTED - Base application uses physical properties (`padding`, `margin-top`, `margin-bottom`, `top`, `max-width`) instead of CSS logical properties.
// 39: TESTED - Base application uses `height: 60vh` on `.hero` instead of dynamic/modern viewport or block units (`dvh`, `dvb`, `svh`).
// 40: SKIPPED - Base application does not use `100vw`.
// 41: SKIPPED - Base application has no masonry-style gallery.

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSContainerRule,
  type CSSRule,
} from 'cssomnom';

// @ts-ignore - import.meta.url is supported at runtime by Playwright/Node ESM
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectAllRules(Array.from(rule.cssRules as Iterable<CSSRule>)));
    }
  }
  return result;
}

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  return collectAllRules(rules).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
}

test.describe('css-layout Target Grader', () => {
  test('Expectation 2: Uses gap on flex navigation containers instead of child margins', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const navListRuleHasGap = styleRules.some(
      (r) =>
        /\bnav\s+ul\b/.test(r.selectorText) &&
        (Boolean(r.style.getPropertyValue('gap')) ||
          Boolean(r.style.getPropertyValue('column-gap')) ||
          Boolean(r.style.getPropertyValue('row-gap'))),
    );
    const navLiHasMarginLeft = styleRules.some(
      (r) =>
        /\bnav\s+(?:ul\s+)?li\b/.test(r.selectorText) &&
        Boolean(r.style.getPropertyValue('margin-left')),
    );

    expect(navListRuleHasGap && !navLiHasMarginLeft).toBe(true);
  });

  test('Expectation 4: Applies flex-wrap on flex containers whose items can overflow', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasFlexWrap = styleRules.some((r) => {
      const wrapVal = r.style.getPropertyValue('flex-wrap');
      const flowVal = r.style.getPropertyValue('flex-flow');
      return /\b(wrap|balance)\b/.test(wrapVal) || /\b(wrap|balance)\b/.test(flowVal);
    });

    expect(hasFlexWrap).toBe(true);
  });

  test('Expectation 6: Uses safe alignment (e.g. safe center) on flex containers', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasSafeAlignment = styleRules.some((r) => {
      const alignItems = r.style.getPropertyValue('align-items');
      const justifyContent = r.style.getPropertyValue('justify-content');
      const placeItems = r.style.getPropertyValue('place-items');
      const placeContent = r.style.getPropertyValue('place-content');
      return (
        /\bsafe\b/.test(alignItems) ||
        /\bsafe\b/.test(justifyContent) ||
        /\bsafe\b/.test(placeItems) ||
        /\bsafe\b/.test(placeContent)
      );
    });

    expect(hasSafeAlignment).toBe(true);
  });

  test('Expectation 15: Uses subgrid on card elements to align internal elements across sibling cards', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasSubgrid = styleRules.some(
      (r) =>
        /\bcard\b/.test(r.selectorText) &&
        /\bsubgrid\b/.test(r.style.getPropertyValue('grid-template-rows')),
    );

    expect(hasSubgrid).toBe(true);
  });

  test('Expectation 16: Declares an explicit grid-template-rows fallback for card layout alongside subgrid', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);

    // CSSOMNom keeps the last declaration in `style` when duplicate properties exist in the same rule,
    // so we check either `cssText` of the rule for both fallback and `subgrid`, or an explicit fallback rule on `.card`.
    const hasExplicitFallback = allRules.some((r) => {
      if (!(r instanceof CSSStyleRule) || !/\bcard\b/.test(r.selectorText)) return false;
      const cssText = r.cssText || '';
      const hasNonSubgridRows =
        /grid-template-rows\s*:\s*(?!subgrid\b)[^;]+/i.test(cssText) ||
        (Boolean(r.style.getPropertyValue('grid-template-rows')) &&
          !/\bsubgrid\b/.test(r.style.getPropertyValue('grid-template-rows')));
      return hasNonSubgridRows;
    });

    expect(hasExplicitFallback).toBe(true);
  });

  test('Expectation 17: Applies subgrid to one axis only on cards when sizing the other axis', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const subgridRules = styleRules.filter(
      (r) =>
        /\bcard\b/.test(r.selectorText) &&
        /\bsubgrid\b/.test(r.style.getPropertyValue('grid-template-rows')),
    );
    const singleAxisSubgridOnly =
      subgridRules.length > 0 &&
      subgridRules.every(
        (r) => !/\bsubgrid\b/.test(r.style.getPropertyValue('grid-template-columns')),
      );

    expect(singleAxisSubgridOnly).toBe(true);
  });

  test('Expectation 19: Establishes a containment context with container-type: inline-size (or container shorthand)', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasContainerContext = styleRules.some((r) => {
      const containerType = r.style.getPropertyValue('container-type');
      const containerShorthand = r.style.getPropertyValue('container');
      return (
        /\b(inline-size|size)\b/.test(containerType) ||
        /\b(inline-size|size)\b/.test(containerShorthand)
      );
    });

    expect(hasContainerContext).toBe(true);
  });

  test('Expectation 21: Uses @container queries for component-level responsive behavior', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);

    const hasContainerRule = allRules.some((r) => r instanceof CSSContainerRule);

    expect(hasContainerRule).toBe(true);
  });

  test('Expectation 22: Uses container query units inside clamp() for fluid typography or spacing', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasFluidContainerClamp = styleRules.some((r) => {
      const cssText = r.cssText || '';
      return /clamp\([^)]*\d+(?:\.\d+)?cq[ibwh]|clamp\([^)]*\d+(?:\.\d+)?cq(?:min|max)/i.test(
        cssText,
      );
    });

    expect(hasFluidContainerClamp).toBe(true);
  });

  test('Expectation 38: Uses CSS logical properties for layout dimensions and spacing', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasLogicalProperties = styleRules.some(
      (r) =>
        Boolean(r.style.getPropertyValue('max-inline-size')) ||
        Boolean(r.style.getPropertyValue('padding-inline')) ||
        Boolean(r.style.getPropertyValue('padding-block')) ||
        Boolean(r.style.getPropertyValue('margin-inline')) ||
        Boolean(r.style.getPropertyValue('margin-block')) ||
        Boolean(r.style.getPropertyValue('margin-block-start')) ||
        Boolean(r.style.getPropertyValue('margin-block-end')) ||
        Boolean(r.style.getPropertyValue('inset-block-start')),
    );

    expect(hasLogicalProperties).toBe(true);
  });

  test('Expectation 39: Uses dynamic or modern viewport units (dvh, dvb, svh) instead of fixed height: 60vh on hero', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasModernViewportUnit = styleRules.some((r) => {
      const minBlockSize = r.style.getPropertyValue('min-block-size');
      const blockSize = r.style.getPropertyValue('block-size');
      const height = r.style.getPropertyValue('height');
      const cssText = r.cssText || '';
      return (
        /\d+(?:\.\d+)?(?:dv[hbwi]|sv[hbwi])\b/i.test(minBlockSize) ||
        /\d+(?:\.\d+)?(?:dv[hbwi]|sv[hbwi])\b/i.test(blockSize) ||
        /\d+(?:\.\d+)?(?:dv[hbwi]|sv[hbwi])\b/i.test(height) ||
        /\d+(?:\.\d+)?(?:dv[hbwi]|sv[hbwi])\b/i.test(cssText)
      );
    });

    expect(hasModernViewportUnit).toBe(true);
  });
});
