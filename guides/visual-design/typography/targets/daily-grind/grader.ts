// Expectations Coverage:
// 1. TESTED - Verifies that CSS uses clamp() combining font-relative (rem) and viewport/container-relative units (vw or cqi) for fluid typography.
// 2. SKIPPED - Base application already satisfies not using bare viewport units (vw or vh) alone for font-size without clamp().
// 3. SKIPPED - Base application already uses unitless line-height (1.6) and does not use px for font-size.
// 4. TESTED - Verifies that text-wrap: balance is applied to headings (h1-h6) and text-wrap: pretty is applied to body text paragraphs (p).
// 5. SKIPPED - Base application already satisfies not applying text-wrap: balance or text-wrap: pretty globally via the universal selector (*).
// 6. SKIPPED - Base application does not use text-align: justify.
// 7. TESTED - Verifies that clamp() font-size minimum and maximum values use rem, em, or %.
// 8. TESTED - Verifies that clamp() font-size maximum value is at most 2.5 times its minimum value.
// 9. SKIPPED - Base application already sets <html lang="en"> and does not use hyphens: auto.
// 10. SKIPPED - Base application already satisfies not setting a fixed height on elements with text of its own, so WCAG 1.4.12 text spacing does not overflow any element's height.
// 11. TESTED - Verifies that at 320 CSS px viewport width, no element causes horizontal scrolling.

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  getCascadedStyle,
  CSSStyleRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function extractClampFontSizes(targetFilesList: string[]): Array<{ min: string; max: string; raw: string }> {
  const styleRules = getRules(targetFilesList, CSSStyleRule);
  const results: Array<{ min: string; max: string; raw: string }> = [];
  for (const rule of styleRules) {
    const fontSize = rule.style.getPropertyValue('font-size').trim();
    if (!fontSize) continue;
    const clampIdx = fontSize.indexOf('clamp(');
    if (clampIdx === -1) continue;
    let depth = 0;
    let current = '';
    const args: string[] = [];
    for (let i = clampIdx + 'clamp('.length; i < fontSize.length; i++) {
      const ch = fontSize[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        if (depth === 0) {
          args.push(current.trim());
          break;
        }
        depth--;
      } else if (ch === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (args.length === 3) {
      results.push({ min: args[0]!, max: args[2]!, raw: fontSize });
    }
  }
  return results;
}

function parseRelativeFontUnit(expr: string): { value: number; unit: 'rem' | 'em' | '%' } | null {
  const m = expr.trim().match(/^(\d+(?:\.\d+)?|\.\d+)(rem|em|%)$/i);
  if (!m) return null;
  return { value: parseFloat(m[1]!), unit: m[2]!.toLowerCase() as 'rem' | 'em' | '%' };
}

test.describe('typography Target Grader', () => {
  test('Fluid typography uses clamp() combining rem and vw or cqi units', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);
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

  test('When font-size is set using clamp, minimum and maximum values are in rem, em, or %', () => {
    const clamps = extractClampFontSizes(targetFiles);
    expect(clamps.length).toBeGreaterThan(0);
    for (const c of clamps) {
      expect(parseRelativeFontUnit(c.min), `clamp min "${c.min}" in "${c.raw}" must be rem, em, or %`).not.toBeNull();
      expect(parseRelativeFontUnit(c.max), `clamp max "${c.max}" in "${c.raw}" must be rem, em, or %`).not.toBeNull();
    }
  });

  test('When font-size is set using clamp, the maximum value is no more than 2.5 times its minimum value', () => {
    const clamps = extractClampFontSizes(targetFiles);
    expect(clamps.length).toBeGreaterThan(0);
    for (const c of clamps) {
      const min = parseRelativeFontUnit(c.min);
      const max = parseRelativeFontUnit(c.max);
      expect(min, `clamp min "${c.min}" must be parseable`).not.toBeNull();
      expect(max, `clamp max "${c.max}" must be parseable`).not.toBeNull();
      if (min && max) {
        const ratio =
          min.unit === max.unit
            ? max.value / min.value
            : (() => {
                const toRem = (v: { value: number; unit: 'rem' | 'em' | '%' }) =>
                  v.unit === '%' ? v.value / 100 : v.value;
                return toRem(max) / toRem(min);
              })();
        expect(ratio, `clamp ratio ${max.value}${max.unit}/${min.value}${min.unit} in "${c.raw}"`).toBeLessThanOrEqual(2.5);
      }
    }
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('At a 320 CSS px viewport width, no element makes the page scroll horizontally', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      const dims = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(dims.clientWidth).toBeGreaterThan(0);
      expect(dims.scrollWidth).toBeLessThanOrEqual(dims.clientWidth);
    });
  });
});
