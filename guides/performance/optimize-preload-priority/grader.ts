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

const MIME_BY_EXT: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg',
  '.webm': 'video/webm',
};

// Tests
test.describe(`optimize-preload-priority Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        const ext = path.extname(requestPath).toLowerCase();
        await route.fulfill({
          status: 200,
          contentType: MIME_BY_EXT[ext] || 'application/octet-stream',
          body: '',
        });
      }
    });

    await page.goto(demoUrl);
  });

  test("The <link rel=\"preload\" as=\"image\"> element for 'poster.jpg' has the fetchpriority=\"high\" attribute.", async ({ page }) => {
    const posterPreload = page.locator('link[rel="preload"][as="image"][href*="poster.jpg"]');
    await expect(posterPreload).toHaveCount(1);
    await expect(posterPreload).toHaveAttribute('fetchpriority', 'high');
  });

  test("The <link rel=\"preload\" as=\"font\"> element for 'brand-font.woff2' does not set the fetchpriority=\"high\" attribute.", async ({ page }) => {
    const brandFontPreload = page.locator('link[rel="preload"][as="font"][href*="brand-font.woff2"]');
    await expect(brandFontPreload).toHaveCount(1);
    await expect(brandFontPreload).not.toHaveAttribute('fetchpriority', 'high');
  });

  test('Every <link rel="preload" as="font"> element includes the crossorigin attribute.', async ({ page }) => {
    const fontPreloads = page.locator('link[rel="preload"][as="font"]');
    const count = await fontPreloads.count();
    expect(count).toBeGreaterThan(0);
    const missingCrossorigin = await fontPreloads.evaluateAll(
      (links) => links.filter((el) => !el.hasAttribute('crossorigin')).length,
    );
    expect(missingCrossorigin).toBe(0);
  });

  test("The <link rel=\"preload\" as=\"font\"> element for 'secondary-font.woff2' has the fetchpriority=\"low\" attribute.", async ({ page }) => {
    const secondaryFontPreload = page.locator('link[rel="preload"][as="font"][href*="secondary-font.woff2"]');
    await expect(secondaryFontPreload).toHaveCount(1);
    await expect(secondaryFontPreload).toHaveAttribute('fetchpriority', 'low');
  });

  test("The critical stylesheet 'critical-theme.css' is preloaded with <link rel=\"preload\" as=\"style\"> and is not deprioritized with fetchpriority=\"low\".", async ({ page }) => {
    const stylePreload = page.locator('link[rel="preload"][as="style"][href*="critical-theme.css"]');
    await expect(stylePreload).toHaveCount(1);
    await expect(stylePreload).not.toHaveAttribute('fetchpriority', 'low');
  });

  test("The critical ES module 'app.js' is preloaded with <link rel=\"modulepreload\"> rather than <link rel=\"preload\" as=\"script\">.", async ({ page }) => {
    const modulePreload = page.locator('link[rel="modulepreload"][href*="app.js"]');
    await expect(modulePreload).toHaveCount(1);
    await expect(page.locator('link[rel="preload"][as="script"][href*="app.js"]')).toHaveCount(0);
  });

  test("The <link rel=\"modulepreload\"> element for 'app.js' has the fetchpriority=\"high\" attribute.", async ({ page }) => {
    const modulePreload = page.locator('link[rel="modulepreload"][href*="app.js"]');
    await expect(modulePreload).toHaveCount(1);
    await expect(modulePreload).toHaveAttribute('fetchpriority', 'high');
  });

  test("The background ES module 'analytics.js' is deprioritized with fetchpriority=\"low\" without using fetchpriority=\"high\" or <link rel=\"preload\" as=\"script\">.", async ({ page }) => {
    const lowPriorityAnalytics = page.locator(
      'link[rel="modulepreload"][href*="analytics.js"][fetchpriority="low"], script[src*="analytics.js"][fetchpriority="low"]',
    );
    expect(await lowPriorityAnalytics.count()).toBeGreaterThan(0);
    await expect(
      page.locator('link[href*="analytics.js"][fetchpriority="high"], script[src*="analytics.js"][fetchpriority="high"]'),
    ).toHaveCount(0);
    await expect(page.locator('link[rel="preload"][as="script"][href*="analytics.js"]')).toHaveCount(0);
  });

  test('At least one <link rel="preload" as="image"> element is present and no more than two <link rel="preload" as="image"> elements on the page have the fetchpriority="high" attribute.', async ({ page }) => {
    const allImagePreloads = await page.locator('link[rel="preload"][as="image"]').count();
    expect(allImagePreloads).toBeGreaterThan(0);
    const count = await page.locator('link[rel="preload"][as="image"][fetchpriority="high"]').count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test('At least one preload or modulepreload <link> element is present and no <link> elements have the deprecated importance attribute.', async ({ page }) => {
    const hintCount = await page.locator('link[rel="preload"], link[rel="modulepreload"]').count();
    expect(hintCount).toBeGreaterThan(0);
    await expect(page.locator('link[importance]')).toHaveCount(0);
  });
});
