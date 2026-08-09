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
    if (TARGET_URL.startsWith('http://localhost/') || TARGET_URL === `http://localhost/${demoName}`) {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
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
        if (url.includes('/api/reauth/options')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({
              challenge: 'fake-reauth-challenge',
              userVerification: 'required',
              allowCredentials: [{ type: 'public-key', id: 'fake-reauth-cred-id' }]
            })
          } as any;
        }
        if (url.includes('/api/reauth/verify')) {
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
            toJSON: () => ({ id: 'fake-reauth-cred-id' })
          } as any;
        };
      }
    });
  });

  test('renders explicit step-up biometrics button UI annotated with data-testid', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await expect(button).toBeVisible();
  });

  test('invokes biometric re-verification via navigator.credentials.get clicking reauth button', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const getCalled = await page.evaluate(() => (window as any).__getCalled);
    expect(getCalled).toBe(true);
  });

  test('populates allowCredentials mapped to user pre-registered credentials descriptors list', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const getOptions = await page.evaluate(() => (window as any).__getOptions);
    const allowed = getOptions?.publicKey?.allowCredentials || getOptions?.allowCredentials || [];
    expect(allowed.length).toBeGreaterThan(0);
  });

  test('enforces user biometrics by commanding required verification parameter', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const getOptions = await page.evaluate(() => (window as any).__getOptions);
    const pkOptions = getOptions?.publicKey || getOptions || {};
    expect(pkOptions.userVerification).toBe('required');
  });

  test('decodes step-up reauth request options calling parseRequestOptionsFromJSON safely', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);

    const parseCalled = await page.evaluate(() => (window as any).__parseCalled);
    expect(parseCalled).toBe(true);
  });

  test('aborts in-flight conditional flows by passing an AbortSignal to credentials.get', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);

    const hasSignal = await page.evaluate(() => {
      const opts = (window as any).__getOptions;
      const signal = opts?.signal;
      return !!signal && typeof signal.aborted === 'boolean';
    });
    expect(hasSignal).toBe(true);
  });

  test('submits the assertion to the verify endpoint as encoded JSON', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);

    const verifyCalled = await page.evaluate(() => (window as any).__verifyCalled);
    expect(verifyCalled).toBe(true);
    const body = await page.evaluate(() => (window as any).__verifyBody);
    expect(body).toBeTruthy();
    expect(body.id).toBe('fake-reauth-cred-id');
  });
});
