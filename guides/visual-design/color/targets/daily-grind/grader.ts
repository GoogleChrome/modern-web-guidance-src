// Expectation 1: TESTED - The base app uses box-shadow (.card) and background-image (.hero) to convey component boundaries/surfaces, so @media (forced-colors: active) high-contrast fallbacks (system colors or visible borders/outlines) are required.
// Expectation 2: TESTED - Measured in the browser in BOTH light and dark color schemes: rendered text must meet 4.5:1 (3:1 for large text) against its effective background, and interactive controls must have a 3:1 boundary (background or border) against the adjacent background. The dark-scheme measurement is only meaningful if a dark scheme actually renders, which task.md explicitly requests.
// Expectation 3: TESTED - task.md asks for "New" and "Sold out" status badges on the Seasonal Favorites cards; each status must be conveyed by visible text (or an icon with an accessible name), not by color alone.
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
import type { Page } from '@playwright/test';

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

type DeclarationBlock = { length: number; [index: number]: string; getPropertyValue(p: string): string };

/** Every declaration block (style rules and bare nested declarations) under the given rules, at any depth. */
function collectDeclarationBlocks(rules: Iterable<CSSRule>): DeclarationBlock[] {
  const result: DeclarationBlock[] = [];
  for (const rule of rules) {
    const style = (rule as unknown as { style?: DeclarationBlock }).style;
    if (style && typeof style.getPropertyValue === 'function') {
      result.push(style);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...collectDeclarationBlocks(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

const SYSTEM_COLOR_PATTERN =
  /(?<![\w-])(Canvas|CanvasText|LinkText|VisitedText|ActiveText|ButtonFace|ButtonText|ButtonBorder|Field|FieldText|Highlight|HighlightText|SelectedItem|SelectedItemText|Mark|MarkText|GrayText|AccentColor|AccentColorText)(?![\w-])/i;
const ZERO_LENGTH = /^0(\.0+)?([a-z]+)?$/i;
const INVISIBLE_STYLE = /^(none|hidden)$/i;
const BOUNDARY_PREFIXES = [
  'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-block-start', 'border-block-end', 'border-inline-start', 'border-inline-end',
  'outline',
];

/** True when the declaration block draws a visible border/outline (not none/hidden/zero-width). */
function declaresVisibleBoundary(style: DeclarationBlock): boolean {
  for (const prefix of BOUNDARY_PREFIXES) {
    const lineStyle = style.getPropertyValue(`${prefix}-style`).trim();
    const width = style.getPropertyValue(`${prefix}-width`).trim();
    if (lineStyle && !INVISIBLE_STYLE.test(lineStyle) && !ZERO_LENGTH.test(width)) return true;
    if (!lineStyle && width && width !== 'medium' && !ZERO_LENGTH.test(width)) return true;
  }
  // Shorthands that cssomnom could not expand (e.g. `border: var(--x)`).
  for (const shorthand of ['border', 'outline', 'border-style', 'border-width', 'outline-style']) {
    const value = style.getPropertyValue(shorthand).trim();
    if (!/\bvar\(/i.test(value)) continue;
    const tokens = value.split(/\s+/);
    if (tokens.some((t) => INVISIBLE_STYLE.test(t)) || tokens.every((t) => ZERO_LENGTH.test(t))) continue;
    return true;
  }
  return false;
}

type ContrastFailure = { scheme: string; kind: string; element: string; fg: string; bg: string; ratio: number; required: number };
type ColorAudit = {
  pageBackgroundLuminance: number;
  textChecked: number;
  controlsChecked: number;
  textFailures: ContrastFailure[];
  controlFailures: ContrastFailure[];
};

/**
 * Runs inside the browser. Every CSS color (oklch, hsl, color-mix, named, system colors, ...) is
 * normalized to sRGB by painting it onto a 1x1 canvas. Effective backgrounds are found by walking
 * ancestors and alpha-compositing background-colors until an opaque one is reached (falling back to
 * the scheme's Canvas color). If a background-image (photo/gradient) is hit first, the rendered
 * backdrop cannot be determined from CSS, so that element is excluded from measurement.
 */
function auditColors(scheme: string): ColorAudit {
  type RGBA = [number, number, number, number];
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const toRgba = (color: string): RGBA => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top: RGBA, bottom: RGBA): RGBA => [
    top[0] * top[3] + bottom[0] * (1 - top[3]),
    top[1] * top[3] + bottom[1] * (1 - top[3]),
    top[2] * top[3] + bottom[2] * (1 - top[3]),
    1,
  ];
  const luminance = (c: RGBA): number => {
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  };
  const ratio = (a: RGBA, b: RGBA): number => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const fmt = (c: RGBA) => `rgb(${c.slice(0, 3).map((v) => Math.round(v)).join(', ')})`;
  const describe = (el: Element) => {
    const cls = el.getAttribute('class');
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}> "${text}"`;
  };

  const probe = document.createElement('div');
  probe.style.cssText = 'background-color: Canvas; position: absolute; width: 0; height: 0;';
  document.documentElement.appendChild(probe);
  const canvasColor = toRgba(getComputedStyle(probe).backgroundColor);
  probe.remove();
  const canvasBase: RGBA = [canvasColor[0], canvasColor[1], canvasColor[2], 1];

  const effectiveBackground = (start: Element | null): RGBA | null => {
    const layers: RGBA[] = [];
    for (let node = start; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const bg = toRgba(cs.backgroundColor);
      if (bg[3] > 0) layers.push(bg);
      if (bg[3] >= 1) break;
    }
    let result: RGBA = layers.length && layers[layers.length - 1][3] >= 1 ? layers.pop()! : canvasBase;
    while (layers.length) result = over(layers.pop()!, result);
    return result;
  };

  const isVisible = (el: Element) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  };
  // WCAG 1.4.3 / 1.4.11 exempt inactive (disabled) user interface components.
  const isInactive = (el: Element) => Boolean(el.closest(':disabled, [aria-disabled="true"]'));

  const TOLERANCE = 0.02; // absorbs 8-bit canvas quantization only
  const textFailures: ContrastFailure[] = [];
  const controlFailures: ContrastFailure[] = [];
  let textChecked = 0;
  let controlsChecked = 0;

  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|svg)$/i.test(el.tagName) || el.closest('svg')) continue;
    const hasOwnText = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && /\S/.test(n.textContent || ''),
    );
    if (!hasOwnText || !isVisible(el) || isInactive(el)) continue;
    const bg = effectiveBackground(el);
    if (!bg) continue;
    const cs = getComputedStyle(el);
    const fg = over(toRgba(cs.color), bg);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const required = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
    const r = ratio(fg, bg);
    textChecked++;
    if (r + TOLERANCE < required) {
      textFailures.push({ scheme, kind: 'text', element: describe(el), fg: fmt(fg), bg: fmt(bg), ratio: +r.toFixed(2), required });
    }
  }

  const sides = ['top', 'right', 'bottom', 'left'];
  const hasFullBorder = (cs: CSSStyleDeclaration) => sides.every((s) =>
    parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0 &&
    !/^(none|hidden)$/.test(cs.getPropertyValue(`border-${s}-style`)) &&
    toRgba(cs.getPropertyValue(`border-${s}-color`))[3] > 0);
  const controls = Array.from(document.body.querySelectorAll(
    'button, input:not([type="hidden"]), select, textarea, [role="button"], a[href]',
  )).filter((el) => {
    if (!isVisible(el) || isInactive(el)) return false;
    if (el.tagName !== 'A') return true;
    // Links only count as controls when styled as buttons (own fill or a full border).
    const cs = getComputedStyle(el);
    return toRgba(cs.backgroundColor)[3] > 0 || hasFullBorder(cs);
  });

  for (const el of controls) {
    const adjacent = effectiveBackground(el.parentElement);
    if (!adjacent) continue;
    const cs = getComputedStyle(el);
    const ownBg = cs.backgroundImage !== 'none' ? null : over(toRgba(cs.backgroundColor), adjacent);
    const fillRatio = ownBg ? ratio(ownBg, adjacent) : 0;
    const borderRatio = hasFullBorder(cs)
      ? Math.min(...sides.map((s) => ratio(over(toRgba(cs.getPropertyValue(`border-${s}-color`)), adjacent), adjacent)))
      : 0;
    if (!ownBg && !borderRatio) continue;
    controlsChecked++;
    const best = Math.max(fillRatio, borderRatio);
    if (best + TOLERANCE < 3) {
      controlFailures.push({
        scheme, kind: 'control-boundary', element: describe(el),
        fg: ownBg ? fmt(ownBg) : cs.borderTopColor, bg: fmt(adjacent), ratio: +best.toFixed(2), required: 3,
      });
    }
  }

  const pageBg = effectiveBackground(document.body) ?? canvasBase;
  return { pageBackgroundLuminance: luminance(pageBg), textChecked, controlsChecked, textFailures, controlFailures };
}

async function auditScheme(page: Page, url: string, scheme: 'light' | 'dark'): Promise<ColorAudit> {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(url, { waitUntil: 'load' });
  return page.evaluate(auditColors, scheme);
}

test.describe('color Target Grader', () => {
  test('Expectation 1: Provides @media (forced-colors: active) fallbacks with system colors or visible borders/outlines', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const forcedColorRules = collectMediaRules(stylesheet.cssRules).filter((r) =>
      /\bforced-colors\s*:\s*active\b/i.test(r.conditionText),
    );
    const blocks = forcedColorRules.flatMap((r) => collectDeclarationBlocks(r.cssRules));

    const hasValidForcedColorsFallback = blocks.some((style) => {
      for (let i = 0; i < style.length; i++) {
        if (SYSTEM_COLOR_PATTERN.test(style.getPropertyValue(style[i]))) return true;
      }
      return declaresVisibleBoundary(style);
    });
    expect(hasValidForcedColorsFallback).toBe(true);
  });

  test('Expectation 2: Rendered text meets 4.5:1 (3:1 large) contrast in both light and dark color schemes', async ({ page, TARGET_URL }) => {
    const light = await auditScheme(page, TARGET_URL, 'light');
    const dark = await auditScheme(page, TARGET_URL, 'dark');
    expect({
      darkSchemeRendered: dark.pageBackgroundLuminance < light.pageBackgroundLuminance,
      textMeasuredInBothSchemes: light.textChecked > 0 && dark.textChecked > 0,
      failures: [...light.textFailures, ...dark.textFailures],
    }).toEqual({ darkSchemeRendered: true, textMeasuredInBothSchemes: true, failures: [] });
  });

  test('Expectation 2: Interactive controls keep a 3:1 boundary against adjacent backgrounds in both light and dark color schemes', async ({ page, TARGET_URL }) => {
    const light = await auditScheme(page, TARGET_URL, 'light');
    const dark = await auditScheme(page, TARGET_URL, 'dark');
    expect({
      darkSchemeRendered: dark.pageBackgroundLuminance < light.pageBackgroundLuminance,
      controlsMeasuredInBothSchemes: light.controlsChecked > 0 && dark.controlsChecked > 0,
      failures: [...light.controlFailures, ...dark.controlFailures],
    }).toEqual({ darkSchemeRendered: true, controlsMeasuredInBothSchemes: true, failures: [] });
  });

  test('Expectation 3: "New" and "Sold out" statuses are conveyed by visible text or an icon with an accessible name, not color alone', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL, { waitUntil: 'load' });
    const statuses = await page.evaluate(() => {
      const scope = document.querySelector('main') ?? document.body;
      const isVisible = (el: Element) => {
        const rect = el.getBoundingClientRect();
        // Larger than a visually-hidden (sr-only) 1px box, so sighted users can read it too.
        return rect.width > 4 && rect.height > 4 &&
          el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      };
      const conveys = (pattern: RegExp) => Array.from(scope.querySelectorAll('*')).some((el) => {
        if (!isVisible(el)) return false;
        const text = ((el as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ');
        if (text.length > 0 && text.length <= 30 && pattern.test(text)) return true;
        const label = el.getAttribute('aria-label') || '';
        const isIcon = /^(svg|img)$/i.test(el.tagName) || Boolean(el.querySelector('svg, img'));
        return isIcon && pattern.test(label);
      });
      return { new: conveys(/\bnew\b/i), soldOut: conveys(/\bsold[\s-]*out\b/i) };
    });
    expect(statuses).toEqual({ new: true, soldOut: true });
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
