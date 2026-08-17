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
  return page.evaluate(() => (window as any).__cosCalls);
}

function getFetches(page: Page) {
  return page.evaluate(() => (window as any).__fetches);
}

// Tests
test.describe(`Avoid Redundant Large Asset Downloads Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else if (requestPath === '/assets/shared-library.js') {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: '// pretend shared library bytes',
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

    // Mock navigator.crossOriginStorage so the demo's feature-detection
    // takes the COS branch, and record every call for assertions.
    await page.addInitScript(() => {
      (window as any).__cosCalls = [];
      const files = new Map<string, Blob>();

      (navigator as any).crossOriginStorage = {
        requestFileHandle: async (hash: any, options: any = {}) => {
          (window as any).__cosCalls.push({ hash, options });
          const key = `${hash.algorithm}:${hash.value}`;

          if (!options.create) {
            if (!files.has(key)) {
              const err: any = new Error('Not found');
              err.name = 'NotFoundError';
              throw err;
            }
            return {
              getFile: async () => files.get(key),
            };
          }

          let resolveWrite: () => void;
          const writePromise = new Promise<void>((resolve) => (resolveWrite = resolve));
          let written = false;

          return {
            createWritable: async () => ({
              write: async (blob: Blob) => {
                files.set(key, blob);
              },
              close: async () => {
                written = true;
                resolveWrite!();
              },
            }),
            getFile: async () => {
              if (!written) {
                const err: any = new Error('Not allowed yet');
                err.name = 'NotAllowedError';
                throw err;
              }
              await writePromise;
              return files.get(key);
            },
          };
        },
      };
    });

    await page.goto(demoUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  test(`Cross-Origin Storage is checked with requestFileHandle() before a network fetch is made`, async ({ page }) => {
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

  test(`A cache miss falls back to a network fetch of the asset`, async ({ page }) => {
    await page.evaluate(() => {
      (document.getElementById('load-btn') as HTMLElement)?.click();
    });
    await expect(page.locator('#status')).toContainText(/ready/i, { timeout: 5000 });

    const fetches = await getFetches(page);
    const fetchedAsset = fetches.some((url: string) => url.includes('/assets/shared-library.js'));
    expect(fetchedAsset).toBe(true);
  });

  test(`After a network fetch, the file is stored with create: true and a deliberate origins choice`, async ({ page }) => {
    await page.evaluate(() => {
      (document.getElementById('load-btn') as HTMLElement)?.click();
    });
    await expect(page.locator('#status')).toContainText(/ready/i, { timeout: 5000 });

    const calls = await getCalls(page);
    const writeCall = calls.find((c: any) => c.options?.create === true);
    expect(writeCall).toBeTruthy();
    expect('origins' in writeCall.options).toBe(true);
  });

  test(`A second load of the same hash is served from Cross-Origin Storage without a second network fetch`, async ({ page }) => {
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
    const fetchedAssetAgain = fetches.some((url: string) => url.includes('/assets/shared-library.js'));
    expect(fetchedAssetAgain).toBe(false);
  });
});
