import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Temporal Interval Manager Expectations`, () => {

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

  test('MUST feature-detect the Temporal API using typeof Temporal', async ({ page }) => {
    const content = await page.content();
    expect(content).toMatch(/typeof\s+Temporal\s*===?\s*['"`]undefined['"`]/);
  });

  test('MUST conditionally load a Temporal polyfill', async ({ page }) => {
    const content = await page.content();
    // It should import a polyfill conditionally.
    expect(content).toMatch(/import\([^)]*temporal[^)]*polyfill[^)]*\)/i);
  });

  test('MUST manually assign the loaded polyfill to globalThis.Temporal', async ({ page }) => {
    const content = await page.content();
    expect(content).toMatch(/(globalThis|window)\.Temporal\s*=\s*/);
  });

  test('MUST use Temporal.PlainDate as the primary type for calculating recurring intervals', async ({ page }) => {
    const content = await page.content();
    expect(content).toContain("Temporal.PlainDate");
  });

  test('MUST use the .add() method on a Temporal.PlainDate instance', async ({ page }) => {
    const content = await page.content();
    // Negative demo doesn't have .add()
    expect(content).toMatch(/\.add\s*\(/);
  });

  test('MUST correctly clamp invalid dates to the end of the month (constrain)', async ({ page }) => {
    // Check if the inputs exist, fail fast if they don't
    const startDateInput = page.locator('input[type="date"]').first();
    await expect(startDateInput).toBeVisible({ timeout: 1000 });
    await startDateInput.fill('2024-01-31');

    const yearsInput = page.locator('label:has-text("Years") + input, input[id*="year" i]').first();
    const monthsInput = page.locator('label:has-text("Months") + input, input[id*="month" i]').first();
    
    await expect(yearsInput).toBeVisible({ timeout: 1000 });
    await expect(monthsInput).toBeVisible({ timeout: 1000 });

    await yearsInput.fill('0');
    await monthsInput.fill('1');

    // The select for overflow should exist
    const select = page.locator('select').first();
    await expect(select).toBeVisible({ timeout: 1000 });
    await select.selectOption({ value: 'constrain' });

    // Wait a bit for the calculation to happen if it's reacting to input
    await page.waitForTimeout(100);

    // Negative demo will calculate 2024-03-02 because it uses standard JS Date setMonth.
    // Constrain logic with Temporal PlainDate should yield 2024-02-29
    const result = page.locator('.huge-value, #resultDate, [id*="result" i]').first();
    await expect(result).toHaveText(/2024-02-29/);
  });

  test('MUST correctly throw a RangeError or display error when using reject overflow strategy', async ({ page }) => {
    const startDateInput = page.locator('input[type="date"]').first();
    await expect(startDateInput).toBeVisible({ timeout: 1000 });
    await startDateInput.fill('2024-01-31');

    const yearsInput = page.locator('label:has-text("Years") + input, input[id*="year" i]').first();
    const monthsInput = page.locator('label:has-text("Months") + input, input[id*="month" i]').first();
    
    await expect(yearsInput).toBeVisible({ timeout: 1000 });
    await expect(monthsInput).toBeVisible({ timeout: 1000 });

    await yearsInput.fill('0');
    await monthsInput.fill('1');

    const select = page.locator('select').first();
    // This expects the 'reject' option to be available. If it's missing (negative-demo), it fails.
    await expect(select).toBeVisible({ timeout: 1000 });
    await select.selectOption({ value: 'reject' });

    await page.waitForTimeout(100);

    // On reject, demo.html shows "Error: RangeError"
    const result = page.locator('.huge-value, #resultDate, [id*="result" i]').first();
    await expect(result).toHaveText(/Error/i);
  });

  test('MUST NOT attempt to modify Temporal instances directly, as they are immutable', async ({ page }) => {
    const content = await page.content();
    // Negative demo uses mutable Date methods. Let's explicitly check against them.
    if (content.includes('setMonth') || content.includes('setFullYear') || content.includes('setDate')) {
      throw new Error("Found legacy mutable Date methods (setMonth, setFullYear, setDate). Must use immutable Temporal operations.");
    }
  });

  test('MUST NOT use the legacy Date object for the core recurring interval calculations', async ({ page }) => {
    const content = await page.content();
    if (content.match(/new Date\s*\(/)) {
      throw new Error("Found legacy 'new Date()' usage. Must use Temporal API.");
    }
  });
});
