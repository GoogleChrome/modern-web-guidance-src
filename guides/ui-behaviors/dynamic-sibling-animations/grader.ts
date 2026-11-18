import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Dynamic Sibling Animations Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
  });

  test('The animation on the first element starts before the animation on the second element.', async ({ page }) => {
    await page.goto(demoUrl);
    const selector = '.item, .card, .grid > *';
    const elements = page.locator(selector);
    const count = await elements.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const delay1 = await elements
      .nth(0)
      .evaluate(
        (el) =>
          parseFloat(window.getComputedStyle(el).animationDelay) ||
          parseFloat(window.getComputedStyle(el).transitionDelay)
      );
    const delay2 = await elements
      .nth(1)
      .evaluate(
        (el) =>
          parseFloat(window.getComputedStyle(el).animationDelay) ||
          parseFloat(window.getComputedStyle(el).transitionDelay)
      );
    expect(delay1).toBeLessThan(delay2);
  });

  test('`sibling-index()` is multiplied by a time and used as the `animation-delay`.', async ({ page }) => {
    await page.goto(demoUrl);
    const cssText = await page.evaluate(() => {
      const chunks: string[] = [];
      for (const ss of Array.from(document.styleSheets)) {
        try {
          for (const r of Array.from(ss.cssRules)) {
            chunks.push(r.cssText);
          }
        } catch {
          // Ignore cross-origin stylesheets
        }
      }
      return chunks.join('\n');
    });
    const delayPropPattern = /(?:animation(?:-delay)?|transition(?:-delay)?)\s*:/;
    const directMultipliedDelay =
      /(?:animation(?:-delay)?|transition(?:-delay)?)\s*:[^;{}]*(?:sibling-index\(\)[^;{}]*\*|\*[^;{}]*sibling-index\(\))/.test(
        cssText
      );
    const varDelay =
      /--[\w-]+\s*:\s*[^;{}]*sibling-index\(\)/.test(cssText) &&
      /(?:animation(?:-delay)?|transition(?:-delay)?)\s*:[^;{}]*var\(--/.test(cssText) &&
      (/--[\w-]+\s*:\s*[^;{}]*(?:sibling-index\(\)[^;{}]*\*|\*[^;{}]*sibling-index\(\))/.test(cssText) ||
        /(?:animation(?:-delay)?|transition(?:-delay)?)\s*:[^;{}]*\*/.test(cssText));
    expect(delayPropPattern.test(cssText)).toBe(true);
    expect(directMultipliedDelay || varDelay).toBe(true);
  });

  test('The implementation provides a fallback for older browsers using CSS custom properties.', async ({ page }) => {
    await page.goto(demoUrl);
    const cssText = await page.evaluate(() => {
      const chunks: string[] = [];
      for (const ss of Array.from(document.styleSheets)) {
        try {
          for (const r of Array.from(ss.cssRules)) {
            chunks.push(r.cssText);
          }
        } catch {
          // Ignore cross-origin stylesheets
        }
      }
      return chunks.join('\n');
    });
    const hasFallbackVar =
      /(?:animation(?:-delay)?|transition(?:-delay)?|--[\w-]+)\s*:[^;{}]*var\(--[\w-]+\)/.test(cssText);
    const hasSiblingIndex = /sibling-index\(\)/.test(cssText);
    expect(hasFallbackVar).toBe(true);
    expect(hasSiblingIndex).toBe(true);
  });

  test('The native `sibling-index()` delay is wrapped in an `@supports` block with a literal time condition rather than overriding the custom-property fallback unconditionally.', async ({ page }) => {
    await page.goto(demoUrl);
    const analysis = await page.evaluate(() => {
      let hasBaseCustomPropDelay = false;
      let hasSupportsGatedSiblingIndex = false;
      let hasUnguardedSiblingIndex = false;

      function inspectStyle(style: CSSStyleDeclaration, insidePositiveSiblingSupports: boolean) {
        const entries: Array<[string, string]> = [];
        for (let i = 0; i < style.length; i++) {
          const prop = style[i];
          entries.push([prop, style.getPropertyValue(prop)]);
        }
        // Shorthands containing var() serialize longhands as "" in CSSOM; inspect shorthands explicitly.
        for (const shorthand of ['animation', 'transition']) {
          const val = style.getPropertyValue(shorthand);
          if (val) {
            entries.push([shorthand, val]);
          }
        }

        for (const [prop, val] of entries) {
          if (!val) continue;
          const isDelayOrCustomProp =
            prop === 'animation-delay' ||
            prop === 'transition-delay' ||
            prop === 'animation' ||
            prop === 'transition' ||
            prop.startsWith('--');
          if (
            !insidePositiveSiblingSupports &&
            isDelayOrCustomProp &&
            val.includes('var(--') &&
            !val.includes('sibling-index(') &&
            prop !== '--stagger-time'
          ) {
            if (/var\(--(?!stagger-time\b)[\w-]+/.test(val)) {
              hasBaseCustomPropDelay = true;
            }
          }
          if (val.includes('sibling-index(')) {
            if (insidePositiveSiblingSupports) {
              hasSupportsGatedSiblingIndex = true;
            } else {
              hasUnguardedSiblingIndex = true;
            }
          }
        }
      }

      function walk(rules: CSSRuleList, insidePositiveSiblingSupports: boolean) {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSSupportsRule) {
            const cond = rule.conditionText;
            const mentionsSiblingIndex = cond.includes('sibling-index');
            const isNegated = /^\s*\(*\s*not\b/i.test(cond);
            const isPositiveSiblingSupports =
              mentionsSiblingIndex && !isNegated && !cond.includes('var(');
            const nextInside =
              mentionsSiblingIndex && isNegated
                ? false
                : insidePositiveSiblingSupports || isPositiveSiblingSupports;
            walk(rule.cssRules, nextInside);
            continue;
          }
          if ('style' in rule && (rule as CSSStyleRule).style) {
            inspectStyle((rule as CSSStyleRule).style, insidePositiveSiblingSupports);
          }
          if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules?.length) {
            walk((rule as CSSGroupingRule).cssRules, insidePositiveSiblingSupports);
          }
        }
      }

      for (const sheet of Array.from(document.styleSheets)) {
        try {
          walk(sheet.cssRules, false);
        } catch {
          // Ignore cross-origin stylesheets
        }
      }

      return {
        hasBaseCustomPropDelay,
        hasSupportsGatedSiblingIndex,
        hasUnguardedSiblingIndex,
      };
    });

    expect(analysis.hasBaseCustomPropDelay).toBe(true);
    expect(analysis.hasSupportsGatedSiblingIndex).toBe(true);
    expect(analysis.hasUnguardedSiblingIndex).toBe(false);
  });

  test('The custom property values start at 1 and increment for each sibling.', async ({ page }) => {
    await page.addInitScript(() => {
      const originalSupports = CSS.supports.bind(CSS);
      (window as unknown as { CSS: typeof CSS }).CSS.supports = function (condition: string, value?: string) {
        const fullExpr = value !== undefined ? `${condition}: ${value}` : String(condition);
        // Real browsers lacking sibling-index() return false only when var() is absent;
        // if var() is present, parse-time validation succeeds and CSS.supports() returns true.
        if (fullExpr.includes('sibling-index') && !fullExpr.includes('var(')) {
          return false;
        }
        return value !== undefined
          ? originalSupports(condition, value)
          : originalSupports(condition);
      };
    });
    await page.goto(demoUrl);
    const selector = '.item, .card, .grid > *';
    const readInlineIndexProp = (el: HTMLElement): string => {
      const named = el.style.getPropertyValue('--sibling-index').trim();
      if (named) return named;
      for (let i = 0; i < el.style.length; i++) {
        const prop = el.style[i];
        if (prop.startsWith('--')) {
          return el.style.getPropertyValue(prop).trim();
        }
      }
      return window.getComputedStyle(el).getPropertyValue('--sibling-index').trim();
    };
    const prop1 = await page.locator(selector).nth(0).evaluate(readInlineIndexProp);
    const prop2 = await page.locator(selector).nth(1).evaluate(readInlineIndexProp);
    expect(prop1).toBe('1');
    expect(prop2).toBe('2');
  });

  test('The fallback is applied conditionally only when `sibling-index()` is not supported.', async ({ page }) => {
    await page.addInitScript(() => {
      const originalSupports = CSS.supports.bind(CSS);
      (window as unknown as { CSS: typeof CSS }).CSS.supports = function (condition: string, value?: string) {
        const fullExpr = value !== undefined ? `${condition}: ${value}` : String(condition);
        if (fullExpr.includes('sibling-index')) {
          return true;
        }
        return value !== undefined
          ? originalSupports(condition, value)
          : originalSupports(condition);
      };
    });
    await page.goto(demoUrl);
    const selector = '.item, .card, .grid > *';
    const prop1 = await page.locator(selector).nth(0).evaluate((el: HTMLElement) => {
      const named = el.style.getPropertyValue('--sibling-index').trim();
      if (named) return named;
      for (let i = 0; i < el.style.length; i++) {
        const prop = el.style[i];
        if (prop.startsWith('--')) {
          return el.style.getPropertyValue(prop).trim();
        }
      }
      return '';
    });
    expect(prop1).toBe('');
  });

  test('If the user prefers reduced motion, the animation is disabled.', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(demoUrl);
    const selector = '.item, .card, .grid > *';
    const animName = await page
      .locator(selector)
      .nth(0)
      .evaluate((el) => window.getComputedStyle(el).animationName);
    expect(animName).toBe('none');
  });
});
