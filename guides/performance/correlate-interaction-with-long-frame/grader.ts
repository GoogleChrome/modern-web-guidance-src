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
test.describe(`correlate-interaction-with-long-frame Expectations: ${demoName}`, () => {
  // Static assertions
  test('Observer uses type "long-animation-frame"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/type\s*:\s*['"]long-animation-frame['"]/);
  });

  test('Observer uses buffered: true option', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/buffered\s*:\s*true/);
  });

  test('Filters long animation frame entries based on firstUIEventTimestamp', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('firstUIEventTimestamp');
  });

  test('No polyfill is included for long animation frames', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check for common patterns of polyfilling PerformanceLongAnimationFrameTiming
    expect(html).not.toMatch(/window\.PerformanceLongAnimationFrameTiming\s*=/);
    expect(html).not.toMatch(/!window\.PerformanceLongAnimationFrameTiming/);
  });

  test('Accesses the scripts property of the entry', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // The expectations mention "The scripts object may be empty", implying it should be used.
    expect(html).toContain('.scripts');
  });

  test('Does not use the heavyweight Profiler API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // The guide discourages JS Self-Profiling API (Profiler)
    expect(html).not.toContain('new Profiler');
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
  test('Successfully detects a long animation frame after interaction', async ({ page }) => {
    // Click the interaction button
    const button = page.locator('button');
    await button.click();

    // The demo.html should update the output div with a specific message.
    // We expect it to contain "Interaction was delayed by a frame"
    const output = page.locator('#output');
    await expect(output).toContainText(/Interaction was delayed by a frame/, { timeout: 10000 });
  });
});
