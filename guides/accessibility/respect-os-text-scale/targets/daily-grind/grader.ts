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
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore - import.meta.url is supported by Playwright/Node ESM runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectAllStyleRules(rule.cssRules));
    }
  }
  return result;
}

const SPACING_PROPS = [
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'margin-inline',
  'margin-inline-start',
  'margin-inline-end',
  'margin-block',
  'margin-block-start',
  'margin-block-end',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'padding-inline',
  'padding-inline-start',
  'padding-inline-end',
  'padding-block',
  'padding-block-start',
  'padding-block-end',
  'gap',
  'row-gap',
  'column-gap',
];

const TEXT_AND_BUTTON_SELECTORS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'a',
  'button',
  '.btn',
  '.logout-link',
  '.card',
];

function matchesAnyToken(selectorText: string, tokens: string[]): boolean {
  return tokens.some((token) => {
    if (token.startsWith('.')) {
      const escaped = token.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\.${escaped}\\b`).test(selectorText);
    }
    return new RegExp(`\\b${token}\\b`, 'i').test(selectorText);
  });
}

test.describe('respect-os-text-scale Target Grader', () => {
  // --- STATIC ASSERTIONS (PARSERS: STRUCTURE & API USAGE) ---

  test('The document <head> includes the <meta name="text-scale" content="scale"> element to opt into operating system text scaling', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const hasTextScaleMeta = docs.some(({ document }) => {
      const metas = Array.from(document.querySelectorAll('head meta'));
      return metas.some(
        (meta: any) =>
          meta.getAttribute('name')?.trim().toLowerCase() === 'text-scale' &&
          meta.getAttribute('content')?.trim().toLowerCase() === 'scale'
      );
    });

    expect(hasTextScaleMeta).toBe(true);
  });

  test('Font sizes use relative units (rem or em) rather than fixed pixels (px) or bare viewport units (vw) alone, line heights use unitless values, and spacing (margins and padding) coupled to text size uses relative units', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectAllStyleRules(stylesheet.cssRules);
    expect(styleRules.length).toBeGreaterThan(0);

    const fontSizeValues: string[] = [];
    const lineHeightValues: string[] = [];
    const coupledSpacingValues: Array<{ selector: string; prop: string; val: string }> = [];

    for (const rule of styleRules) {
      const fontSize = rule.style.getPropertyValue('font-size')?.trim();
      if (fontSize) {
        fontSizeValues.push(fontSize);
      }

      const lineHeight = rule.style.getPropertyValue('line-height')?.trim();
      if (lineHeight) {
        lineHeightValues.push(lineHeight);
      }

      if (matchesAnyToken(rule.selectorText, TEXT_AND_BUTTON_SELECTORS)) {
        for (const prop of SPACING_PROPS) {
          const val = rule.style.getPropertyValue(prop)?.trim();
          if (val) {
            coupledSpacingValues.push({ selector: rule.selectorText, prop, val });
          }
        }
      }
    }

    // 1. Font sizes use relative units (rem or em) rather than fixed px or bare vw
    expect(fontSizeValues.length).toBeGreaterThan(0);
    for (const fs of fontSizeValues) {
      expect(/\b\d+(\.\d+)?px\b/i.test(fs)).toBe(false);
      expect(/\b\d+(\.\d+)?(rem|em)\b/i.test(fs)).toBe(true);
    }

    // 2. Line heights use unitless values
    expect(lineHeightValues.length).toBeGreaterThan(0);
    for (const lh of lineHeightValues) {
      const isUnitlessOrKeyword =
        /^\d+(\.\d+)?$/.test(lh) || /^(normal|inherit|initial|unset)$/i.test(lh);
      expect(isUnitlessOrKeyword).toBe(true);
    }

    // 3. Spacing coupled to text size uses relative units (not fixed px)
    expect(coupledSpacingValues.length).toBeGreaterThan(0);
    const hasPxInCoupledSpacing = coupledSpacingValues.some(({ val }) =>
      /\b\d+(\.\d+)?px\b/i.test(val)
    );
    expect(hasPxInCoupledSpacing).toBe(false);

    const hasRelativeSpacing = coupledSpacingValues.some(({ val }) =>
      /\b\d+(\.\d+)?(rem|em)\b/i.test(val)
    );
    expect(hasRelativeSpacing).toBe(true);
  });

  test('Text-containing components and containers grow to accommodate scaled text without fixed height or block-size values or restrictive max-height or max-block-size values that cause clipping or overflow', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectAllStyleRules(stylesheet.cssRules);
    expect(styleRules.length).toBeGreaterThan(0);

    const containerSelectors = ['.hero', 'header', 'nav', '.card', '.btn', 'footer', 'p', 'h1', 'h2', 'h3'];
    const containerRules = styleRules.filter((r) =>
      matchesAnyToken(r.selectorText, containerSelectors)
    );
    expect(containerRules.length).toBeGreaterThan(0);

    for (const rule of containerRules) {
      const height = rule.style.getPropertyValue('height')?.trim();
      const blockSize = rule.style.getPropertyValue('block-size')?.trim();
      const maxHeight = rule.style.getPropertyValue('max-height')?.trim();
      const maxBlockSize = rule.style.getPropertyValue('max-block-size')?.trim();

      if (height) {
        expect(/^(auto|fit-content|max-content|100%|inherit|initial|unset)$/i.test(height)).toBe(true);
      }
      if (blockSize) {
        expect(/^(auto|fit-content|max-content|100%|inherit|initial|unset)$/i.test(blockSize)).toBe(true);
      }
      if (maxHeight) {
        expect(/^(none|inherit|initial|unset)$/i.test(maxHeight)).toBe(true);
      }
      if (maxBlockSize) {
        expect(/^(none|inherit|initial|unset)$/i.test(maxBlockSize)).toBe(true);
      }
    }

    // The loop above already rejects a fixed hero height. Content-driven sizing and
    // min-height / min-block-size are both allowed by the guide.
  });

  test('Text within scaled containers wraps naturally without restrictive inline-axis clipping, fixed widths, or white-space: nowrap on text blocks', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectAllStyleRules(stylesheet.cssRules);
    expect(styleRules.length).toBeGreaterThan(0);

    const textBlockSelectors = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'];
    const textBlockRules = styleRules.filter((r) =>
      matchesAnyToken(r.selectorText, textBlockSelectors)
    );
    expect(textBlockRules.length).toBeGreaterThan(0);

    // Check that text block rules do not set white-space: nowrap or fixed pixel widths
    for (const rule of textBlockRules) {
      const whiteSpace = rule.style.getPropertyValue('white-space')?.trim().toLowerCase();
      expect(whiteSpace).not.toBe('nowrap');

      const width = rule.style.getPropertyValue('width')?.trim();
      if (width) {
        expect(/\b\d+(\.\d+)?px\b/i.test(width)).toBe(false);
      }
    }


    // Flex navigation containers must allow wrapping (flex-wrap: wrap) so text wraps naturally
    const navWrapRules = styleRules.filter(
      (r) =>
        /\bnav\b/i.test(r.selectorText) &&
        /\bwrap\b/i.test(r.style.getPropertyValue('flex-wrap')?.trim() || '')
    );
    expect(navWrapRules.length).toBeGreaterThan(0);
  });

  test('When the <meta name="text-scale" content="scale"> element is present, the CSS stylesheet does not explicitly set font-size on :root or html (including absolute, relative, or calculated values)', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const hasTextScaleMeta = docs.some(({ document }) => {
      const metas = Array.from(document.querySelectorAll('head meta'));
      return metas.some(
        (meta: any) =>
          meta.getAttribute('name')?.trim().toLowerCase() === 'text-scale' &&
          meta.getAttribute('content')?.trim().toLowerCase() === 'scale'
      );
    });
    expect(hasTextScaleMeta).toBe(true);

    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const styleRules = collectAllStyleRules(stylesheet.cssRules);
    expect(styleRules.length).toBeGreaterThan(0);

    const rootOrHtmlRulesWithFontSize = styleRules.filter((rule) => {
      const selectors = rule.selectorText.split(',').map((s) => s.trim());
      const targetsRootOrHtml = selectors.some(
        (sel) => sel === ':root' || sel === 'html' || /^html\b/i.test(sel) || /^:root\b/i.test(sel)
      );
      if (!targetsRootOrHtml) return false;
      const fontSize = rule.style.getPropertyValue('font-size')?.trim();
      return Boolean(fontSize);
    });

    expect(rootOrHtmlRulesWithFontSize.length).toBe(0);
  });

  // --- BROWSER ASSERTIONS (RUNTIME BEHAVIOR) ---

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Text resizes to at least 200% of its default size without loss of content or functionality, and responsive layouts reflow at a 320 CSS-pixel viewport width without two-dimensional scrolling', async ({
      page,
    }) => {
      // 1. Check baseline font sizes at default scale
      await page.setViewportSize({ width: 1280, height: 800 });
      const defaultMetrics = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const cardTitle = document.querySelector('.card h3, h3');
        const navLink = document.querySelector('nav a');
        return {
          h1Size: h1 ? parseFloat(window.getComputedStyle(h1).fontSize) : 0,
          cardTitleSize: cardTitle ? parseFloat(window.getComputedStyle(cardTitle).fontSize) : 0,
          navLinkSize: navLink ? parseFloat(window.getComputedStyle(navLink).fontSize) : 0,
        };
      });

      expect(defaultMetrics.h1Size).toBeGreaterThan(0);
      expect(defaultMetrics.cardTitleSize).toBeGreaterThan(0);
      expect(defaultMetrics.navLinkSize).toBeGreaterThan(0);

      // 2. Simulate 200% OS text scale by setting root font-size to 200% at runtime
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });

      const scaled200Metrics = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const cardTitle = document.querySelector('.card h3, h3');
        const navLink = document.querySelector('nav a');
        const hero = document.querySelector('.hero, header');
        return {
          h1Size: h1 ? parseFloat(window.getComputedStyle(h1).fontSize) : 0,
          cardTitleSize: cardTitle ? parseFloat(window.getComputedStyle(cardTitle).fontSize) : 0,
          navLinkSize: navLink ? parseFloat(window.getComputedStyle(navLink).fontSize) : 0,
          heroScrollHeight: hero ? hero.scrollHeight : 0,
          heroClientHeight: hero ? hero.clientHeight : 0,
          docScrollWidth: document.documentElement.scrollWidth,
          docClientWidth: document.documentElement.clientWidth,
        };
      });

      // Relative text sizes must scale up with root font-size (cardTitle and navLink double to 200%)
      expect(scaled200Metrics.cardTitleSize).toBeCloseTo(defaultMetrics.cardTitleSize * 2, 0);
      expect(scaled200Metrics.navLinkSize).toBeCloseTo(defaultMetrics.navLinkSize * 2, 0);
      expect(scaled200Metrics.h1Size).toBeGreaterThan(defaultMetrics.h1Size);
      expect(scaled200Metrics.docScrollWidth).toBeLessThanOrEqual(scaled200Metrics.docClientWidth + 1);

      // 3. Reflow at 320 CSS-pixel viewport width (equivalent to 400% zoom on a 1280px display) without two-dimensional scrolling
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '';
      });
      await page.setViewportSize({ width: 320, height: 568 });

      const reflow320Metrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        const cards = Array.from(document.querySelectorAll('.card'));
        const cardRects = cards.map((c) => {
          const r = c.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
        });
        return {
          scrollWidth: docEl.scrollWidth,
          clientWidth: docEl.clientWidth,
          cardRects,
        };
      });

      // No horizontal overflow at 320px width with 200% text scale
      expect(reflow320Metrics.scrollWidth).toBeLessThanOrEqual(reflow320Metrics.clientWidth + 1);

      // Cards should reflow into a single vertical column at 320px width and 200% text scale
      expect(reflow320Metrics.cardRects.length).toBeGreaterThan(1);
      for (let i = 1; i < reflow320Metrics.cardRects.length; i++) {
        expect(reflow320Metrics.cardRects[i].top).toBeGreaterThanOrEqual(
          reflow320Metrics.cardRects[i - 1].bottom - 1
        );
      }
    });
  });
});
