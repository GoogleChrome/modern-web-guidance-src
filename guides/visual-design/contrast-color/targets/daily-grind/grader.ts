import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import { closestRule, CSSStyleRule, CSSSupportsRule } from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getFallbackStyleRules(files: string[]): CSSStyleRule[] {
  return getRules(files, CSSStyleRule).filter((rule) => {
    for (
      let curr = closestRule(rule, CSSSupportsRule);
      curr;
      curr = closestRule(curr, CSSSupportsRule)
    ) {
      const cond = curr.conditionText.toLowerCase();
      if (cond.includes('contrast-color') && !cond.includes('not')) {
        return false;
      }
    }
    return true;
  });
}

function selectorMatchesTarget(selector: string, target: 'nav' | 'btn' | 'footer'): boolean {
  const parts = selector.split(',').map((s) => s.trim());
  return parts.some((part) => {
    if (target === 'nav') return /\bnav\b/.test(part);
    if (target === 'btn') return /\.btn\b/.test(part);
    if (target === 'footer') return /\bfooter\b|\.footer-links\b/.test(part);
    return false;
  });
}

function ruleHasNonContrastColorDeclaration(rule: CSSStyleRule): boolean {
  const colorVal = rule.style.getPropertyValue('color').trim().toLowerCase();
  if (
    colorVal.length > 0 &&
    !colorVal.includes('contrast-color(') &&
    colorVal !== 'initial' &&
    colorVal !== 'unset'
  ) {
    return true;
  }
  // Support cascading fallback declarations (`color: white; color: contrast-color(...)`) in the same rule block
  const colorMatches = Array.from(rule.cssText.matchAll(/(?:^|[;{]\s*)color\s*:\s*([^;!}]+)/gi));
  return colorMatches.some((m) => {
    const v = m[1].trim().toLowerCase();
    return v.length > 0 && !v.includes('contrast-color(') && v !== 'initial' && v !== 'unset';
  });
}

test.describe('contrast-color Target Grader', () => {
  test('If the browser does not support contrast-color(), the themed element still has a readable fallback text color (not the browser default)', () => {
    const allRules = getRules(targetFiles, CSSStyleRule);
    const fallbackRules = getFallbackStyleRules(targetFiles);
    expect(fallbackRules.length).toBeGreaterThan(0);

    const usesContrastColor = allRules.some(
      (r) =>
        r.style.getPropertyValue('color').toLowerCase().includes('contrast-color(') ||
        r.cssText.toLowerCase().includes('contrast-color('),
    );
    expect(usesContrastColor).toBe(true);

    const targets: Array<'nav' | 'btn' | 'footer'> = ['nav', 'btn', 'footer'];
    for (const target of targets) {
      const hasReadableFallbackColor = fallbackRules.some(
        (r) => selectorMatchesTarget(r.selectorText, target) && ruleHasNonContrastColorDeclaration(r),
      );
      expect(hasReadableFallbackColor).toBe(true);
    }
  });

  test('For variable background colors in browsers that do not support contrast-color(), the themed element uses Relative Color Syntax (oklch(from ...)), a text-shadow, a -webkit-text-stroke with paint-order: stroke fill, a translucent background overlay, or an SVG filter', () => {
    const fallbackRules = getFallbackStyleRules(targetFiles);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(fallbackRules.length).toBeGreaterThan(0);

    const targets: Array<'nav' | 'btn' | 'footer'> = ['nav', 'btn', 'footer'];
    const hasSvgFilterInDom = docs.some((d) => Boolean(d.document.querySelector('svg filter')));

    for (const target of targets) {
      const targetHasFallbackMechanism = fallbackRules.some((r) => {
        if (!selectorMatchesTarget(r.selectorText, target)) return false;
        const style = r.style;
        const color = style.getPropertyValue('color').toLowerCase();
        const textShadow = style.getPropertyValue('text-shadow').trim();
        const textStroke =
          style.getPropertyValue('-webkit-text-stroke').trim() ||
          style.getPropertyValue('-webkit-text-stroke-width').trim();
        const paintOrder = style.getPropertyValue('paint-order').toLowerCase();
        const filter = style.getPropertyValue('filter').toLowerCase();
        const bg =
          style.getPropertyValue('background-color').toLowerCase() ||
          style.getPropertyValue('background').toLowerCase();

        const hasRcs =
          /\b(oklch|lch|lab|oklab|rgb|hsl|hwb|color)\(\s*from\b/.test(color) ||
          /\b(oklch|lch|lab|oklab|rgb|hsl|hwb|color)\(\s*from\b/.test(r.cssText.toLowerCase());
        const hasShadow = textShadow.length > 0 && textShadow !== 'none';
        const hasStroke =
          textStroke.length > 0 &&
          textStroke !== '0' &&
          textStroke !== 'none' &&
          paintOrder.includes('stroke');
        const hasSvgFilter = filter.includes('url(') && hasSvgFilterInDom;
        const hasOverlay =
          /::(before|after)/.test(r.selectorText) &&
          (bg.includes('/') || bg.includes('rgba') || bg.includes('hsla'));

        return hasRcs || hasShadow || hasStroke || hasSvgFilter || hasOverlay;
      });
      expect(targetHasFallbackMechanism).toBe(true);
    }
  });

  test('The contrast-color() function is not used to define the background-color property of any element', () => {
    const allRules = getRules(targetFiles, CSSStyleRule);
    expect(allRules.length).toBeGreaterThan(0);

    const usesContrastColorForText = allRules.some(
      (r) =>
        r.style.getPropertyValue('color').toLowerCase().includes('contrast-color(') ||
        r.cssText.toLowerCase().includes('contrast-color('),
    );
    expect(usesContrastColorForText).toBe(true);

    const usesContrastColorForBg = allRules.some((r) => {
      const bg = r.style.getPropertyValue('background').toLowerCase();
      const bgColor = r.style.getPropertyValue('background-color').toLowerCase();
      return bg.includes('contrast-color(') || bgColor.includes('contrast-color(');
    });
    expect(usesContrastColorForBg).toBe(false);
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
    });

    test('The text color of themed elements computes to either rgb(0, 0, 0) or rgb(255, 255, 255) when a background color is applied', async ({
      page,
    }) => {
      const results = await page.evaluate(() => {
        const parseColorToRgb = (colorStr: string): [number, number, number] => {
          const oklchMatch = colorStr.match(/oklch\(\s*([0-9.]+%?)/i);
          if (oklchMatch) {
            const rawL = oklchMatch[1];
            const l = rawL.endsWith('%') ? parseFloat(rawL) / 100 : parseFloat(rawL);
            if (l <= 0.01) return [0, 0, 0];
            if (l >= 0.99) return [255, 255, 255];
          }
          const rgbMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
          if (rgbMatch) {
            return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
          }
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d');
          if (!ctx) return [0, 0, 0];
          ctx.fillStyle = colorStr;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return [Math.round(r), Math.round(g), Math.round(b)];
        };

        const normalizeToBlackOrWhite = (colorStr: string): string => {
          const [r, g, b] = parseColorToRgb(colorStr);
          return `rgb(${r}, ${g}, ${b})`;
        };

        const checkSelectors = ['nav', 'nav a', '.btn', 'footer', 'footer a'];
        const testCases = [
          { prop: '--primary', bg: '#ffffff' },
          { prop: '--primary', bg: '#000000' },
          { prop: '--secondary', bg: '#111111' },
          { prop: '--secondary', bg: '#f5f5f5' },
        ];

        const colors: string[] = [];
        for (const tc of testCases) {
          document.documentElement.style.setProperty(tc.prop, tc.bg);
          for (const sel of checkSelectors) {
            const el = document.querySelector(sel);
            if (el) {
              const computed = window.getComputedStyle(el).color;
              colors.push(normalizeToBlackOrWhite(computed));
            }
          }
        }
        return colors;
      });

      expect(results.length).toBeGreaterThan(0);
      for (const color of results) {
        expect(['rgb(0, 0, 0)', 'rgb(255, 255, 255)']).toContain(color);
      }
    });

    test('The computed text color has a contrast ratio of at least 4.5:1 against the computed background color', async ({
      page,
    }) => {
      const ratios = await page.evaluate(() => {
        const getRgb = (colorStr: string): [number, number, number] => {
          const oklchMatch = colorStr.match(/oklch\(\s*([0-9.]+%?)/i);
          if (oklchMatch) {
            const rawL = oklchMatch[1];
            const l = rawL.endsWith('%') ? parseFloat(rawL) / 100 : parseFloat(rawL);
            if (l <= 0.01) return [0, 0, 0];
            if (l >= 0.99) return [255, 255, 255];
          }
          const rgbMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
          if (rgbMatch) {
            return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])];
          }
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = colorStr;
          ctx.fillRect(0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          return [data[0], data[1], data[2]];
        };

        const getLuminance = ([r, g, b]: [number, number, number]): number => {
          const toLinear = (c: number) => {
            const s = c / 255;
            return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
        };

        const getEffectiveBackgroundColor = (el: Element): string => {
          let curr: Element | null = el;
          while (curr) {
            const bg = window.getComputedStyle(curr).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
              return bg;
            }
            curr = curr.parentElement;
          }
          return 'rgb(255, 255, 255)';
        };

        const getContrastRatio = (el: Element): number => {
          const style = window.getComputedStyle(el);
          const bgRgb = getRgb(getEffectiveBackgroundColor(el));
          const lBg = getLuminance(bgRgb);
          const fgRgb = getRgb(style.color);

          const lFg = getLuminance(fgRgb);
          const lighter = Math.max(lFg, lBg);
          const darker = Math.min(lFg, lBg);
          return (lighter + 0.05) / (darker + 0.05);
        };

        const themes = [
          { primary: '#4e342e', secondary: '#d7ccc8' },
          { primary: '#f5f5f5', secondary: '#1a1a1a' },
          { primary: '#ffeb3b', secondary: '#263238' },
        ];

        const computedRatios: number[] = [];
        for (const theme of themes) {
          document.documentElement.style.setProperty('--primary', theme.primary);
          document.documentElement.style.setProperty('--secondary', theme.secondary);

          for (const sel of ['nav', 'nav a', '.btn', 'footer', 'footer a']) {
            const el = document.querySelector(sel);
            if (el) {
              computedRatios.push(getContrastRatio(el));
            }
          }
        }
        return computedRatios;
      });

      expect(ratios.length).toBeGreaterThan(0);
      for (const ratio of ratios) {
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });

    test('When the background color custom property is updated (including across theme or interaction states), the computed text color automatically updates via contrast-color() without hard-coding a separate static text color on interaction states', async ({
      page,
    }) => {
      const allRules = getRules(targetFiles, CSSStyleRule);
      const usesContrastColor = allRules.some(
        (r) =>
          r.style.getPropertyValue('color').toLowerCase().includes('contrast-color(') ||
          r.cssText.toLowerCase().includes('contrast-color('),
      );
      expect(usesContrastColor).toBe(true);

      const hasHardcodedInteractionTextColorOnThemedSurface = allRules.some((r) => {
        const sel = r.selectorText.trim();
        const isSurfaceInteractionRule =
          /^(nav|\.btn|footer)\s*:(hover|focus|focus-visible|active)\b/.test(sel);
        if (!isSurfaceInteractionRule) return false;
        const colorVal = r.style.getPropertyValue('color').trim().toLowerCase();
        return (
          colorVal.length > 0 &&
          !colorVal.includes('contrast-color(') &&
          !colorVal.includes('from ') &&
          colorVal !== 'inherit' &&
          colorVal !== 'currentcolor'
        );
      });
      expect(hasHardcodedInteractionTextColorOnThemedSurface).toBe(false);

      const colorTransitions = await page.evaluate(() => {
        const toRgbString = (colorStr: string): string => {
          const oklchMatch = colorStr.match(/oklch\(\s*([0-9.]+%?)/i);
          if (oklchMatch) {
            const rawL = oklchMatch[1];
            const l = rawL.endsWith('%') ? parseFloat(rawL) / 100 : parseFloat(rawL);
            if (l <= 0.01) return 'rgb(0, 0, 0)';
            if (l >= 0.99) return 'rgb(255, 255, 255)';
          }
          const rgbMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
          if (rgbMatch) {
            return `rgb(${Number(rgbMatch[1])}, ${Number(rgbMatch[2])}, ${Number(rgbMatch[3])})`;
          }
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = colorStr;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return `rgb(${r}, ${g}, ${b})`;
        };

        const nav = document.querySelector('nav')!;
        const navLink = document.querySelector('nav a')!;
        const btn = document.querySelector('.btn')!;
        const footer = document.querySelector('footer')!;
        const footerLink = document.querySelector('footer a')!;

        document.documentElement.style.setProperty('--primary', '#111111');
        document.documentElement.style.setProperty('--secondary', '#111111');
        const darkBgColors = {
          nav: toRgbString(window.getComputedStyle(nav).color),
          navLink: toRgbString(window.getComputedStyle(navLink).color),
          btn: toRgbString(window.getComputedStyle(btn).color),
          footer: toRgbString(window.getComputedStyle(footer).color),
          footerLink: toRgbString(window.getComputedStyle(footerLink).color),
        };

        document.documentElement.style.setProperty('--primary', '#fafafa');
        document.documentElement.style.setProperty('--secondary', '#fafafa');
        const lightBgColors = {
          nav: toRgbString(window.getComputedStyle(nav).color),
          navLink: toRgbString(window.getComputedStyle(navLink).color),
          btn: toRgbString(window.getComputedStyle(btn).color),
          footer: toRgbString(window.getComputedStyle(footer).color),
          footerLink: toRgbString(window.getComputedStyle(footerLink).color),
        };

        return { darkBgColors, lightBgColors };
      });

      expect(colorTransitions.darkBgColors.nav).toBe('rgb(255, 255, 255)');
      expect(colorTransitions.darkBgColors.navLink).toBe('rgb(255, 255, 255)');
      expect(colorTransitions.darkBgColors.btn).toBe('rgb(255, 255, 255)');
      expect(colorTransitions.darkBgColors.footer).toBe('rgb(255, 255, 255)');
      expect(colorTransitions.darkBgColors.footerLink).toBe('rgb(255, 255, 255)');

      expect(colorTransitions.lightBgColors.nav).toBe('rgb(0, 0, 0)');
      expect(colorTransitions.lightBgColors.navLink).toBe('rgb(0, 0, 0)');
      expect(colorTransitions.lightBgColors.btn).toBe('rgb(0, 0, 0)');
      expect(colorTransitions.lightBgColors.footer).toBe('rgb(0, 0, 0)');
      expect(colorTransitions.lightBgColors.footerLink).toBe('rgb(0, 0, 0)');
    });
  });
});
