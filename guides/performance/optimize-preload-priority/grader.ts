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
test.describe(`Optimize Preload Priority Expectations: ${demoName}`, () => {
  
  // Static assertions (Functional tests)
  test('The <link rel="preload" as="image"> for "poster.jpg" has the fetchpriority="high" attribute', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const posterPreloadMatch = html.match(/<link[^>]+href=["']poster\.jpg["'][^>]*>/i);
    expect(posterPreloadMatch, 'A link with href="poster.jpg" should exist').not.toBeNull();
    const tag = posterPreloadMatch![0];
    expect(tag).toMatch(/rel=["']preload["']/i);
    expect(tag).toMatch(/as=["']image["']/i);
    expect(tag).toMatch(/fetchpriority=["']high["']/i);
  });

  test('The <link rel="preload" as="font"> for "brand-font.woff2" exists and does NOT use the fetchpriority="high" attribute', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const brandFontMatch = html.match(/<link[^>]+href=["']brand-font\.woff2["'][^>]*>/i);
    expect(brandFontMatch, 'A link with href="brand-font.woff2" should exist').not.toBeNull();
    const tag = brandFontMatch![0];
    expect(tag).toMatch(/rel=["']preload["']/i);
    expect(tag).toMatch(/as=["']font["']/i);
    expect(tag).not.toMatch(/fetchpriority=["']high["']/i);
  });

  test('The <link rel="preload" as="font"> for "secondary-font.woff2" has the fetchpriority="low" attribute', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const secondaryFontMatch = html.match(/<link[^>]+href=["']secondary-font\.woff2["'][^>]*>/i);
    expect(secondaryFontMatch, 'A link with href="secondary-font.woff2" should exist').not.toBeNull();
    const tag = secondaryFontMatch![0];
    expect(tag).toMatch(/rel=["']preload["']/i);
    expect(tag).toMatch(/as=["']font["']/i);
    expect(tag).toMatch(/fetchpriority=["']low["']/i);
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
  test('All <link rel="preload" as="font"> elements include the crossorigin attribute', async ({ page }) => {
    const fontPreloads = page.locator('link[rel="preload"][as="font"]');
    const count = await fontPreloads.count();
    expect(count, 'There should be at least one font preload').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const preload = fontPreloads.nth(i);
      const hasCrossOrigin = await preload.evaluate(el => el.hasAttribute('crossorigin'));
      expect(hasCrossOrigin, `Font preload ${i} should have the crossorigin attribute`).toBe(true);
    }
  });

  test('No more than two <link rel="preload" as="image"> elements have the fetchpriority="high" attribute', async ({ page }) => {
    const highPriorityImagePreloads = page.locator('link[rel="preload"][as="image"][fetchpriority="high"]');
    const count = await highPriorityImagePreloads.count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test('No <link> elements have the deprecated importance attribute', async ({ page }) => {
    const importanceElements = page.locator('link[importance]');
    await expect(importanceElements).toHaveCount(0);
  });
});
