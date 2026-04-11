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

test.describe(`Visually Stable Mixed Fonts: ${demoName}`, () => {

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

    await page.goto(demoUrl);
  });

  test('In the Mixed Fonts example, font-size-adjust is applied to the text container', async ({ page }) => {
    const isApplied = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('p, div, section, article'));
      return containers.some(container => {
        const spans = Array.from(container.querySelectorAll('span, code'));
        if (spans.length === 0) return false;
        
        const style = window.getComputedStyle(container);
        const childFonts = spans.map(s => window.getComputedStyle(s).fontFamily);
        const hasMixedFonts = childFonts.some(f => f !== style.fontFamily);
        if (!hasMixedFonts) return false;

        // Check for font-size-adjust in computed style or CSS rules
        if (style.fontSizeAdjust && style.fontSizeAdjust !== 'none') return true;

        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule instanceof CSSStyleRule && container.matches(rule.selectorText)) {
                if (rule.style.fontSizeAdjust) return true;
              }
              if (rule instanceof CSSGroupingRule) {
                for (const subRule of Array.from(rule.cssRules)) {
                  if (subRule instanceof CSSStyleRule && container.matches(subRule.selectorText)) {
                    if (subRule.style.fontSizeAdjust) return true;
                  }
                }
              }
            }
          } catch (e) {}
        }
        return false;
      });
    });
    expect(isApplied).toBe(true);
  });

  test('In the Mixed Fonts example, the from-font keyword is used', async ({ page }) => {
    const usesFromFont = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            const hasFromFont = (style: CSSStyleDeclaration) => style.fontSizeAdjust && style.fontSizeAdjust.includes('from-font');
            if (rule instanceof CSSStyleRule && hasFromFont(rule.style)) return true;
            if (rule instanceof CSSGroupingRule) {
              for (const subRule of Array.from(rule.cssRules)) {
                if (subRule instanceof CSSStyleRule && hasFromFont(subRule.style)) return true;
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(usesFromFont).toBe(true);
  });



  test('A @supports rule or other fallback strategy is provided', async ({ page }) => {
    const hasFallback = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSSupportsRule && rule.conditionText.includes('font-size-adjust')) return true;
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasFallback).toBe(true);
  });

  test('In the independent theme container, the font-size-adjust property is applied with a specific numeric value to normalize proportions independently', async ({ page }) => {
    const hasNumeric = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            const isNumeric = (s: CSSStyleDeclaration) => s.fontSizeAdjust && !isNaN(parseFloat(s.fontSizeAdjust)) && isFinite(parseFloat(s.fontSizeAdjust) as any);
            if (rule instanceof CSSStyleRule && isNumeric(rule.style)) return true;
            if (rule instanceof CSSGroupingRule) {
              for (const subRule of Array.from(rule.cssRules)) {
                if (subRule instanceof CSSStyleRule && isNumeric(subRule.style)) return true;
              }
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(hasNumeric).toBe(true);
  });

});
