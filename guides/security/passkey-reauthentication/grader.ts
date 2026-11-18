import { test, expect } from '../../test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

test.describe('Passkey Reauthentication Expectations', () => {
  test.beforeEach(async ({ page, TARGET_URL }) => {
    // Intercept external polyfill CDNs so offline sandboxes do not stall or hang
    await page.route(/https?:\/\/(esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)\/.*/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'export default {}; export const parseRequestOptionsFromJSON = (x) => x;'
      });
    });

    if (TARGET_URL.startsWith('http://localhost/') || TARGET_URL === `http://localhost/${demoName}`) {
      await page.route('http://localhost/**', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          const isJs = /\.(m?js|cjs)$/i.test(localFilePath);
          await route.fulfill({
            path: localFilePath,
            ...(isJs ? { contentType: 'application/javascript' } : {}),
          });
        } else {
          await route.continue();
        }
      });
    }

    await page.addInitScript(() => {
      (window as any).__getCalled = false;
      (window as any).__getOptions = null;
      (window as any).__parseCalled = false;
      (window as any).__verifyCalled = false;
      (window as any).__verifyBody = null;

      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input as any).url || '';
        if (url.includes('/api/reauth/options') || url.includes('options')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({
              challenge: 'fake-reauth-challenge',
              allowCredentials: [{ type: 'public-key', id: 'fake-reauth-cred-id' }]
            })
          } as any;
        }
        if (url.includes('/api/reauth/verify') || url.includes('verify')) {
          (window as any).__verifyCalled = true;
          try {
            (window as any).__verifyBody = init?.body ? JSON.parse(init.body as string) : null;
          } catch {
            (window as any).__verifyBody = null;
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: 'ok' })
          } as any;
        }
        return originalFetch(input, init);
      };

      const OriginalPKC = (window as any).PublicKeyCredential;
      if (OriginalPKC) {
        OriginalPKC.parseRequestOptionsFromJSON = (opts: any) => {
          (window as any).__parseCalled = true;
          return { ...opts, __magic: 'parsed-reauth' };
        };
      }

      if (navigator.credentials) {
        navigator.credentials.get = async (options) => {
          (window as any).__getCalled = true;
          (window as any).__getOptions = options;
          return {
            id: 'fake-reauth-cred-id',
            type: 'public-key',
            toJSON: () => ({ id: 'fake-reauth-cred-id', type: 'public-key' }),
            JSON: () => ({ id: 'fake-reauth-cred-id', type: 'public-key' })
          } as any;
        };
      }
    });
  });

  test('The UI renders an explicit step-up passkey sign-in button annotated with data-testid="reauth-button"', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await expect(button).toBeVisible();
  });

  test('The client invokes passkey re-verification via navigator.credentials.get upon clicking the reauth button', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await expect.poll(async () => page.evaluate(() => (window as any).__getCalled), { timeout: 2000 }).toBe(true);
  });

  test('The fetched options populate allowCredentials mapped to pre-registered credentials', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await expect.poll(async () => page.evaluate(() => (window as any).__getCalled), { timeout: 2000 }).toBe(true);
    
    const getOptions = await page.evaluate(() => (window as any).__getOptions);
    const allowed = getOptions?.publicKey?.allowCredentials || getOptions?.allowCredentials || [];
    expect(allowed.length).toBeGreaterThan(0);
  });

  test('The client decodes fetched reauth option parameters calling parseRequestOptionsFromJSON safely', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await expect.poll(async () => page.evaluate(() => (window as any).__getCalled), { timeout: 2000 }).toBe(true);

    const parseCalled = await page.evaluate(() => (window as any).__parseCalled);
    expect(parseCalled).toBe(true);
  });

  test('The client passes an AbortSignal to credentials.get to allow aborting in-flight flows', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await expect.poll(async () => page.evaluate(() => (window as any).__getCalled), { timeout: 2000 }).toBe(true);

    const hasSignal = await page.evaluate(() => {
      const opts = (window as any).__getOptions;
      const signal = opts?.signal;
      return !!signal && typeof signal.aborted === 'boolean';
    });
    expect(hasSignal).toBe(true);
  });

  test('The client submits the resulting assertion to the verify endpoint as encoded JSON', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await expect.poll(async () => page.evaluate(() => (window as any).__verifyCalled), { timeout: 2000 }).toBe(true);

    const body = await page.evaluate(() => (window as any).__verifyBody);
    expect(body).toBeTruthy();
    expect(body.id).toBe('fake-reauth-cred-id');
  });
});
