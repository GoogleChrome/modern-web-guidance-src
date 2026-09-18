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

test.describe(`Scrollbar Customization Expectations: ${demoName}`, () => {
  // Static assertions
  test('Standard scrollbar-width property is used in CSS', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/scrollbar-width\s*:/);
  });

  test('Standard scrollbar-color property is used in CSS', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/scrollbar-color\s*:/);
  });

  test('Legacy ::-webkit-scrollbar is wrapped in @supports not (scrollbar-color: auto)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check if @supports not (scrollbar-color: auto) exists and contains ::-webkit-scrollbar
    const supportsMatch = html.match(/@supports\s+not\s*\(\s*scrollbar-color\s*:\s*auto\s*\)\s*{[^}]*::-webkit-scrollbar/s);
    expect(supportsMatch).not.toBeNull();
  });

  test('Legacy ::-webkit-scrollbar has width or height defined for visibility', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // We check for width or height inside the @supports block to ensure it's part of the correctly implemented fallback
    const legacySizingMatch = html.match(/@supports\s+not\s*\(\s*scrollbar-color\s*:\s*auto\s*\)\s*{[^}]*::-webkit-scrollbar\s*{[^}]*(width|height)\s*:/s);
    expect(legacySizingMatch).not.toBeNull();
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
  test('Scrollable element has scrollbar-width applied', async ({ page }) => {
    const hasScrollbarWidth = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = getComputedStyle(el);
        const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
        const hasRule = document.querySelector('style')?.textContent?.includes('scrollbar-width') || Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => rule.cssText.includes('scrollbar-width'));
          } catch (e) { return false; }
        });
        return isScrollable && (style.scrollbarWidth !== 'auto' || hasRule);
      });
    });
    expect(hasScrollbarWidth).toBe(true);
  });

  test('Scrollable element has scrollbar-color applied', async ({ page }) => {
    const hasScrollbarColor = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(el => {
        const style = getComputedStyle(el);
        const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll';
        const hasRule = document.querySelector('style')?.textContent?.includes('scrollbar-color') || Array.from(document.styleSheets).some(sheet => {
          try {
            return Array.from(sheet.cssRules).some(rule => rule.cssText.includes('scrollbar-color'));
          } catch (e) { return false; }
        });
        return isScrollable && (style.scrollbarColor !== 'auto' || hasRule);
      });
    });
    expect(hasScrollbarColor).toBe(true);
  });
});
