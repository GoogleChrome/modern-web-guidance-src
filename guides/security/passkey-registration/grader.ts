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

test.describe('Passkey Registration Expectations', () => {
  test.beforeEach(async ({ page, TARGET_URL }) => {
    await page.route(/https?:\/\/(esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)\/.*/, route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'export default {}; export const parseCreationOptionsFromJSON = (x) => x; export const parseRequestOptionsFromJSON = (x) => x;'
    }));

    if (TARGET_URL.includes('localhost') && !new URL(TARGET_URL).port) {
      await page.route(/(http:\/\/localhost(:\d+)?\/.*)/, async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const sanitizedPath = requestPath === '/' ? demoName : requestPath.replace(/^\//, '');
        const localFilePath = path.join(targetDir, sanitizedPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });
    }

    await page.addInitScript(() => {
      (window as any).__createCalled = false;
      (window as any).__createOptions = null;
      (window as any).__parseCalled = false;
      (window as any).__signalCalled = false;
      (window as any).__signalOptions = null;
      (window as any).__verifyCalled = false;
      (window as any).__verifyBody = null;
      if ((window as any).__mockPasskeyPlatformAuthenticator === undefined) {
        (window as any).__mockPasskeyPlatformAuthenticator = true;
      }
      if ((window as any).__mockVerifyFail === undefined) {
        (window as any).__mockVerifyFail = false;
      }

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
          (window as any).__verifyCalled = true;
          try {
            (window as any).__verifyBody = init?.body ? JSON.parse(init.body as string) : null;
          } catch {
            (window as any).__verifyBody = null;
          }
          if ((window as any).__mockVerifyFail) {
            return {
              ok: false,
              status: 400,
              json: async () => ({ error: 'Verification failed' })
            } as any;
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
        OriginalPKC.getClientCapabilities = async () => ({
          passkeyPlatformAuthenticator: (window as any).__mockPasskeyPlatformAuthenticator,
          conditionalCreate: true,
          conditionalGet: true
        });
        OriginalPKC.parseCreationOptionsFromJSON = (opts: any) => {
          (window as any).__parseCalled = true;
          return { ...opts, __magic: 'parsed' };
        };
        if (OriginalPKC.prototype) {
          OriginalPKC.prototype.toJSON = function () {
            return { id: 'fake-id' };
          };
        }
        OriginalPKC.signalUnknownCredential = async (opts: any) => {
          (window as any).__signalCalled = true;
          (window as any).__signalOptions = opts;
        };
      }

      if (navigator.credentials) {
        navigator.credentials.create = async (options) => {
          (window as any).__createCalled = true;
          (window as any).__createOptions = options;
          return {
            id: 'fake-id',
            toJSON: () => ({
              id: 'fake-id',
              rawId: 'ZmFrZS1pZA',
              type: 'public-key',
              response: {
                clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0',
                attestationObject: 'o2NmbXRkbm9uZQ'
              }
            })
          } as any;
        };
      }
    });
  });

  test('The implementation detects support using platform authenticator capabilities prior to displaying passkey UI', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"]');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();

    await page.addInitScript(() => {
      (window as any).__mockPasskeyPlatformAuthenticator = false;
    });
    await page.goto(TARGET_URL);
    await expect.poll(async () => {
      const visible = await button.isVisible();
      if (!visible) return true;
      return await button.isDisabled();
    }, { timeout: 3000 }).toBe(true);
  });

  test('The client invokes native browser passkey creation when the registration trigger is clicked', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true, timeout: 1000 }).catch(() => button.dispatchEvent('click', {}, { timeout: 1000 })).catch(() => {});
    await expect.poll(() => page.evaluate(() => (window as any).__createCalled), { timeout: 2000 }).toBe(true);
  });

  test('The client decodes server creation options using parseCreationOptionsFromJSON before invoking the authenticator', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true, timeout: 1000 }).catch(() => button.dispatchEvent('click', {}, { timeout: 1000 })).catch(() => {});
    await expect.poll(() => page.evaluate(() => (window as any).__parseCalled), { timeout: 2000 }).toBe(true);
  });

  test('The client submits the attestation to the verify endpoint as JSON-encoded credential data', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true, timeout: 1000 }).catch(() => button.dispatchEvent('click', {}, { timeout: 1000 })).catch(() => {});
    await expect.poll(() => page.evaluate(() => (window as any).__verifyCalled), { timeout: 2000 }).toBe(true);
    const verifyBody = await page.evaluate(() => (window as any).__verifyBody);
    expect(verifyBody).toBeTruthy();
    expect(typeof verifyBody.id === 'string' && typeof verifyBody.rawId === 'string').toBe(true);
  });

  test('The client signals signalUnknownCredential using Base64URL credentialId upon server verification failure', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      (window as any).__mockVerifyFail = true;
    });
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true, timeout: 1000 }).catch(() => button.dispatchEvent('click', {}, { timeout: 1000 })).catch(() => {});
    await expect.poll(() => page.evaluate(() => (window as any).__signalCalled), { timeout: 2000 }).toBe(true);
    const signalOptions = await page.evaluate(() => (window as any).__signalOptions);
    expect(signalOptions?.credentialId).toBe('fake-id');
  });
});
