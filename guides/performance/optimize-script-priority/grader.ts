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
test.describe(`optimize-script-priority Expectations: ${demoName}`, () => {
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
  test(`The script at /js/app.js has both the async and fetchpriority="high" attributes`, async ({ page }) => {
    await expect(page.locator('script[src="/js/app.js"][async][fetchpriority="high"]')).toHaveCount(1);
  });

  test(`The script at /js/legacy-widgets.js has the fetchpriority="low" attribute`, async ({ page }) => {
    await expect(page.locator('script[src="/js/legacy-widgets.js"]')).toHaveAttribute('fetchpriority', 'low');
  });

  test(`The script at /js/tracker.js does NOT have the fetchpriority="high" attribute`, async ({ page }) => {
    await expect(page.locator('script[src="/js/tracker.js"]')).not.toHaveAttribute('fetchpriority', 'high');
  });

  test(`No more than two <script> elements total on the page have the fetchpriority="high" attribute`, async ({ page }) => {
    const count = await page.locator('script[fetchpriority="high"]').count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test(`No <script> elements have the deprecated importance attribute`, async ({ page }) => {
    await expect(page.locator('script[importance]')).toHaveCount(0);
  });
});
