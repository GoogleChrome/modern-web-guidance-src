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
test.describe(`optimize-preload-priority Expectations: ${demoName}`, () => {
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
  test('The <link rel="preload" as="image"> for poster.jpg has the fetchpriority="high" attribute', async ({ page }) => {
    await expect(page.locator('link[rel="preload"][as="image"][href*="poster.jpg"]')).toHaveAttribute('fetchpriority', 'high');
  });

  test('The <link rel="preload" as="font"> for brand-font.woff2 has the fetchpriority="high" attribute', async ({ page }) => {
    await expect(page.locator('link[rel="preload"][as="font"][href*="brand-font.woff2"]')).toHaveAttribute('fetchpriority', 'high');
  });

  test('The <link rel="preload" as="font"> includes the crossorigin attribute', async ({ page }) => {
    await expect(page.locator('link[rel="preload"][as="font"][href*="brand-font.woff2"]')).toHaveAttribute('crossorigin');
  });

  test('The <link rel="preload" as="script"> for background-init.js has the fetchpriority="low" attribute', async ({ page }) => {
    await expect(page.locator('link[rel="preload"][as="script"][href*="background-init.js"]')).toHaveAttribute('fetchpriority', 'low');
  });

  test('No more than two <link rel="preload"> elements on the entire page have the fetchpriority="high" attribute', async ({ page }) => {
    const count = await page.locator('link[rel="preload"][fetchpriority="high"]').count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test('No <link> elements have the deprecated importance attribute', async ({ page }) => {
    await expect(page.locator('link[importance]')).toHaveCount(0);
  });
});
