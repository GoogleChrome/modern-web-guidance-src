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
  test(`The <img> element for 'hero-lcp.jpg' has the fetchpriority="high" attribute`, async ({ page }) => {
    await expect(page.locator('img[src*="hero-lcp.jpg"]')).toHaveAttribute('fetchpriority', 'high');
  });

  test(`The <img> element for 'hero-lcp.jpg' does NOT have the loading="lazy" attribute`, async ({ page }) => {
    await expect(page.locator('img[src*="hero-lcp.jpg"]')).not.toHaveAttribute('loading', 'lazy');
  });

  test(`The <img> element for 'gallery-alt.jpg' has the fetchpriority="low" attribute`, async ({ page }) => {
    await expect(page.locator('img[src*="gallery-alt.jpg"]')).toHaveAttribute('fetchpriority', 'low');
  });

  test(`The <img> element for 'mega-menu-promo.jpg' has the fetchpriority="low" attribute`, async ({ page }) => {
    await expect(page.locator('img[src*="mega-menu-promo.jpg"]')).toHaveAttribute('fetchpriority', 'low');
  });

  test(`The <img> element for 'footer-logo.png' does NOT have the fetchpriority attribute`, async ({ page }) => {
    await expect(page.locator('img[src*="footer-logo.png"]')).not.toHaveAttribute('fetchpriority');
  });

  test(`No more than two <img> elements on the page have the fetchpriority="high" attribute`, async ({ page }) => {
    const count = await page.locator('img[fetchpriority="high"]').count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test(`No image elements located below the fold have the fetchpriority="high" attribute`, async ({ page }) => {
    const belowFoldHighPriorityCount = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img[fetchpriority="high"]'));
      return imgs.filter(img => img.getBoundingClientRect().top >= window.innerHeight).length;
    });
    expect(belowFoldHighPriorityCount).toBe(0);
  });

  test(`No <img> elements have the deprecated importance attribute`, async ({ page }) => {
    await expect(page.locator('img[importance]')).toHaveCount(0);
  });
});
