import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Invoker Commands API Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Route local files
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

  test('Buttons use commandfor and command attributes', async ({ page }) => {
    const buttons = page.locator('button[commandfor][command]');
    const count = await buttons.count();
    // Verify we have at least the required 4 buttons (Spin, Grow, Round, Reset)
    expect(count).toBeGreaterThanOrEqual(4);
    
    for (let i = 0; i < count; i++) {
      const cmd = await buttons.nth(i).getAttribute('command');
      expect(cmd).toMatch(/^--/);
    }
  });


  test('Invoker Commands API is available (natively or via polyfill)', async ({ page }) => {
    // Wait for either native support or the polyfill to be ready
    await page.waitForFunction(() => 'commandForElement' in HTMLButtonElement.prototype);
    
    const isAvailable = await page.evaluate(() => 'commandForElement' in HTMLButtonElement.prototype);
    expect(isAvailable).toBe(true);

    // Additionally check that at least one button is using the API to avoid 
    // false positives in environments where the browser supports it natively 
    // but the page doesn't actually use it (like in the negative-demo).
    const invokerButton = page.locator('button[commandfor]');
    await expect(invokerButton.first()).toBeVisible();
  });

  test('Clicking Spin toggles is-spun class on target element', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Spin/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    await expect(target).toHaveClass(/is-spun/);
  });

  test('Clicking Grow toggles is-grown class on target element', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Grow/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    await expect(target).toHaveClass(/is-grown/);
  });

  test('Clicking Make Round toggles is-rounded class on target element', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Make Round/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    await expect(target).toHaveClass(/is-rounded/);
  });

  test('Clicking Reset All removes all transformation classes', async ({ page }) => {
    // Setup: Apply all transformations first
    await page.getByRole('button', { name: /Spin/i }).click();
    await page.getByRole('button', { name: /Grow/i }).click();
    await page.getByRole('button', { name: /Make Round/i }).click();

    const btn = page.getByRole('button', { name: /Reset All/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    // Use a single assertion to verify no state-specific classes remain
    await expect(target).not.toHaveClass(/is-spun|is-grown|is-rounded/);
  });

});
