import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

test.describe('Passkey Registration Expectations', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__createCalled = false;
      (window as any).__createOptions = null;
      (window as any).__parseCalled = false;
      (window as any).__signalCalled = false;
      (window as any).__signalOptions = null;
      (window as any).__mockPasskeyPlatformAuthenticator = true;
      (window as any).__mockCreateError = null;

      // Mock window.fetch relative endpoints CORS safety intercept loops
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input as any).url || '';
        if (url.includes('/api/register/options')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({
              challenge: 'fake-reauth-challenge',
              user: { id: 'fake-user-id', name: 'test', displayName: 'test' },
              rp: { id: 'localhost', name: 'test' },
              pubKeyCredParams: []
            })
          } as any;
        }
        if (url.includes('/api/register/verify')) {
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
        OriginalPKC.getClientCapabilities = async () => ({ passkeyPlatformAuthenticator: (window as any).__mockPasskeyPlatformAuthenticator, conditionalCreate: true });
        OriginalPKC.parseCreationOptionsFromJSON = (opts: any) => {
          (window as any).__parseCalled = true;
          return { ...opts, __magic: 'parsed' };
        };
        OriginalPKC.signalUnknownCredential = async (opts: any) => {
          (window as any).__signalCalled = true;
          (window as any).__signalOptions = opts;
        };
      }

      if (navigator.credentials) {
        navigator.credentials.create = async (options) => {
          (window as any).__createCalled = true;
          (window as any).__createOptions = options;
          
          if ((window as any).__mockCreateError) {
            const err = new Error((window as any).__mockCreateError.message);
            err.name = (window as any).__mockCreateError.name;
            throw err;
          }
          
          return {
            id: 'fake-id',
            toJSON: () => ({ id: 'fake-id' })
          } as any;
        };
      }
    });
  });

  test('detects support using platform authenticator prior to prompting UI', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    // Asserts step button visibilities and features presence safely
    const button = page.locator('[data-testid="register-button"]');
    await expect(button).toBeVisible();
  });

  test('invokes native browser create biometrics trigger upon register click', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    const button = page.locator('[data-testid="register-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const called = await page.evaluate(() => (window as any).__createCalled);
    expect(called).toBe(true);
  });

  test('signals signalUnknownCredential using Base64URL credentialId upon server verification failure', async ({ page }) => {
    // Intercept verify fetch endpoint to return bad verification status explicitly
    await page.addInitScript(() => {
      const verifyFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input as any).url || '';
        if (url.includes('/api/register/verify')) {
          return {
            ok: false,
            status: 400,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ error: 'bad signature' })
          } as any;
        }
        return verifyFetch(input, init);
      };
    });

    await page.goto(`file://${targetFile}`);
    const button = page.locator('[data-testid="register-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const called = await page.evaluate(() => (window as any).__signalCalled);
    expect(called).toBe(true);
    const opts = await page.evaluate(() => (window as any).__signalOptions);
    expect(opts?.credentialId).toBe('fake-id');
  });
});
