// Expectations coverage:
// 1. TESTED - Perceptual color interpolation spaces (`in oklch` or `in oklab`) are verified across CSS gradients and `color-mix()` expressions in stylesheets.

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

// @ts-ignore - import.meta.url is supported at runtime by Playwright's ESM loader
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

test.describe('visual-effects Target Grader', () => {
  test('CSS gradients or color-mix() expressions specify perceptual color interpolation spaces (in oklch or in oklab)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);

    const perceptualVarNames = new Set<string>();
    for (const rule of styleRules) {
      for (let i = 0; i < rule.style.length; i++) {
        const propName = rule.style.item(i);
        if (propName.startsWith('--')) {
          const val = rule.style.getPropertyValue(propName);
          if (/\bin\s+(?:oklch|oklab)\b/i.test(val)) {
            perceptualVarNames.add(propName);
          }
        }
      }
    }

    const gradientOrColorMixPattern = /\b(?:(?:repeating-)?(?:linear|radial|conic)-gradient|color-mix)\s*\(/i;
    const directPerceptualPattern = /\b(?:(?:repeating-)?(?:linear|radial|conic)-gradient|color-mix)\s*\([^;{}]*\bin\s+(?:oklch|oklab)\b/i;

    let hasPerceptualGradientOrColorMix = false;

    for (const rule of styleRules) {
      for (let i = 0; i < rule.style.length; i++) {
        const propName = rule.style.item(i);
        const val = rule.style.getPropertyValue(propName);
        if (!gradientOrColorMixPattern.test(val)) {
          continue;
        }
        if (directPerceptualPattern.test(val)) {
          hasPerceptualGradientOrColorMix = true;
          break;
        }
        for (const varName of perceptualVarNames) {
          if (val.includes(`var(${varName}`)) {
            hasPerceptualGradientOrColorMix = true;
            break;
          }
        }
        if (hasPerceptualGradientOrColorMix) {
          break;
        }
      }
      if (hasPerceptualGradientOrColorMix) {
        break;
      }
    }

    expect(hasPerceptualGradientOrColorMix).toBe(true);
  });
});
