import { test, expect, type Page } from '@playwright/test';
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

function getFetches(page: Page) {
  return page.evaluate(() => {
    return (window as any).__fetches;
  });
}

// Tests
test.describe(`Deprioritize Background Fetches Expectations: ${demoName}`, () => {
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

    // Mock API endpoints to prevent actual network requests that might fail
    await page.route('**/api/data', route => route.fulfill({ status: 200, body: '{}' }));
    await page.route('**/api/analytics', route => route.fulfill({ status: 200, body: '{}' }));

    // Inject a spy into the browser's fetch API
    await page.addInitScript(() => {
      (window as any).__fetches = [];
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        (window as any).__fetches.push({
          url: args[0],
          options: args[1] || {},
        });
        return originalFetch.apply(this, args);
      };
    });

    await page.goto(demoUrl);

    // Wait for DOMContentLoaded and then click the button
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(async () => {
      (window as any).__fetches = []; // Clear any auto-fetches
      (document.querySelector('button') as HTMLElement)?.click();
      // Wait briefly to allow fetches to queue
      await new Promise(r => setTimeout(r, 50));
    });
  });


  // Browser assertions
  test(`A fetch() call to /api/data is made without the priority: 'low' option.`, async ({ page }) => {
    const fetches = await getFetches(page);
    const isDataFetchHighPriority = fetches.some((f: any) => f.url.includes('/api/data') && f.options.priority !== 'low');

    expect(isDataFetchHighPriority).toBe(true);
  });

  test(`A fetch() call to /api/analytics is made with the priority: 'low' option.`, async ({ page }) => {
    const fetches = await getFetches(page);
    const isAnalyticsFetchLowPriority = fetches.some((f: any) => f.url.includes('/api/analytics') && f.options.priority === 'low');

    expect(isAnalyticsFetchLowPriority).toBe(true);
  });

  test(`No fetch() calls use the deprecated importance option`, async ({ page }) => {
    const fetches = await getFetches(page);
    const hasImportance = fetches.some((f: any) => f.options.importance);

    expect(hasImportance).toBe(false);
  });
});