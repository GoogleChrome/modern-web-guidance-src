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
test.describe(`Interaction Latency Attribution Expectations: ${demoName}`, () => {
  // Static assertions
  test(`A PerformanceObserver is created`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/new\s+PerformanceObserver/);
  });

  test(`The observer is configured to observe entries of type event`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/type:\s*['"]event['"]/);
  });

  test(`The observer is initialized with buffered: true`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/buffered:\s*true/);
  });

  test(`The observer is initialized with a durationThreshold parameter`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/durationThreshold:\s*\d+/);
  });

  test(`The code calculates input delay by subtracting startTime from processingStart`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/\.processingStart\s*-\s*[\w\.]+\.startTime/);
  });

  test(`The code calculates processing time by subtracting processingStart from processingEnd`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/\.processingEnd\s*-\s*[\w\.]+\.processingStart/);
  });

  test(`The code calculates presentation delay`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/\.duration\s*-\s*\(\s*[\w\.]+\.processingEnd\s*-\s*[\w\.]+\.startTime\s*\)/);
  });

  test(`The code identifies the target element of the interaction using the target property`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/(?<!\be)\.target/);
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.slice(1));

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  // Browser assertions
  test(`Metrics update asynchronously via PerformanceObserver`, async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('slow-handler')?.click();
    });
    // For demo.html (using PerformanceObserver), metrics haven't updated yet.
    // For negative-demo.html (using synchronous Date.now()), they have already updated.
    await expect(page.locator('#processing-time-val')).toHaveText('0ms');
  });
});
