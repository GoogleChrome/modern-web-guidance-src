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
test.describe(`Optimize image priority Expectations: ${demoName}`, () => {
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
  test('hero-lcp.jpg has high fetchpriority', async ({ page }) => {
    const img = page.locator('img[src*="hero-lcp.jpg"]');
    await expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  test('hero-lcp.jpg does not use lazy loading', async ({ page }) => {
    const img = page.locator('img[src*="hero-lcp.jpg"]');
    await expect(img).not.toHaveAttribute('loading', 'lazy');
  });

  test('At most two high priority images', async ({ page }) => {
    const highPriorityImgs = page.locator('img[fetchpriority="high"]');
    const count = await highPriorityImgs.count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test('gallery-alt.jpg has low fetchpriority', async ({ page }) => {
    const img = page.locator('img[src*="gallery-alt.jpg"]');
    await expect(img).toHaveAttribute('fetchpriority', 'low');
  });

  test('mega-menu-promo.jpg has low fetchpriority', async ({ page }) => {
    const img = page.locator('img[src*="mega-menu-promo.jpg"]');
    await expect(img).toHaveAttribute('fetchpriority', 'low');
  });

  test('footer-logo.png does not have fetchpriority attribute', async ({ page }) => {
    const img = page.locator('img[src*="footer-logo.png"]');
    await expect(img).not.toHaveAttribute('fetchpriority', /.*/);
  });

  test('No image uses deprecated importance attribute', async ({ page }) => {
    const importanceImgs = page.locator('img[importance]');
    const count = await importanceImgs.count();
    expect(count).toBe(0);
  });
});
