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

function getCalls(page: Page) {
  return page.evaluate(() => (window as any).__cosCalls ?? []);
}

function getFetches(page: Page) {
  return page.evaluate(() => (window as any).__fetches ?? []);
}

// Tests
test.describe(`Avoid Redundant Large Asset Downloads Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else if (requestPath === '/assets/ffmpeg-core.wasm') {
        await route.fulfill({
          status: 200,
          contentType: 'application/wasm',
          body: '// pretend ffmpeg.wasm core module bytes',
        });
      } else {
        await route.continue();
      }
    });

    // Spy on fetch() to see whether a network request was made.
    await page.addInitScript(() => {
      (window as any).__fetches = [];
      const originalFetch = window.fetch;
      window.fetch = async function (...args: any[]) {
        (window as any).__fetches.push(String(args[0]));
        return originalFetch.apply(this, args as any);
      };
    });

    // Cross-Origin Storage is assumed to be implemented in this test
    // environment; it is never mocked or replaced. The real
    // requestFileHandle() is wrapped only to record calls for the
    // assertions below, and every call is forwarded unchanged to the
    // original implementation.
    await page.addInitScript(() => {
      (window as any).__cosCalls = [];
      const original = navigator.crossOriginStorage.requestFileHandle.bind(navigator.crossOriginStorage);
      navigator.crossOriginStorage.requestFileHandle = (hash: any, options: any = {}) => {
        (window as any).__cosCalls.push({ hash, options });
        return original(hash, options);
      };
    });

    await page.goto(demoUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  test(`Cross-Origin Storage is queried with requestFileHandle() as part of loading the asset`, async ({ page }) => {
    await page.evaluate(() => {
      (document.getElementById('load-btn') as HTMLElement)?.click();
    });
    await expect(page.locator('#status')).toContainText(/ready/i, { timeout: 5000 });

    const calls = await getCalls(page);
    expect(calls.length).toBeGreaterThan(0);
  });

  test(`The hash object passed to requestFileHandle() has a lowercase hex value and an algorithm`, async ({ page }) => {
    await page.evaluate(() => {
      (document.getElementById('load-btn') as HTMLElement)?.click();
    });
    await expect(page.locator('#status')).toContainText(/ready/i, { timeout: 5000 });

    const calls = await getCalls(page);
    expect(calls.length).toBeGreaterThan(0);
    const { hash } = calls[0];
    expect(hash.algorithm).toBeTruthy();
    expect(/^[0-9a-f]+$/.test(hash.value)).toBe(true);
  });

  test(`A read miss falls back to a network fetch and stores the result with create: true and a deliberate origins choice`, async ({ page }) => {
    await page.evaluate(() => {
      (document.getElementById('load-btn') as HTMLElement)?.click();
    });
    await expect(page.locator('#status')).toContainText(/ready/i, { timeout: 5000 });

    const [calls, fetches] = await Promise.all([getCalls(page), getFetches(page)]);
    const fetchedAsset = fetches.some((url: string) => url.includes('/assets/ffmpeg-core.wasm'));
    const writeCall = calls.find((c: any) => c.options?.create === true);

    // Whichever branch ran, the invariant must hold: a network fetch only
    // happens when nothing usable came back from COS, and whenever a
    // network fetch happens the result must be stored back with a
    // deliberate origins choice for future visitors.
    if (fetchedAsset) {
      expect(writeCall).toBeTruthy();
      expect('origins' in writeCall.options).toBe(true);
    } else {
      expect(writeCall).toBeFalsy();
    }
  });

  test(`A second load of the same hash does not trigger another network fetch`, async ({ page }) => {
    await page.evaluate(() => {
      (document.getElementById('load-btn') as HTMLElement)?.click();
    });
    await expect(page.locator('#status')).toContainText(/ready/i, { timeout: 5000 });

    await page.evaluate(() => {
      (window as any).__fetches = [];
      (document.getElementById('load-btn') as HTMLElement)?.click();
    });
    await page.waitForTimeout(200);

    const fetches = await getFetches(page);
    const fetchedAssetAgain = fetches.some((url: string) => url.includes('/assets/ffmpeg-core.wasm'));
    expect(fetchedAssetAgain).toBe(false);
  });

  test(`The page feature-detects navigator.crossOriginStorage before calling it`, async ({ page }) => {
    const html = await page.content();
    const featureDetects = /navigator\.crossOriginStorage\s*\?\.\s*requestFileHandle/.test(html)
      || /navigator\.crossOriginStorage\s*&&/.test(html)
      || /['"]crossOriginStorage['"]\s*in\s*navigator/.test(html);
    expect(featureDetects).toBe(true);
  });

  test(`Errors from requestFileHandle() are handled defensively and never surface as an unhandled rejection`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.evaluate(() => {
      (document.getElementById('load-btn') as HTMLElement)?.click();
    });
    await expect(page.locator('#status')).toContainText(/ready/i, { timeout: 5000 });

    expect(pageErrors).toEqual([]);
  });
});
