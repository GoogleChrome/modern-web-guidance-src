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

test.describe(`defer-rendering-heavy-content Expectations: ${demoName}`, () => {

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
    // Wait for the app's async rendering
    await page.waitForSelector('.card', { state: 'attached', timeout: 5000 }).catch(() => { });
  });

  // 1. Cards with class name `.off-screen-card` must be outside the initial viewport.
  test('Cards with class name `.off-screen-card` must be outside the initial viewport', async ({ page }) => {
    const cards = page.locator('.off-screen-card');
    const count = await cards.count();
    expect(count, 'Expected at least one element with class off-screen-card').toBeGreaterThan(0);

    const isOutside = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.off-screen-card'));
      return els.every(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= window.innerHeight || rect.bottom <= 0;
      });
    });

    expect(isOutside, 'All .off-screen-card elements must be outside the initial viewport').toBe(true);
  });

  // 2. Cards with class name `.off-screen-card` must set `content-visibility: auto`.
  test('Cards with class name `.off-screen-card` must set `content-visibility: auto`', async ({ page }) => {
    const cards = page.locator('.off-screen-card');
    const count = await cards.count();
    expect(count, 'Expected at least one element with class off-screen-card').toBeGreaterThan(0);

    const hasContentVisibilityAuto = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.off-screen-card'));
      return els.every(el => {
        const style = window.getComputedStyle(el);
        return style.contentVisibility === 'auto';
      });
    });

    expect(hasContentVisibilityAuto, 'All .off-screen-card elements must have content-visibility: auto').toBe(true);
  });

  // 3. Cards with class name `.off-screen-card` must set `contain-intrinsic-size`.
  test('Cards with class name `.off-screen-card` must set `contain-intrinsic-size`', async ({ page }) => {
    const cards = page.locator('.off-screen-card');
    const count = await cards.count();
    expect(count, 'Expected at least one element with class off-screen-card').toBeGreaterThan(0);

    const hasContainIntrinsicSize = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.off-screen-card'));
      return els.every(el => {
        const style = window.getComputedStyle(el);
        return style.containIntrinsicSize !== 'none' && style.containIntrinsicSize !== '';
      });
    });

    expect(hasContainIntrinsicSize, 'All .off-screen-card elements must have contain-intrinsic-size set').toBe(true);
  });

  // 4. The `.debug-panel` must be hidden using `content-visibility: hidden`.
  test('The `.debug-panel` must be hidden using `content-visibility: hidden`', async ({ page }) => {
    const panel = page.locator('.debug-panel');
    await expect(panel, 'Missing .debug-panel element').toBeAttached();

    const isHidden = await panel.evaluate(el => window.getComputedStyle(el).contentVisibility === 'hidden');
    expect(isHidden, '.debug-panel must be hidden using content-visibility: hidden').toBe(true);
  });

  // 5. The `debug-panel` must use a fallback strategy for unsupported browsers.
  test('The `debug-panel` must use a fallback strategy for unsupported browsers', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasCSSFeatureDetection = /@supports\s*(?:not\s*)?\(\s*content-visibility\s*:\s*hidden\s*\)/.test(html);
    expect(hasCSSFeatureDetection, 'Missing CSS feature detection for content-visibility: hidden').toBe(true);
  });

});
