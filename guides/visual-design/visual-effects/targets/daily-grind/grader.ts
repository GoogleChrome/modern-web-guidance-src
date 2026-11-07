/*
 * Expectation Coverage:
 * - Expectation 1: TESTED - Smooth color gradients and color-mix() specify perceptual interpolation color space (in oklch or in oklab) directly or via custom property, and none specify in srgb.
 * - Expectation 2: TESTED - At least one element's box-shadow has two or more comma-separated shadow layers to create depth.
 * - Expectation 3: TESTED - A lighting or texture overlay uses background-blend-mode, or uses mix-blend-mode on an element inside an isolation: isolate stacking context.
 * - Expectation 4: TESTED - Decorative patterns (stripes, dots, checkerboards) are drawn with CSS gradients that use hard color stops, not with image or SVG files.
 * - Expectation 5: TESTED - A chart drawn with a CSS gradient (such as a conic-gradient() pie) is accompanied by a semantic <table> that exposes the same data.
 */

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule, CSSGroupingRule, type CSSRule, type CSSStyleSheet } from 'cssomnom';
import type { Document } from 'linkedom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllStyleRules(Array.from(rule.cssRules)));
    }
  }
  return result;
}

function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

test.describe('visual-effects Target Grader', () => {
  test('Smooth color gradients and color-mix() specify in oklch or in oklab and never in srgb', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(Array.from(stylesheet.cssRules));
    expect(styleRules.length).toBeGreaterThan(0);

    const customProps = new Map<string, string>();
    for (const rule of styleRules) {
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        if (prop.startsWith('--')) {
          const val = rule.style.getPropertyValue(prop).trim();
          if (val) {
            customProps.set(prop, val);
          }
        }
      }
    }

    let hasPerceptualSpace = false;
    let hasSrgbSpace = false;

    for (const rule of styleRules) {
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        const rawVal = rule.style.getPropertyValue(prop);
        const resolvedVal = rawVal.replace(/var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,[^)]*)?\)/g, (match, varName: string) => {
          return customProps.get(varName) ?? match;
        });

        if (/\bin\s+srgb\b/i.test(rawVal) || /\bin\s+srgb\b/i.test(resolvedVal)) {
          hasSrgbSpace = true;
        }

        if (
          /(?:linear-gradient|radial-gradient|conic-gradient|color-mix)\s*\(/i.test(rawVal) &&
          (/\bin\s+ok(?:lab|lch)\b/i.test(rawVal) || /\bin\s+ok(?:lab|lch)\b/i.test(resolvedVal))
        ) {
          hasPerceptualSpace = true;
        }
      }
    }

    expect(hasPerceptualSpace).toBe(true);
    expect(hasSrgbSpace).toBe(false);
  });

  test('At least one element box-shadow has two or more comma-separated shadow layers', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(Array.from(stylesheet.cssRules));
    expect(styleRules.length).toBeGreaterThan(0);

    const hasMultiLayerShadow = styleRules.some((rule) => {
      const boxShadow = rule.style.getPropertyValue('box-shadow');
      if (!boxShadow || boxShadow === 'none') return false;
      const layers = splitTopLevelCommas(boxShadow);
      return layers.length >= 2;
    });

    expect(hasMultiLayerShadow).toBe(true);
  });

  test('A lighting or texture overlay uses background-blend-mode, or mix-blend-mode with isolation: isolate', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(Array.from(stylesheet.cssRules));
    expect(styleRules.length).toBeGreaterThan(0);

    const hasBgBlendMode = styleRules.some((rule) => {
      const val = rule.style.getPropertyValue('background-blend-mode').trim();
      return Boolean(val && val !== 'normal');
    });

    const hasMixBlendMode = styleRules.some((rule) => {
      const val = rule.style.getPropertyValue('mix-blend-mode').trim();
      return Boolean(val && val !== 'normal');
    });

    const hasIsolationIsolate = styleRules.some((rule) => {
      const val = rule.style.getPropertyValue('isolation').trim();
      return val === 'isolate';
    });

    expect(hasBgBlendMode || (hasMixBlendMode && hasIsolationIsolate)).toBe(true);
  });

  test('Decorative patterns are drawn with CSS gradients using hard color stops rather than image or SVG files', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(Array.from(stylesheet.cssRules));
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(styleRules.length).toBeGreaterThan(0);

    const allDecls: string[] = [];
    for (const rule of styleRules) {
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        allDecls.push(rule.style.getPropertyValue(prop));
      }
    }

    // Check for hard-stop pattern gradients (repeating gradients, radial dot grids, or zero-position hard stops)
    const hasHardStopGradientPattern = allDecls.some((val) => {
      const isRepeating = /repeating-(?:linear|conic|radial)-gradient\s*\(/i.test(val);
      const isRadialHardStop =
        /radial-gradient\s*\([^)]*transparent\s+(?:0\b|calc\(|[0-9.]+(?:px|em|rem|%))/i.test(val);
      const isLinearOrConicHardStop =
        /(?:linear|conic)-gradient\s*\([^)]*,\s*[^,)]+\s+0(?:%|px|em|rem)?\b/i.test(val);
      return isRepeating || isRadialHardStop || isLinearOrConicHardStop;
    });

    // Ensure no new SVG elements or external pattern image files were added beyond the base hero photo
    const hasSvgElements = docs.some((d) => d.document.querySelectorAll('svg, img[src$=".svg"]').length > 0);

    expect(hasHardStopGradientPattern).toBe(true);
    expect(hasSvgElements).toBe(false);
  });

  test('A chart drawn with a CSS gradient is accompanied by a semantic <table> that exposes the same data', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(Array.from(stylesheet.cssRules));
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    // 1. Verify a conic-gradient is used in CSS to draw the pie chart
    const hasConicGradient = styleRules.some((rule) => {
      const bg = rule.style.getPropertyValue('background') + ' ' + rule.style.getPropertyValue('background-image');
      return /\bconic-gradient\s*\(/i.test(bg) && !/\brepeating-conic-gradient\s*\(/i.test(bg);
    });
    expect(hasConicGradient).toBe(true);

    // 2. Verify each drink card contains a semantic <table> with rows/cells exposing the percentage breakdown
    const cards = docs.flatMap((d) => Array.from(d.document.querySelectorAll('.card')));
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      const table = card.querySelector('table');
      expect(table).not.toBeNull();
      const rows = table!.querySelectorAll('tr');
      expect(rows.length).toBeGreaterThanOrEqual(2);
      const cells = table!.querySelectorAll('td, th');
      expect(cells.length).toBeGreaterThanOrEqual(4);
      expect(table!.textContent).toMatch(/\d+%/);
    }
  });
});
