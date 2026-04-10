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

  test('In the Mixed Fonts example, nested elements have height close to the line height', async ({ page }) => {
    const isNormalized = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('p, div, section, article')).filter(el => {
        const style = window.getComputedStyle(el);
        // Check if it has font-size-adjust or if we should check any container with mixed fonts
        // For the grader, we look for the one that IS adjusted
        return style.fontSizeAdjust && style.fontSizeAdjust !== 'none';
      });

      if (containers.length === 0) {
        // Fallback: check CSS rules if browser doesn't support computed property
        const adjustedSelectors: string[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule instanceof CSSStyleRule && rule.style.fontSizeAdjust) adjustedSelectors.push(rule.selectorText);
            }
          } catch (e) {}
        }
        if (adjustedSelectors.length > 0) {
          containers.push(...Array.from(document.querySelectorAll(adjustedSelectors.join(','))) as HTMLElement[]);
        }
      }

      return containers.some(container => {
        const spans = Array.from(container.querySelectorAll('span, code'));
        if (spans.length === 0) return false;
        const parentFontSize = parseFloat(window.getComputedStyle(container).fontSize);
        return spans.some(span => {
          const height = span.getBoundingClientRect().height;
          return height >= parentFontSize * 0.8 && height <= parentFontSize * 1.6;
        });
      });
    });
    expect(isNormalized).toBe(true);
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

  test('In the Font Replacement example, font-size-adjust is applied to the swapped font', async ({ page }) => {
    // Click button to ensure the swap is active/visible if it depends on it
    const button = page.locator('button').first();
    await button.click();
    
    const isApplied = await page.evaluate(() => {
      const paragraphs = Array.from(document.querySelectorAll('p'));
      return paragraphs.some(p => {
        const style = window.getComputedStyle(p);
        if (style.fontSizeAdjust && style.fontSizeAdjust !== 'none') return true;
        
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule instanceof CSSStyleRule && p.matches(rule.selectorText) && rule.style.fontSizeAdjust) return true;
            }
          } catch (e) {}
        }
        return false;
      });
    });
    expect(isApplied).toBe(true);
  });

  test('In the Font Replacement example, font-size-adjust has a numeric value', async ({ page }) => {
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

  test('In the Font Replacement example, height does not shift drastically', async ({ page }) => {
    const pSelector = 'section p, div p';
    const paragraphs = page.locator(pSelector);
    const count = await paragraphs.count();
    
    const initialHeights: number[] = [];
    for (let i = 0; i < count; i++) {
      const box = await paragraphs.nth(i).boundingBox();
      initialHeights.push(box?.height || 0);
    }

    const button = page.locator('button').first();
    await button.click();
    await page.waitForTimeout(100);

    const newHeights: number[] = [];
    for (let i = 0; i < count; i++) {
      const box = await paragraphs.nth(i).boundingBox();
      newHeights.push(box?.height || 0);
    }

    let stableAdjustedFound = false;
    for (let i = 0; i < count; i++) {
      const hasAdjust = await paragraphs.nth(i).evaluate(el => {
        const style = window.getComputedStyle(el);
        if (style.fontSizeAdjust && style.fontSizeAdjust !== 'none') return true;
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            for (const rule of Array.from(sheet.cssRules)) {
              if (rule instanceof CSSStyleRule && el.matches(rule.selectorText) && rule.style.fontSizeAdjust) return true;
            }
          } catch (e) {}
        }
        return false;
      });

      if (hasAdjust) {
        const shift = Math.abs(initialHeights[i] - newHeights[i]);
        if (shift < 5) {
          stableAdjustedFound = true;
          break;
        }
      }
    }
    expect(stableAdjustedFound).toBe(true);
  });

});
