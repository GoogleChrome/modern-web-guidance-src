import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSStyleRule,
  CSSGroupingRule,
  CSSSupportsRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore - import.meta.url is supported in ESM test runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllStyleRules(rule.cssRules));
    }
  }
  return result;
}

function getAllSupportsRules(rules: Iterable<CSSRule>): CSSSupportsRule[] {
  const result: CSSSupportsRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSSupportsRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllSupportsRules(rule.cssRules));
    }
  }
  return result;
}

function parseColorRgb(colorStr: string): [number, number, number] | null {
  const match = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (match) {
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const srgbMatch = colorStr.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (srgbMatch) {
    return [
      Math.round(Number(srgbMatch[1]) * 255),
      Math.round(Number(srgbMatch[2]) * 255),
      Math.round(Number(srgbMatch[3]) * 255),
    ];
  }
  const oklchMatch = colorStr.match(/oklch\(\s*([\d.]+)(%?)/i);
  if (oklchMatch) {
    const l = oklchMatch[2] === '%' ? Number(oklchMatch[1]) / 100 : Number(oklchMatch[1]);
    const val = l >= 0.5 ? 255 : 0;
    return [val, val, val];
  }
  return null;
}

function getRelativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = getRelativeLuminance(rgb1);
  const l2 = getRelativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('contrast-color Target Grader', () => {
  test('Applies contrast-color() using a background custom property to define text color on themed elements', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);

    const hasContrastColorWithVar = styleRules.some((rule) => {
      const colorVal = rule.style.getPropertyValue('color');
      return /\bcontrast-color\s*\(\s*var\(--/.test(colorVal) || /\bcontrast-color\s*\(/.test(rule.cssText);
    });

    expect(hasContrastColorWithVar).toBe(true);
  });

  test('Provides a readable fallback text color when contrast-color() is not supported', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allStyleRules = getAllStyleRules(stylesheet.cssRules);
    const supportsRules = getAllSupportsRules(stylesheet.cssRules);

    const hasBtnFallbackColor =
      allStyleRules.some((rule) => {
        if (!/\bbtn\b/.test(rule.selectorText)) return false;
        const colorVal = rule.style.getPropertyValue('color').trim();
        return (
          (colorVal.length > 0 && !/\bcontrast-color\s*\(/i.test(colorVal)) ||
          /\bcolor\s*:\s*(?!contrast-color\b)[^;}]+/i.test(rule.cssText)
        );
      }) ||
      supportsRules.some(
        (rule) =>
          !/\bcontrast-color\s*\(/i.test(rule.conditionText) &&
          /\bbtn\b/.test(rule.cssText) &&
          /\bcolor\s*:/i.test(rule.cssText)
      );

    expect(hasBtnFallbackColor).toBe(true);
  });

  test('Includes a dynamic background readability fallback (RCS oklch, text-shadow, text-stroke, overlay, or SVG filter) for non-supporting browsers', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allStyleRules = getAllStyleRules(stylesheet.cssRules);
    const supportsRules = getAllSupportsRules(stylesheet.cssRules);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasRcsFallback =
      supportsRules.some((r) => /\boklch\s*\(\s*from\b/i.test(r.conditionText) || /\boklch\s*\(\s*from\b/i.test(r.cssText)) ||
      allStyleRules.some((r) => /\boklch\s*\(\s*from\b/i.test(r.style.getPropertyValue('color')) || /\boklch\s*\(\s*from\b/i.test(r.cssText));

    const hasSecondaryAid = allStyleRules.some((r) => {
      const textShadow = r.style.getPropertyValue('text-shadow').trim();
      const textStroke =
        r.style.getPropertyValue('-webkit-text-stroke').trim() ||
        r.style.getPropertyValue('-webkit-text-stroke-width').trim();
      const filter = r.style.getPropertyValue('filter').trim();
      const isPseudoOverlay =
        /::(before|after)\b/.test(r.selectorText) &&
        (r.style.getPropertyValue('background-color').trim().length > 0 ||
          r.style.getPropertyValue('background').trim().length > 0);
      return (
        (textShadow.length > 0 && textShadow !== 'none') ||
        (textStroke.length > 0 && textStroke !== '0px' && textStroke !== 'none') ||
        filter.includes('url(') ||
        isPseudoOverlay
      );
    });

    const hasSvgFilterInHtml = docs.some((d) => Boolean(d.document.querySelector('svg filter')));

    expect(hasRcsFallback || hasSecondaryAid || hasSvgFilterInHtml).toBe(true);
  });

  test('Sets paint-order to stroke fill or markers stroke fill whenever a text stroke fallback is used', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allStyleRules = getAllStyleRules(stylesheet.cssRules);

    const strokeRules = allStyleRules.filter((r) => {
      const stroke =
        r.style.getPropertyValue('-webkit-text-stroke').trim() ||
        r.style.getPropertyValue('-webkit-text-stroke-width').trim();
      return stroke.length > 0 && stroke !== 'none' && stroke !== '0' && stroke !== '0px';
    });

    const hasAnyContrastFallback =
      allStyleRules.some((r) => /\b(contrast-color|oklch)\s*\(/i.test(r.cssText)) || strokeRules.length > 0;

    const validPaintOrder = strokeRules.every((r) => {
      const paintOrder = r.style.getPropertyValue('paint-order').trim();
      return paintOrder === 'stroke fill' || paintOrder === 'markers stroke fill';
    });

    expect(hasAnyContrastFallback && validPaintOrder).toBe(true);
  });

  test('Does not use contrast-color() to define background or background-color on any element', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const allStyleRules = getAllStyleRules(stylesheet.cssRules);

    const usesContrastColorForText = allStyleRules.some((r) =>
      /\bcontrast-color\s*\(/i.test(r.style.getPropertyValue('color') || r.cssText)
    );

    const usesContrastColorForBackground = allStyleRules.some((r) => {
      const bg = r.style.getPropertyValue('background');
      const bgColor = r.style.getPropertyValue('background-color');
      return /\bcontrast-color\s*\(/i.test(bg) || /\bcontrast-color\s*\(/i.test(bgColor);
    });

    expect(usesContrastColorForText && !usesContrastColorForBackground).toBe(true);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Button text color computes to black or white and maintains >= 4.5:1 contrast ratio against its background', async ({
      page,
    }) => {
      const styles = await page.$eval('.btn', (el) => {
        const cs = window.getComputedStyle(el);
        return {
          color: cs.color,
          backgroundColor: cs.backgroundColor,
        };
      });

      const fgRgb = parseColorRgb(styles.color);
      const bgRgb = parseColorRgb(styles.backgroundColor);

      const isBlackOrWhite =
        fgRgb !== null &&
        ((fgRgb[0] === 0 && fgRgb[1] === 0 && fgRgb[2] === 0) ||
          (fgRgb[0] === 255 && fgRgb[1] === 255 && fgRgb[2] === 255));

      const contrastRatio = fgRgb && bgRgb ? getContrastRatio(fgRgb, bgRgb) : 0;

      expect(isBlackOrWhite && contrastRatio >= 4.5).toBe(true);
    });

    test('Updating the background color custom property dynamically updates the computed text color to maintain >= 4.5:1 contrast', async ({
      page,
    }) => {
      const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
      const allStyleRules = getAllStyleRules(stylesheet.cssRules);
      const hasStaticDynamicVarContrast = allStyleRules.some((r) =>
        /\bcontrast-color\s*\(\s*var\(--/i.test(r.style.getPropertyValue('color') || r.cssText) ||
        /\boklch\s*\(\s*from\s+var\(--/i.test(r.style.getPropertyValue('color') || r.cssText)
      );

      const result = await page.evaluate(() => {
        const root = document.documentElement;
        const btn = document.querySelector('.btn') as HTMLElement;
        const footer = document.querySelector('footer') as HTMLElement;

        root.style.setProperty('--primary', '#fafafa');
        root.style.setProperty('--secondary', '#1a1a1a');

        const btnStyle = window.getComputedStyle(btn);
        const footerStyle = window.getComputedStyle(footer);

        const supportsContrastColor = CSS.supports('color', 'contrast-color(red)');
        const supportsInlinedRcs = CSS.supports('color', 'oklch(from red max(0, sign(0.623 - l)) 0 h)');

        return {
          btnColor: btnStyle.color,
          btnBg: btnStyle.backgroundColor,
          footerColor: footerStyle.color,
          footerBg: footerStyle.backgroundColor,
          supportsContrastColor,
          supportsInlinedRcs,
        };
      });

      const btnFg = parseColorRgb(result.btnColor);
      const btnBg = parseColorRgb(result.btnBg);
      const footerFg = parseColorRgb(result.footerColor);
      const footerBg = parseColorRgb(result.footerBg);

      const btnContrast = btnFg && btnBg ? getContrastRatio(btnFg, btnBg) : 0;
      const footerContrast = footerFg && footerBg ? getContrastRatio(footerFg, footerBg) : 0;

      const dynamicallyContrasts =
        (btnContrast >= 4.5 && footerContrast >= 4.5) ||
        (!result.supportsContrastColor && hasStaticDynamicVarContrast && btnBg !== null && footerBg !== null);

      expect(dynamicallyContrasts).toBe(true);
    });
  });
});
