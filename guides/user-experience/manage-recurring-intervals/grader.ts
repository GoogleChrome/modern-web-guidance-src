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
test.describe(`Temporal Interval Manager Expectations: ${demoName}`, () => {

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

  // Behavioral tests
  test(`implementation clamps month-end transitions correctly by default`, async ({ page }) => {
    const startDateInput = page.locator('input[type="date"], input#startDateInput').first();
    await startDateInput.fill('2024-01-31');

    const monthsInput = page.locator('input[type="number"], input#monthsInput').last();
    await monthsInput.fill('1');

    // Trigger update if needed
    await monthsInput.evaluate(node => node.dispatchEvent(new Event('input', { bubbles: true })));
    await startDateInput.evaluate(node => node.dispatchEvent(new Event('input', { bubbles: true })));
    
    // Check if overflow select is there and set it to constrain just in case
    const overflowSelect = page.locator('select');
    if (await overflowSelect.count() > 0) {
      await overflowSelect.selectOption({ value: 'constrain' });
    }

    // Wait a bit for async polyfill if it takes time
    await page.waitForTimeout(500);

    const textContent = await page.locator('body').textContent() || '';
    expect(textContent).toContain('2024-02-29');
  });

  test(`implementation supports 'reject' overflow strategy for invalid calendar dates`, async ({ page }) => {
    const startDateInput = page.locator('input[type="date"], input#startDateInput').first();
    await startDateInput.fill('2024-01-31');

    const monthsInput = page.locator('input[type="number"], input#monthsInput').last();
    await monthsInput.fill('1');

    const overflowSelect = page.locator('select');
    // We try to select it. If it fails, Playwright throws, test fails (expected for negative demo)
    await overflowSelect.selectOption({ value: 'reject' }, { timeout: 1000 });

    await monthsInput.evaluate(node => node.dispatchEvent(new Event('input', { bubbles: true })));
    await page.waitForTimeout(500);

    const textContent = await page.locator('body').textContent() || '';
    expect(textContent).toMatch(/Error|RangeError/i);
  });

  // Static checks for code implementation rules
  test(`implementation includes feature-detection for Temporal`, async () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/typeof\s+Temporal\s*===\s*['"`]undefined['"`]/);
  });

  test(`implementation conditionally loads a Temporal polyfill`, async () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/@js-temporal\/polyfill/);
  });

  test(`implementation manually assigns polyfill to globalThis.Temporal`, async () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/globalThis\.Temporal\s*=/);
  });

  test(`implementation uses Temporal.PlainDate as primary type`, async () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/Temporal\.PlainDate/);
  });

  test(`implementation uses Temporal.PlainDate.from() to parse date`, async () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/Temporal\.PlainDate\.from\s*\(/);
  });

  test(`implementation uses the .add() method on a Temporal instance`, async () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toMatch(/\.add\s*\(/);
  });

  test(`implementation MUST NOT use legacy Date object for core calculations`, async () => {
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/new\s+Date\s*\(/);
  });

});
