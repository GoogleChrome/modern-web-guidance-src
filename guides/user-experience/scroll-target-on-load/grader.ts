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

// Tests
test.describe(`Scroll Target on Load Expectations: ${demoName}`, () => {
  let html: string;
  
  test.beforeAll(() => {
    html = fs.readFileSync(filePath, 'utf-8');
  });

  // Static assertions
  test(`The implementation MUST NOT rely on JavaScript to calculate the initial scroll offset as its primary mechanism`, async () => {
    expect(html).not.toMatch(/setTimeout\(/);
  });

  test(`A progressive enhancement JavaScript fallback MUST be included and evaluate native CSS capability`, async () => {
    expect(html).toMatch(/!CSS\.supports\(\s*['"]scroll-initial-target['"]\s*,\s*['"]nearest['"]\s*\)/);
  });

  test(`The fallback script MUST execute as soon as possible after the scroll container HTML is declared, and no later than DOMContentLoaded`, async () => {
    expect(html).toMatch(/DOMContentLoaded/);
  });

  test(`Inside the fallback check, the script MUST scroll to the target element using element.scrollIntoView({ behavior: 'instant' })`, async () => {
    expect(html).toMatch(/\.scrollIntoView\(\s*\{\s*behavior\s*:\s*['"]instant['"]/);
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
      let targetElements = [];
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.style.getPropertyValue('scroll-initial-target') === 'nearest' || 
                  rule.cssText.includes('scroll-initial-target: nearest')) {
                const els = document.querySelectorAll(rule.selectorText);
                targetElements.push(...Array.from(els));
              }
            }
          }
        } catch(e) {
          if (e instanceof Error && e.name !== 'SecurityError') throw e;
        }
      }

      if (targetElements.length === 0) return false;

      for (const targetElement of targetElements) {
        let parent = targetElement.parentElement;
        while (parent && parent !== document.body && parent !== document.documentElement) {
          const style = window.getComputedStyle(parent);
          const overflow = style.overflow + style.overflowX + style.overflowY;
          if (overflow.includes('auto') || overflow.includes('scroll')) {
            return true;
          }
          parent = parent.parentElement;
        }
      }
      return false;
    });

    expect(hasScrollContainer).toBe(true);
  });

  test(`A specific target element MUST be defined and uniquely have the scroll-initial-target property applied`, async ({ page }) => {
    const targetCount = await page.evaluate(() => {
      let count = 0;
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
              if (rule.style.getPropertyValue('scroll-initial-target') === 'nearest' || 
                  rule.cssText.includes('scroll-initial-target: nearest')) {
                count += document.querySelectorAll(rule.selectorText).length;
              }
            }
          }
        } catch(e) {
          if (e instanceof Error && e.name !== 'SecurityError') throw e;
        }
      }
      return count;
    });
    expect(targetCount).toBe(1);
  });

  test(`Media elements within the scroll container MUST have explicit dimensions applied`, async ({ page }) => {
    const unstyledMediaCount = await page.evaluate(() => {
      const mediaElements = document.querySelectorAll('img, video, iframe');
      let invalidCount = 0;
      for (const media of Array.from(mediaElements)) {
        const hasWidthAttr = media.hasAttribute('width');
        const hasHeightAttr = media.hasAttribute('height');
        
        // Ensure both width and height are provided to prevent layout shifts.
        if (!(hasWidthAttr && hasHeightAttr)) {
          invalidCount++;
        }
      }
      return invalidCount;
    });
    expect(unstyledMediaCount).toBe(0);
  });
});
