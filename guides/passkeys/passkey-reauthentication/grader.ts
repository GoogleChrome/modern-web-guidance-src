import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

test.describe('Passkey Reauthentication Expectations', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__getCalled = false;
      (window as any).__getOptions = null;
      (window as any).__parseCalled = false;

      // Intercept relative fetches to prevent Playwright isolated filesystem CORS block blocks
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

  test('renders explicit step-up biometrics button UI annotated with data-testid', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const button = page.locator('[data-testid="reauth-button"]');
    await expect(button).toBeVisible();
  });

  test('invokes biometric re-verification via navigator.credentials.get clicking reauth button', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const getCalled = await page.evaluate(() => (window as any).__getCalled);
    expect(getCalled).toBe(true);
  });

  test('populates allowCredentials mapped to user pre-registered credentials descriptors list', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const getOptions = await page.evaluate(() => (window as any).__getOptions);
    // Grader verifies pre-registered allowedCredentials elements id populate safely
    const allowed = getOptions?.publicKey?.allowCredentials || getOptions?.allowCredentials || [];
    expect(allowed.length).toBeGreaterThan(0);
  });

  test('enforces user biometrics by commanding required verification parameter', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const getOptions = await page.evaluate(() => (window as any).__getOptions);
    const pkOptions = getOptions?.publicKey || getOptions || {};
    // Commands userVerification required enforce
    expect(pkOptions.userVerification).toBe('required');
  });

  test('decodes step-up reauth request options calling parseRequestOptionsFromJSON safely', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const button = page.locator('[data-testid="reauth-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const parseCalled = await page.evaluate(() => (window as any).__parseCalled);
    expect(parseCalled).toBe(true);
  });
});
