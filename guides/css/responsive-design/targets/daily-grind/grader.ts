// Expectation 1: TESTED - The base application contains component layouts (cards, grid, hero, navigation) that lack container-type: inline-size and @container queries.
// Expectation 2: TESTED - The base application uses static vh units for hero sizing instead of dynamic viewport units (dvh/dvw).
// Expectation 3: TESTED - The base application contains a media banner container (.hero) lacking aspect-ratio definitions to prevent Cumulative Layout Shift.

import { pathToFileURL } from 'node:url';
import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule, CSSContainerRule, type CSSRule } from 'cssomnom';

const currentUrl = typeof __filename !== 'undefined'
  ? pathToFileURL(__filename).href
  : pathToFileURL(process.cwd() + '/grader.ts').href;

const targetFiles: string[] = getTargetFiles(currentUrl);

/**
 * Recursively flattens CSS rules, extracting nested style and at-rules from grouping rules.
 */
function getAllCssRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && (rule as { cssRules?: Iterable<CSSRule> }).cssRules) {
      result.push(...getAllCssRules((rule as { cssRules: Iterable<CSSRule> }).cssRules));
    }
  }
  return result;
}

test.describe('Responsive Design - daily-grind Grader', () => {
  // --- STATIC ASSERTIONS ---

  test('Expectation 1: Declares container context with container-type: inline-size', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const hasInlineSizeContainer = allRules.some(r => {
      if (r instanceof CSSStyleRule) {
        const containerType = r.style.getPropertyValue('container-type') || '';
        const container = r.style.getPropertyValue('container') || '';
        return /\binline-size\b/.test(containerType) || /\binline-size\b/.test(container);
      }
      return false;
    }) || docs.some(d => Boolean(d.document.querySelector('[class*="@container"]')));

    expect(hasInlineSizeContainer).toBe(true);
  });

  test('Expectation 1: Implements component-level responsive layout using @container queries', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const hasContainerQuery = allRules.some(r => r instanceof CSSContainerRule)
      || docs.some(d => Boolean(d.document.querySelector('[class*="@sm:"], [class*="@md:"], [class*="@lg:"], [class*="@xl:"], [class*="@min-"], [class*="@max-"]')));

    expect(hasContainerQuery).toBe(true);
  });

  test('Expectation 2: Uses dynamic viewport units (dvh or dvw) for viewport sizing', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const hasDynamicViewportUnits = allRules.some(r => {
      if (r instanceof CSSStyleRule) {
        for (let i = 0; i < r.style.length; i++) {
          const val = r.style.getPropertyValue(r.style[i]);
          if (/\b\d+(?:\.\d+)?dv[hw]\b/.test(val)) {
            return true;
          }
        }
      }
      return false;
    }) || docs.some(d => Boolean(d.document.querySelector('[class*="dvh"], [class*="dvw"]')));

    expect(hasDynamicViewportUnits).toBe(true);
  });

  test('Expectation 2: Replaces static vh/vw units with dynamic viewport units for full-viewport sizing', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const heroHasStaticViewportUnit = allRules.some(r => {
      if (r instanceof CSSStyleRule && /\bhero\b/.test(r.selectorText)) {
        const height = r.style.getPropertyValue('height') || '';
        const minHeight = r.style.getPropertyValue('min-height') || '';
        const maxHeight = r.style.getPropertyValue('max-height') || '';
        return /\b\d+(?:\.\d+)?(vh|vw)\b/.test(height)
          || /\b\d+(?:\.\d+)?(vh|vw)\b/.test(minHeight)
          || /\b\d+(?:\.\d+)?(vh|vw)\b/.test(maxHeight);
      }
      return false;
    }) || docs.some(d => Boolean(d.document.querySelector('.hero[class*="vh"], .hero[class*="vw"], .hero.h-screen')));

    expect(heroHasStaticViewportUnit).toBe(false);
  });

  test('Expectation 3: Applies aspect-ratio to media containers or responsive media elements', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getAllCssRules(stylesheet.cssRules);

    const hasAspectRatio = allRules.some(r => {
      if (r instanceof CSSStyleRule) {
        const ar = r.style.getPropertyValue('aspect-ratio');
        return Boolean(ar && ar.trim().length > 0 && ar.trim() !== 'auto' && ar.trim() !== 'initial');
      }
      return false;
    }) || docs.some(d => Boolean(d.document.querySelector('[class*="aspect-"]')));

    expect(hasAspectRatio).toBe(true);
  });
});
