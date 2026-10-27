// Expectation 1: TESTED - The base app uses box-shadow (.card) and background-image (.hero) to convey component boundaries/surfaces, so @media (forced-colors: active) high-contrast fallbacks are required.
// Expectation 2: TESTED - The base app cards lack 3:1 boundary contrast (white card on #fafafa background with only a subtle box-shadow) and require explicit border/contrast enhancements.
// Expectation 3: SKIPPED - The base application does not contain any status indicators or validation state elements (badges in patches are newly invented).
// Expectation 4: TESTED - Applicable to any web application; the base app lacks color-scheme and @media (prefers-color-scheme: dark) or light-dark() support.

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSMediaRule, CSSStyleRule, type CSSRule, type CSSStyleSheet } from 'cssomnom';
import type { Document } from 'linkedom';

import * as path from 'path';
import { pathToFileURL } from 'url';

const currentFileUrl: string =
  typeof __filename !== 'undefined'
    ? pathToFileURL(__filename).href
    : pathToFileURL(path.resolve('grader.ts')).href;
const targetFiles: string[] = getTargetFiles(currentFileUrl);

function collectStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectStyleRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

function collectMediaRules(rules: Iterable<CSSRule>): CSSMediaRule[] {
  const result: CSSMediaRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectMediaRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

test.describe('color Target Grader', () => {
  test('Expectation 1: Provides @media (forced-colors: active) fallbacks with system colors or borders', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const mediaRules = collectMediaRules(stylesheet.cssRules);
    const forcedColorRules = mediaRules.filter((r) =>
      /\bforced-colors\s*:\s*active\b/i.test(r.conditionText),
    );
    const innerStyleRules = forcedColorRules.flatMap((r) => collectStyleRules(r.cssRules));
    const systemColorOrBorderPattern =
      /\b(Canvas|CanvasText|LinkText|ButtonFace|ButtonText|Highlight|HighlightText|GrayText|border|outline)\b/i;

    const hasValidForcedColorsFallback = innerStyleRules.some((r) =>
      systemColorOrBorderPattern.test(r.cssText),
    );
    expect(hasValidForcedColorsFallback).toBe(true);
  });

  test('Expectation 2: Defines visible border on .card to maintain 3:1 UI component boundary contrast', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const topLevelStyleRules = Array.from(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule,
    );
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasCardBorderCss = topLevelStyleRules.some((r) => {
      if (!/\bcard\b/.test(r.selectorText)) return false;
      const border = r.style.getPropertyValue('border');
      const borderWidth = r.style.getPropertyValue('border-width');
      const borderColor = r.style.getPropertyValue('border-color');
      const outline = r.style.getPropertyValue('outline');
      return Boolean(
        (border && border !== 'none' && border !== '0') ||
          (borderWidth && borderWidth !== '0' && borderWidth !== '0px') ||
          borderColor ||
          (outline && outline !== 'none' && outline !== '0'),
      );
    });

    const hasCardBorderUtility = docs.some((d) =>
      Boolean(d.document.querySelector('.card[class*="border"], .card[class*="ring"]')),
    );

    expect(hasCardBorderCss || hasCardBorderUtility).toBe(true);
  });

  test('Expectation 4a: Declares support for light and dark color schemes via color-scheme property or meta tag', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectStyleRules(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasColorSchemeCss = styleRules.some((r) => {
      const val = r.style.getPropertyValue('color-scheme');
      return /\blight\b/i.test(val) && /\bdark\b/i.test(val);
    });

    const hasColorSchemeMeta = docs.some((d) => {
      const meta = d.document.querySelector('meta[name="color-scheme"]');
      const content = meta?.getAttribute('content') || '';
      return /\blight\b/i.test(content) && /\bdark\b/i.test(content);
    });

    expect(hasColorSchemeCss || hasColorSchemeMeta).toBe(true);
  });

  test('Expectation 4b: Implements dark mode color tokens or styles using @media (prefers-color-scheme: dark) or light-dark()', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const mediaRules = collectMediaRules(stylesheet.cssRules);
    const allStyleRules = collectStyleRules(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const darkMediaRules = mediaRules.filter((r) =>
      /\bprefers-color-scheme\s*:\s*dark\b/i.test(r.conditionText),
    );
    const hasDarkMediaStyles =
      darkMediaRules.flatMap((r) => collectStyleRules(r.cssRules)).length > 0;

    const hasLightDarkFn = allStyleRules.some((r) => /\blight-dark\s*\(/i.test(r.cssText));

    const hasDarkUtility = docs.some((d) => Boolean(d.document.querySelector('[class*="dark:"]')));

    expect(hasDarkMediaStyles || hasLightDarkFn || hasDarkUtility).toBe(true);
  });
});
