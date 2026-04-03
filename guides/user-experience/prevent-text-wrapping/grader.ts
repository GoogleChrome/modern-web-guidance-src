import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Prevent Text Wrapping Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Mock local file serving
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

  test(`The 'text-wrap' property is authored with 'nowrap' for the target element`, async ({ page }) => {
    const isAuthored = await page.evaluate(() => {
      const el = document.getElementById('target');
      if (!el) return false;

      // Helper to check if a property is set to a value in a declaration
      const hasProp = (style: CSSStyleDeclaration) => {
        // We check both the property name and the shorthand decomposition
        return style.getPropertyValue('text-wrap').includes('nowrap') || 
               style.getPropertyValue('text-wrap-mode').includes('nowrap');
      };

      // Check inline style
      if (hasProp(el.style)) return true;

      // Check stylesheets
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
              if (hasProp(rule.style)) return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(isAuthored, "Target element should have 'text-wrap: nowrap' authored in CSS or style attribute").toBe(true);
  });

  test(`A fallback using 'white-space: nowrap' is authored for the target element`, async ({ page }) => {
    const isAuthored = await page.evaluate(() => {
      const el = document.getElementById('target');
      if (!el) return false;

      const hasProp = (style: CSSStyleDeclaration) => {
        return style.getPropertyValue('white-space').includes('nowrap');
      };

      if (hasProp(el.style)) return true;

      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSStyleRule && el.matches(rule.selectorText)) {
              if (hasProp(rule.style)) return true;
            }
          }
        } catch (e) {}
      }
      return false;
    });
    expect(isAuthored, "Target element should have 'white-space: nowrap' authored as a fallback").toBe(true);
  });

  test(`Computed 'text-wrap' (or its mode) is correctly set to 'nowrap'`, async ({ page }) => {
    const target = page.locator('#target');
    // In modern browsers, text-wrap: nowrap sets text-wrap-mode: nowrap
    const computed = await target.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.getPropertyValue('text-wrap') || style.getPropertyValue('text-wrap-mode');
    });
    expect(computed).toBe('nowrap');
  });

  test(`The text does not wrap and remains on a single line`, async ({ page }) => {
    const target = page.locator('#target');
    const isSingleLine = await target.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const height = el.getBoundingClientRect().height;
      
      // Get line-height (fall back to a reasonable multiplier if 'normal')
      let lineHeight = parseFloat(style.lineHeight);
      if (isNaN(lineHeight)) {
        const fontSize = parseFloat(style.fontSize);
        lineHeight = fontSize * 1.5; // 'normal' is typically 1.2-1.5
      }

      // A single line should not be significantly taller than its line-height.
      // If it wraps, the height would be at least ~2x the line-height.
      return height < (lineHeight * 1.8); 
    });

    expect(isSingleLine, "Target element height suggests the text has wrapped to multiple lines").toBe(true);

    // Verify it correctly handles the possibility of overflow
    const { scrollWidth, clientWidth } = await target.evaluate(el => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth
    }));
    
    // If nowrap is working on long text, scrollWidth should be >= clientWidth
    expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
  });

  test(`If text-overflow: ellipsis is used, overflow: hidden is also applied`, async ({ page }) => {
    const check = await page.evaluate(() => {
      const el = document.getElementById('target-truncated');
      if (!el) return { found: false };

      const style = window.getComputedStyle(el);
      const textOverflow = style.getPropertyValue('text-overflow');
      const overflow = style.getPropertyValue('overflow');

      return {
        found: true,
        textOverflow,
        overflow
      };
    });

    if (check.found && (check.textOverflow === 'ellipsis')) {
      expect(check.overflow, "When text-overflow: ellipsis is used, overflow must be set to something other than 'visible' (e.g., 'hidden')").not.toBe('visible');
    }
  });
});
