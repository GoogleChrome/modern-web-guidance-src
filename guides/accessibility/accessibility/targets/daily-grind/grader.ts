// Expectations Relevance Summary:
// - Expectation 1: TESTED - The base application has interactive links and buttons that lack custom `:focus-visible` focus styles with `outline` and `outline-offset`.
// - Expectation 2: SKIPPED - The base application does not remove focus outlines (`outline: none`) on interactive elements, so it already satisfies this negative requirement.
// - Expectation 3: TESTED - The base application contains interactive navigation links that lack minimum 24px by 24px target sizing via `min-inline-size` / `min-block-size` or padding.
// - Expectation 4: SKIPPED - The base application does not use `touch-action: none` on any scrollable containers, so it already satisfies this negative requirement.

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectStyleRules(rule.cssRules));
    }
  }
  return result;
}

test.describe('accessibility Target Grader', () => {
  test('Expectation 1: Defines custom keyboard focus styles using :focus-visible paired with outline and outline-offset', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasFocusVisibleWithOutlineAndOffset = styleRules.some((rule) => {
      if (!rule.selectorText.includes(':focus-visible')) {
        return false;
      }
      const outline = rule.style.getPropertyValue('outline').trim();
      const outlineWidth = rule.style.getPropertyValue('outline-width').trim();
      const outlineStyle = rule.style.getPropertyValue('outline-style').trim();
      const outlineOffset = rule.style.getPropertyValue('outline-offset').trim();

      const hasValidOutline =
        (outline.length > 0 && !/\b(none|0)\b/.test(outline)) ||
        (outlineWidth.length > 0 && outlineWidth !== '0' && outlineStyle !== 'none');

      return hasValidOutline && outlineOffset.length > 0 && outlineOffset !== '0';
    });

    expect(hasFocusVisibleWithOutlineAndOffset).toBe(true);
  });

  test('Expectation 3: Interactive targets meet a minimum size of 24px using min-block-size or min-inline-size', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const hasMinTargetSize = styleRules.some((rule) => {
      const minBlockSize = rule.style.getPropertyValue('min-block-size').trim();
      const minInlineSize = rule.style.getPropertyValue('min-inline-size').trim();
      return /\b(24px|44px|[2-9]\dpx|\d+(\.\d+)?rem)\b/.test(minBlockSize) ||
        /\b(24px|44px|[2-9]\dpx|\d+(\.\d+)?rem)\b/.test(minInlineSize);
    });

    expect(hasMinTargetSize).toBe(true);
  });
});
