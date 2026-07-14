import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetPath = process.env.TARGET_FILE || path.resolve(__dirname, 'demo.html');
const targetUrl = pathToFileURL(targetPath).href;

test.describe('Overflow Clipping Control Grader', () => {

  // Test 1: Controlled clipping with concentric curved boundaries
  test('controlled clipping on block layout containers using content-box alignment', async ({ page }) => {
    await page.goto(targetUrl);
    const style = await page.evaluate(() => {
      const el = document.querySelector('.nested-curve-parent');
      if (!el) return null;
      const comp = window.getComputedStyle(el);
      return {
        overflow: comp.overflow,
        overflowClipMargin: comp.overflowClipMargin || comp.getPropertyValue('overflow-clip-margin'),
        display: comp.display
      };
    });
    
    expect(style).not.toBeNull();
    expect(style).toEqual(expect.objectContaining({
      overflow: 'clip',
      overflowClipMargin: 'content-box'
    }));
    expect(style!.display).not.toContain('inline');
  });

  // Test 2: Apply a box-edge keyword to configure inner curved clip margins
  test('apply a box-edge keyword to configure inner curved clip margins', async ({ page }) => {
    await page.goto(targetUrl);
    const hasBoxEdge = await page.evaluate(() => {
      const el = document.querySelector('.nested-curve-parent');
      if (!el) return false;
      const comp = window.getComputedStyle(el);
      const val = comp.overflowClipMargin || comp.getPropertyValue('overflow-clip-margin');
      return ['content-box', 'padding-box', 'border-box'].some(kw => val.includes(kw));
    });
    expect(hasBoxEdge).toBe(true);
  });

  // Test 3: Apply a length value to configure extended offset clip margins
  test('apply a length value to configure extended offset clip margins', async ({ page }) => {
    await page.goto(targetUrl);
    const isLength = await page.evaluate(() => {
      const el = document.querySelector('.safety-zone-parent');
      if (!el) return false;
      const comp = window.getComputedStyle(el);
      const val = comp.overflowClipMargin || comp.getPropertyValue('overflow-clip-margin');
      return /\b\d+px\b/.test(val) && parseFloat(val) > 0;
    });
    expect(isLength).toBe(true);
  });

  // Test 4: Fallback overflow: hidden style on nested rounded containers
  test('apply overflow: hidden as primary fallback style on nested rounded containers', async ({ page }) => {
    await page.goto(targetUrl);
    const hasHiddenFallback = await page.evaluate(() => {
      function getRulesForSelector(selector: string) {
        const rules: any[] = [];
        function traverse(ruleList: any, inSupports: string | null = null) {
          for (let i = 0; i < ruleList.length; i++) {
            const rule = ruleList[i];
            if (rule instanceof CSSStyleRule) {
              if (rule.selectorText && rule.selectorText.includes(selector)) {
                rules.push({
                  selector: rule.selectorText,
                  overflow: rule.style.overflow || rule.style.getPropertyValue('overflow'),
                  supports: inSupports
                });
              }
            } else if (rule instanceof CSSSupportsRule) {
              traverse(rule.cssRules, rule.conditionText);
            } else if (rule && typeof rule === 'object' && 'cssRules' in rule) {
              traverse((rule as any).cssRules, inSupports);
            }
          }
        }
        for (let i = 0; i < document.styleSheets.length; i++) {
          const sheet = document.styleSheets[i];
          try {
            if (sheet.cssRules) {
              traverse(sheet.cssRules);
            }
          } catch (e: any) {
            // Rethrow non-security/access related errors
            if (e.name !== 'SecurityError') {
              throw e;
            }
          }
        }
        return rules;
      }

      const parentRules = getRulesForSelector('.nested-curve-parent');
      return parentRules.some(r => {
        const isHidden = r.overflow === 'hidden' || r.overflow?.includes('hidden');
        const isFallback = !r.supports || (!r.supports.includes('clip') && !r.supports.includes('overflow-clip-margin'));
        return isHidden && isFallback;
      });
    });
    expect(hasHiddenFallback).toBe(true);
  });

  // Test 5: Fallback overflow: visible style on safety zone containers
  test('apply overflow: visible or hidden fallback on safety zone containers', async ({ page }) => {
    await page.goto(targetUrl);
    const hasCorrectFallback = await page.evaluate(() => {
      function getRulesForSelector(selector: string) {
        const rules: any[] = [];
        function traverse(ruleList: any, inSupports: string | null = null) {
          for (let i = 0; i < ruleList.length; i++) {
            const rule = ruleList[i];
            if (rule instanceof CSSStyleRule) {
              if (rule.selectorText && rule.selectorText.includes(selector)) {
                rules.push({
                  selector: rule.selectorText,
                  overflow: rule.style.overflow || rule.style.getPropertyValue('overflow'),
                  supports: inSupports
                });
              }
            } else if (rule instanceof CSSSupportsRule) {
              traverse(rule.cssRules, rule.conditionText);
            } else if (rule && typeof rule === 'object' && 'cssRules' in rule) {
              traverse((rule as any).cssRules, inSupports);
            }
          }
        }
        for (let i = 0; i < document.styleSheets.length; i++) {
          const sheet = document.styleSheets[i];
          try {
            if (sheet.cssRules) {
              traverse(sheet.cssRules);
            }
          } catch (e: any) {
            if (e.name !== 'SecurityError') {
              throw e;
            }
          }
        }
        return rules;
      }

      const parentRules = getRulesForSelector('.safety-zone-parent');
      return parentRules.some(r => {
        const isOkFallback = r.overflow === 'visible' || r.overflow === 'hidden' || r.overflow?.includes('visible') || r.overflow?.includes('hidden');
        const isFallback = !r.supports || (!r.supports.includes('clip') && !r.supports.includes('overflow-clip-margin'));
        return isOkFallback && isFallback;
      });
    });
    expect(hasCorrectFallback).toBe(true);
  });

  // Test 6: Must NOT apply overflow: scroll or overflow: auto on target elements when visual intent is strictly clipping content
  test('must NOT apply overflow: scroll or overflow: auto on target elements', async ({ page }) => {
    await page.goto(targetUrl);
    const usesScrolling = await page.evaluate(() => {
      const elements = ['.nested-curve-parent', '.safety-zone-parent'];
      for (const sel of elements) {
        const el = document.querySelector(sel);
        if (el) {
          const comp = window.getComputedStyle(el);
          if (comp.overflow === 'scroll' || comp.overflow === 'auto') {
            return true;
          }
        }
      }
      return false;
    });
    expect(usesScrolling).toBe(false);
  });

});
