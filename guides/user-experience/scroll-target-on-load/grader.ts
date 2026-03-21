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

test.describe(`Scroll Target on Load Expectations: ${demoName}`, () => {
  // Static assertions
  test(`The implementation MUST NOT rely on JavaScript to calculate the initial scroll offset - no offset calculations`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/\.offsetTop|\.getBoundingClientRect/);
  });

  test(`The implementation MUST NOT rely on JavaScript to calculate the initial scroll offset - no scrollTo`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/\.scrollTo\(/);
  });

  test(`A progressive enhancement JavaScript fallback MUST be included and evaluate native CSS capability`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const normalizedHtml = html.replace(/\s+/g, ' ').replace(/'/g, '"');
    expect(normalizedHtml).toContain('!CSS.supports("scroll-initial-target", "nearest")');
  });

  test(`The fallback script MUST execute no later than DOMContentLoaded - avoids window.onload`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/window\.onload/);
  });

  test(`The fallback script MUST execute no later than DOMContentLoaded - uses DOMContentLoaded`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html.includes('DOMContentLoaded')).toBe(true);
  });

  test(`Inside the fallback check, the script MUST scroll to the target element using element.scrollIntoView({ behavior: 'instant' })`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const stripped = html.replace(/\s/g, '');
    expect(stripped).toMatch(/scrollIntoView\(\{.*behavior:['"`]instant['"`].*\}\)/);
  });

  // Setup browser testing
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

  // Browser assertions
  test(`The implementation MUST include an ancestor scroll container configured with scrolling`, async ({ page }) => {
    const hasScrollContainer = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (['auto', 'scroll'].includes(style.overflow) ||
            ['auto', 'scroll'].includes(style.overflowY) ||
            ['auto', 'scroll'].includes(style.overflowX)) {
          return true;
        }
      }
      return false;
    });
    expect(hasScrollContainer).toBe(true);
  });

  test(`A specific target element MUST be defined and have the scroll-initial-target: nearest CSS property applied directly to it`, async ({ page }) => {
    const ruleTargetsSpecificElement = await page.evaluate(() => {
      let isSpecific = false;
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.style.getPropertyValue('scroll-initial-target') === 'nearest' || rule.cssText.includes('scroll-initial-target: nearest')) {
                if (document.querySelectorAll(rule.selectorText).length === 1) {
                  isSpecific = true;
                }
              }
            }
          }
        } catch (e: any) {
          if (e.name !== 'SecurityError') {
            throw e;
          }
        }
      }
      
      document.querySelectorAll('[style*="scroll-initial-target"]').forEach(el => {
        if (el.getAttribute('style')?.includes('scroll-initial-target: nearest')) {
          isSpecific = true;
        }
      });
      
      return isSpecific;
    });
    
    expect(ruleTargetsSpecificElement).toBe(true);
  });

  test(`The scroll-initial-target property MUST be applied uniquely to the single target element within the container`, async ({ page }) => {
    const targetCount = await page.evaluate(() => {
      let count = 0;
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.style.getPropertyValue('scroll-initial-target') === 'nearest' || rule.cssText.includes('scroll-initial-target: nearest')) {
                count += document.querySelectorAll(rule.selectorText).length;
              }
            }
          }
        } catch (e: any) {
          if (e.name !== 'SecurityError') {
            throw e;
          }
        }
      }
      
      document.querySelectorAll('[style*="scroll-initial-target"]').forEach(el => {
        if (el.getAttribute('style')?.includes('scroll-initial-target: nearest')) {
          count++;
        }
      });
      
      return count;
    });
    
    expect(targetCount).toBe(1);
  });

  test(`Media elements within the scroll container MUST have explicit dimensions applied`, async ({ page }) => {
    const unconstrainedCount = await page.evaluate(() => {
      let count = 0;
      const images = document.querySelectorAll('img, video, iframe');
      for (const img of images) {
        if (img.hasAttribute('width') && img.hasAttribute('height')) continue;
        if ((img as HTMLElement).style.width && (img as HTMLElement).style.height) continue;
        if ((img as HTMLElement).style.aspectRatio) continue;
        
        let hasCssDimension = false;
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule instanceof CSSStyleRule) {
                if (img.matches(rule.selectorText)) {
                  if ((rule.style.width && rule.style.height) || rule.style.aspectRatio || rule.cssText.includes('aspect-ratio')) {
                    hasCssDimension = true;
                  }
                }
              }
            }
          } catch(e: any) {
            if (e.name !== 'SecurityError') {
              throw e;
            }
          }
        }
        if (!hasCssDimension) {
          count++;
        }
      }
      return count;
    });
    expect(unconstrainedCount).toBe(0);
  });
});
