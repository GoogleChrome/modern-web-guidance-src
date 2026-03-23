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

test.describe(`Measure Total Frame Delay Expectations: ${demoName}`, () => {
  // Static assertions
  test('Static: Should use PerformanceObserver', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('PerformanceObserver');
  });

  test('Static: Should use type: "long-animation-frame"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/type:\s*['"]long-animation-frame['"]/);
  });

  test('Static: Should use buffered: true', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/buffered:\s*true/);
  });

  test('Static: Should not include a polyfill for long animation frames', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check for the specific polyfill attempt in the negative demo
    expect(html).not.toContain('PerformanceLongAnimationFrameTiming');
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    // Inject spy before the page scripts run
    await page.addInitScript(() => {
      (window as any)._observeCalls = [];
      const originalObserve = PerformanceObserver.prototype.observe;
      PerformanceObserver.prototype.observe = function(options: any) {
        (window as any)._observeCalls.push(options);
        // We do not call original to avoid potential errors in browsers 
        // that do not support long-animation-frame, as we only need to verify the call attempt.
      };
    });

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
  test('Browser: PerformanceObserver.observe should be called with type "long-animation-frame"', async ({ page }) => {
    const observeCalls = await page.evaluate(() => (window as any)._observeCalls);
    const hasLongAnimationFrame = observeCalls.some((options: any) => options && options.type === 'long-animation-frame');
    expect(hasLongAnimationFrame).toBe(true);
  });

  test('Browser: PerformanceObserver.observe should be called with buffered: true', async ({ page }) => {
    const observeCalls = await page.evaluate(() => (window as any)._observeCalls);
    const hasBufferedTrue = observeCalls.some((options: any) => options && options.buffered === true);
    expect(hasBufferedTrue).toBe(true);
  });
});
