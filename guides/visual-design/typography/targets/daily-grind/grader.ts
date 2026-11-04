// Expectations Coverage:
// 1. TESTED - Verifies that CSS uses clamp() combining font-relative (rem) and viewport/container-relative units (vw or cqi) for fluid typography.
// 2. SKIPPED - Base application already satisfies not using bare viewport units (vw or vh) alone for font-size without clamp().
// 3. SKIPPED - Base application already uses unitless line-height (1.6) and does not use px for font-size.
// 4. TESTED - Verifies that text-wrap: balance is applied to headings (h1-h6) and text-wrap: pretty is applied to body text paragraphs (p).
// 5. SKIPPED - Base application already satisfies not applying text-wrap: balance or text-wrap: pretty globally via the universal selector (*).
// 6. SKIPPED - Base application does not use text-align: justify.

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  getCascadedStyle,
  CSSStyleRule,
  CSSGroupingRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const styleRules: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      styleRules.push(rule);
    } else if (rule instanceof CSSGroupingRule) {
      styleRules.push(...getAllStyleRules(rule.cssRules));
    }
  }
  return styleRules;
}

test.describe('typography Target Grader', () => {
  test('Fluid typography uses clamp() combining rem and vw or cqi units', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const hasFluidClamp = styleRules.some((rule) => {
      const fontSize = rule.style.getPropertyValue('font-size');
      return (
        fontSize.includes('clamp(') &&
        /\b\d*\.?\d+rem\b/.test(fontSize) &&
        /\b\d*\.?\d+(?:vw|cqi)\b/.test(fontSize)
      );
    });
    expect(hasFluidClamp).toBe(true);
  });

  test('Headings apply text-wrap: balance', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const headings = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    );
    const allBalanced =
      headings.length > 0 &&
      headings.every((heading) => {
        const cascaded = getCascadedStyle(heading, rules);
        return (
          cascaded.getPropertyValue('text-wrap') === 'balance' ||
          heading.classList.contains('text-balance')
        );
      });
    expect(allBalanced).toBe(true);
  });

  test('Body text paragraphs apply text-wrap: pretty', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const paragraphs = docs.flatMap((d) => Array.from(d.document.querySelectorAll('p')));
    const allPretty =
      paragraphs.length > 0 &&
      paragraphs.every((p) => {
        const cascaded = getCascadedStyle(p, rules);
        return (
          cascaded.getPropertyValue('text-wrap') === 'pretty' ||
          p.classList.contains('text-pretty')
        );
      });
    expect(allPretty).toBe(true);
  });
});
