// Note: no grader change required for expectations typo fix.
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
    await page.route('http://localhost/**', async (route) => {
      const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relPath = requestPath === '/' ? demoName : requestPath.replace(/^\/+/, '');
      const localFilePath = path.resolve(targetDir, relPath);

      if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
  });

  // Functional / Static Tests

  // Read all HTML and JS/MJS files in targetDir to support modular JS practices
  const getSearchContent = () => {
    const files = [filePath];
    try {
      const jsFiles = fs
        .readdirSync(targetDir)
        .filter(f => (f.endsWith('.js') || f.endsWith('.mjs')) && !f.includes('.test.'));
      for (const jsFile of jsFiles) {
        files.push(path.join(targetDir, jsFile));
      }
    } catch (e) {}
    return files.map(f => fs.readFileSync(f, 'utf-8')).join('\n');
  };

  test('fetchLater API is invoked with a valid DeferredRequestInit (no ReadableStream)', () => {
    const content = getSearchContent();
    expect(content).not.toMatch(/new\s+ReadableStream/);
  });

  test('XMLHttpRequest is not used as an alternative beacon API', () => {
    const content = getSearchContent();
    expect(content).not.toMatch(/\bnew\s+XMLHttpRequest\b/);
  });

  test('Image is not used as an alternative beacon API', () => {
    const content = getSearchContent();
    expect(content).not.toMatch(/\bnew\s+Image\b/);
  });

  test('fetchLater is invoked with the activateAfter option', () => {
    const content = getSearchContent();
    expect(content).toMatch(/activateAfter\s*:/);
  });

  test('Batch queue size is limited to prevent quota overflow', () => {
    const content = getSearchContent();
    expect(content).toMatch(
      /(?:(?:length|size|byteLength)\s*(?:>=|>|===?|<|<=)\s*(?:[2-9]\d*|[1-9]\d+|[A-Za-z0-9_]*(?:MAX|LIMIT|QUOTA|SIZE|BATCH|CAP|BYTES)[A-Za-z0-9_]*)|(?:const|let|var)\s+(\w+)\s*=\s*new\s+Map\s*\(\s*\)[\s\S]*?\b\1\.set\s*\(\s*(?:[\w.]+\.)?(?:id|name)\b)/i
    );
  });

  test('fetchLater calls are wrapped in try/catch to handle errors', () => {
    const content = getSearchContent();
    expect(content).toMatch(/\btry\s*\{[\s\S]*?\bfetchLater\s*\([\s\S]*?\}\s*catch\b/);
  });

  test('fetchLater polyfill is included in the codebase', () => {
    const content = getSearchContent();
    expect(content).toMatch(/globalThis\.fetchLater\s*\?\?=|(?:typeof\s+[\w.]*fetchLater|['"]fetchLater['"]\s+in)[\s\S]*?(?:sendBeacon|keepalive)/);
  });

  // Browser / Dynamic Tests

  test('The application handles missing fetchLater natively by using a polyfill without crashing', async ({ page }) => {
    await page.addInitScript(() => {
      // Ensure clicks on the page don't trigger a navigation.
      window.addEventListener('click', (event) => event.preventDefault(), true);
    });

    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(demoUrl);
    await page.click('body');
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
      // Ensure clicks on the page don't trigger a navigation.
      window.addEventListener('click', (event) => event.preventDefault(), true);
    });

    await page.goto(demoUrl);
    // Click multiple times to trigger multiple metric dispatches (INP)
    await page.click('body');
    await page.waitForTimeout(50);
    await page.click('body');
    await page.waitForTimeout(50);
    await page.click('body');

    const abortCount = await page.evaluate(() => window.abortCallCount);
    const content = getSearchContent();
    const hasScopedAbortBatching = /\.abort\s*\(\s*\)[\s\S]{0,250}?new\s+AbortController\s*\(\s*\)[\s\S]{0,300}?\bfetchLater\s*\(/.test(content);
    expect(abortCount > 0 || hasScopedAbortBatching).toBe(true);
  });
});
