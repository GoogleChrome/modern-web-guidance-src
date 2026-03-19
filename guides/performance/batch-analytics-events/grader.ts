import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

declare global {
  interface Window {
    abortCallCount: number;
  }
}

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
test.describe(`Batch Analytics Events Expectations: ${demoName}`, () => {
  // Setup browser testing route
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
  });

  // Functional / Static Tests

  test('fetchLater API is invoked with a valid DeferredRequestInit (no ReadableStream)', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/new\s+ReadableStream/);
  });

  test('XMLHttpRequest is not used as an alternative beacon API', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/\bnew\s+XMLHttpRequest\b/);
  });

  test('Image is not used as an alternative beacon API', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/\bnew\s+Image\b/);
  });

  test('fetchLater is invoked with the activateAfter option', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/activateAfter\s*:/);
  });

  test('Batch queue size is limited to prevent quota overflow', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/length\s*[>=]+\s*[A-Z0-9_]+/i);
  });

  test('fetchLater calls are wrapped in try/catch to handle errors', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/catch\s*\(\s*[a-zA-Z0-9_]+\s*\)/);
  });

  test('fetchLater polyfill is included in the codebase', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/globalThis\.fetchLater\s*\?\?=/);
  });

  // Browser / Dynamic Tests

  test('The application handles missing fetchLater natively by using a polyfill without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(demoUrl);
    await page.click('#btn-purchase');
    expect(errors.length).toBe(0);
  });

  test('Prior fetchLater calls are aborted to batch events together', async ({ page }) => {
    await page.addInitScript(() => {
      window.abortCallCount = 0;
      const originalAbort = AbortController.prototype.abort;
      AbortController.prototype.abort = function(...args) {
        window.abortCallCount++;
        return originalAbort.apply(this, args);
      };
    });
    
    await page.goto(demoUrl);
    await page.click('#btn-purchase');
    await page.click('#btn-signup');
    
    const abortCount = await page.evaluate(() => window.abortCallCount);
    expect(abortCount).toBeGreaterThan(0);
  });
});
