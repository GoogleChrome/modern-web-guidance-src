// EXPECTATION 1: TESTED - The base app uses background-image on .hero and box-shadow on .card without @media (forced-colors: active) fallbacks.
// EXPECTATION 2: TESTED - The base app defines low-contrast card boundaries (only subtle box-shadow) and color tokens that must maintain minimum contrast ratios in light and dark modes.
// EXPECTATION 3: SKIPPED - The base app does not contain status indicators or form validation states.
// EXPECTATION 4: TESTED - The base app lacks color-scheme and @media (prefers-color-scheme: dark) or light-dark() support.

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  getCascadedStyle,
  CSSMediaRule,
  CSSStyleRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore - package.json omits "type": "module" in this target
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectAllRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

function getRulesWithMedia(
  rules: Iterable<CSSRule>,
  mediaPredicate: (conditionText: string) => boolean
): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      if (mediaPredicate(rule.conditionText.toLowerCase())) {
        result.push(...getRulesWithMedia(rule.cssRules, mediaPredicate));
      }
    } else {
      if (rule instanceof CSSStyleRule) {
        const bg = rule.style.getPropertyValue('background').trim();
        const bgColor = rule.style.getPropertyValue('background-color').trim();
        if (bg && !bgColor && !bg.includes('url(') && !bg.includes('gradient(')) {
          rule.style.setProperty('background-color', bg);
        }
      }
      result.push(rule);
    }
  }
  return result;
}

const SYSTEM_COLOR_KEYWORDS = new Set([
  'canvas',
  'canvastext',
  'linktext',
  'visitedtext',
  'activetext',
  'buttonface',
  'buttontext',
  'buttonborder',
  'field',
  'fieldtext',
  'highlight',
  'highlighttext',
  'selecteditem',
  'selecteditemtext',
  'mark',
  'marktext',
  'graytext',
  'accentcolor',
  'accentcolortext',
]);

function containsSystemColor(value: string): boolean {
  const tokens = value.toLowerCase().split(/[^a-z-]+/).filter(Boolean);
  return tokens.some((t) => SYSTEM_COLOR_KEYWORDS.has(t));
}

type RGB = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const clamped = Math.min(1, Math.max(0, c));
  const v =
    clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
}

function rgbToOklab([r, g, b]: RGB): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]: [number, number, number]): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
}

function splitTopLevelCommas(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseColorArg(arg: string): { color: RGB; pct: number | null } | null {
  const trimmed = arg.trim();
  const pctMatch = /^(.*?)\s+(\d+(?:\.\d+)?)%\s*$/.exec(trimmed);
  if (pctMatch) {
    const c = resolveCssColor(pctMatch[1].trim());
    if (!c) return null;
    return { color: c, pct: parseFloat(pctMatch[2]) / 100 };
  }
  const pctFirstMatch = /^(\d+(?:\.\d+)?)%\s+(.*?)\s*$/.exec(trimmed);
  if (pctFirstMatch) {
    const c = resolveCssColor(pctFirstMatch[2].trim());
    if (!c) return null;
    return { color: c, pct: parseFloat(pctFirstMatch[1]) / 100 };
  }
  const c = resolveCssColor(trimmed);
  if (!c) return null;
  return { color: c, pct: null };
}

function resolveCssColor(val: string, mode: 'light' | 'dark' = 'light'): RGB | null {
  if (!val) return null;
  const s = val.trim().toLowerCase();
  if (s === 'white' || s === '#fff' || s === '#ffffff') return [255, 255, 255];
  if (s === 'black' || s === '#000' || s === '#000000') return [0, 0, 0];

  const hex6 = /^#([0-9a-f]{6})$/.exec(s);
  if (hex6) {
    const h = hex6[1];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  const hex3 = /^#([0-9a-f]{3})$/.exec(s);
  if (hex3) {
    const h = hex3[1];
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }

  const rgbMatch = /^rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/.exec(s);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1], 10),
      parseInt(rgbMatch[2], 10),
      parseInt(rgbMatch[3], 10),
    ];
  }

  if (s.startsWith('light-dark(') && s.endsWith(')')) {
    const inner = s.slice('light-dark('.length, -1);
    const args = splitTopLevelCommas(inner);
    if (args.length === 2) {
      return resolveCssColor(mode === 'dark' ? args[1] : args[0], mode);
    }
  }

  if (s.startsWith('color-mix(') && s.endsWith(')')) {
    const inner = s.slice('color-mix('.length, -1);
    const args = splitTopLevelCommas(inner);
    if (args.length === 3) {
      const space = args[0].toLowerCase();
      const arg1 = parseColorArg(args[1]);
      const arg2 = parseColorArg(args[2]);
      if (!arg1 || !arg2) return null;

      let p1 = arg1.pct;
      let p2 = arg2.pct;
      if (p1 === null && p2 === null) {
        p1 = 0.5;
        p2 = 0.5;
      } else if (p1 === null && p2 !== null) {
        p1 = 1 - p2;
      } else if (p1 !== null && p2 === null) {
        p2 = 1 - p1;
      }
      const sum = (p1 ?? 0.5) + (p2 ?? 0.5);
      const w1 = sum > 0 ? (p1 ?? 0.5) / sum : 0.5;
      const w2 = sum > 0 ? (p2 ?? 0.5) / sum : 0.5;

      if (space.includes('oklab') || space.includes('oklch')) {
        const lab1 = rgbToOklab(arg1.color);
        const lab2 = rgbToOklab(arg2.color);
        return oklabToRgb([
          lab1[0] * w1 + lab2[0] * w2,
          lab1[1] * w1 + lab2[1] * w2,
          lab1[2] * w1 + lab2[2] * w2,
        ]);
      } else {
        return [
          Math.round(arg1.color[0] * w1 + arg2.color[0] * w2),
          Math.round(arg1.color[1] * w1 + arg2.color[1] * w2),
          Math.round(arg1.color[2] * w1 + arg2.color[2] * w2),
        ];
      }
    }
  }

  return null;
}

function relativeLuminance([r, g, b]: RGB): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(c1: RGB, c2: RGB): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('color Target Grader', () => {
  test('declares color-scheme supporting both light and dark modes (Expectation 4)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const styleRules = collectAllRules(stylesheet.cssRules).filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );

    const hasCssColorScheme = styleRules.some((r) => {
      const val = r.style.getPropertyValue('color-scheme').toLowerCase();
      return val.includes('light') && val.includes('dark');
    });

    const hasMetaColorScheme = docs.some((d) => {
      const meta = d.document.querySelector('meta[name="color-scheme"]');
      const content = meta?.getAttribute('content')?.toLowerCase() ?? '';
      return content.includes('light') && content.includes('dark');
    });

    expect(hasCssColorScheme || hasMetaColorScheme).toBe(true);
  });

  test('provides dark color scheme adaptations via @media (prefers-color-scheme: dark) or light-dark() (Expectation 4)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);

    const hasDarkMediaRule = allRules.some(
      (r) =>
        r instanceof CSSMediaRule &&
        r.conditionText.toLowerCase().includes('prefers-color-scheme') &&
        r.conditionText.toLowerCase().includes('dark') &&
        r.cssRules.length > 0
    );

    const hasLightDarkFn = allRules.some(
      (r) =>
        r instanceof CSSStyleRule &&
        r.style.cssText.toLowerCase().includes('light-dark(')
    );

    expect(hasDarkMediaRule || hasLightDarkFn).toBe(true);
  });

  test('provides @media (forced-colors: active) fallbacks using system color keywords (Expectation 1)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllRules(stylesheet.cssRules);

    const forcedColorsMediaRules = allRules.filter(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule &&
        r.conditionText.toLowerCase().includes('forced-colors') &&
        r.conditionText.toLowerCase().includes('active')
    );

    const usesSystemColorsInForcedMode = forcedColorsMediaRules.some((mediaRule) => {
      const nestedStyleRules = collectAllRules(mediaRule.cssRules).filter(
        (r): r is CSSStyleRule => r instanceof CSSStyleRule
      );
      return nestedStyleRules.some((sr) => containsSystemColor(sr.style.cssText));
    });

    expect(usesSystemColorsInForcedMode).toBe(true);
  });

  test('defines a visible border or outline on .card so boundaries do not rely solely on box-shadow (Expectations 1 & 2)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const doc = docs[0]?.document;
    const cardEl = doc?.querySelector('.card');

    const rulesWithForcedColors = getRulesWithMedia(
      stylesheet.cssRules,
      (cond) => cond.includes('forced-colors') && cond.includes('active')
    );

    const cascaded = cardEl
      ? getCascadedStyle(cardEl, rulesWithForcedColors)
      : null;

    const borderTopWidth = cascaded?.getPropertyValue('border-top-width') ?? '';
    const borderTopStyle = cascaded?.getPropertyValue('border-top-style') ?? '';
    const outlineStyle = cascaded?.getPropertyValue('outline-style') ?? '';

    const hasVisibleBorder =
      (Boolean(borderTopStyle) && borderTopStyle !== 'none' && borderTopWidth !== '0px') ||
      (Boolean(outlineStyle) && outlineStyle !== 'none');

    expect(hasVisibleBorder).toBe(true);
  });

  test('maintains at least 4.5:1 contrast ratio for body text against background in light and dark modes (Expectation 2)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const doc = docs[0]?.document;
    const bodyEl = doc?.querySelector('body');

    const lightRules = getRulesWithMedia(stylesheet.cssRules, () => false);
    const darkRules = getRulesWithMedia(
      stylesheet.cssRules,
      (cond) => cond.includes('prefers-color-scheme') && cond.includes('dark')
    );

    const lightStyle = bodyEl ? getCascadedStyle(bodyEl, lightRules) : null;
    const darkStyle = bodyEl ? getCascadedStyle(bodyEl, darkRules) : null;

    const lightFg = resolveCssColor(lightStyle?.getPropertyValue('color') ?? '', 'light');
    const lightBg = resolveCssColor(lightStyle?.getPropertyValue('background-color') ?? '', 'light');
    const darkFg = resolveCssColor(darkStyle?.getPropertyValue('color') ?? '', 'dark');
    const darkBg = resolveCssColor(darkStyle?.getPropertyValue('background-color') ?? '', 'dark');

    const lightContrast = lightFg && lightBg ? contrastRatio(lightFg, lightBg) : 0;
    const darkContrast = darkFg && darkBg ? contrastRatio(darkFg, darkBg) : 0;

    expect(
      lightContrast >= 4.5 &&
        darkContrast >= 4.5 &&
        (darkStyle?.getPropertyValue('background-color') !==
          lightStyle?.getPropertyValue('background-color') ||
          (lightStyle?.getPropertyValue('background-color') ?? '').toLowerCase().includes('light-dark('))
    ).toBe(true);
  });

  test('maintains at least 4.5:1 contrast ratio for button text against button background in light and dark modes (Expectation 2)', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const doc = docs[0]?.document;
    const cardBtnEl = doc?.querySelector('.card .btn') ?? doc?.querySelector('.btn');

    const lightRules = getRulesWithMedia(stylesheet.cssRules, () => false);
    const darkRules = getRulesWithMedia(
      stylesheet.cssRules,
      (cond) => cond.includes('prefers-color-scheme') && cond.includes('dark')
    );

    const lightStyle = cardBtnEl ? getCascadedStyle(cardBtnEl, lightRules) : null;
    const darkStyle = cardBtnEl ? getCascadedStyle(cardBtnEl, darkRules) : null;

    const lightFg = resolveCssColor(lightStyle?.getPropertyValue('color') ?? '', 'light');
    const lightBg = resolveCssColor(lightStyle?.getPropertyValue('background-color') ?? '', 'light');
    const darkFg = resolveCssColor(darkStyle?.getPropertyValue('color') ?? '', 'dark');
    const darkBg = resolveCssColor(darkStyle?.getPropertyValue('background-color') ?? '', 'dark');

    const lightContrast = lightFg && lightBg ? contrastRatio(lightFg, lightBg) : 0;
    const darkContrast = darkFg && darkBg ? contrastRatio(darkFg, darkBg) : 0;

    expect(
      lightContrast >= 4.5 &&
        darkContrast >= 4.5 &&
        (darkStyle?.getPropertyValue('background-color') !==
          lightStyle?.getPropertyValue('background-color') ||
          (lightStyle?.getPropertyValue('background-color') ?? '').toLowerCase().includes('light-dark('))
    ).toBe(true);
  });
});
