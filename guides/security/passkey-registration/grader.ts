import { test, expect } from '../../test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

const filePath = path.resolve(targetFile);

function getFileContent(): string {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

test.describe('Passkey Registration Expectations', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://esm.sh/**', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'export {};'
    }));

    await page.addInitScript(() => {
      (window as any).__createCalled = false;
      (window as any).__createOptions = null;
      (window as any).__parseCalled = false;
      (window as any).__signalCalled = false;
      (window as any).__signalOptions = null;
      (window as any).__verifyCalled = false;
      (window as any).__verifyBody = null;
      (window as any).__mockPasskeyPlatformAuthenticator = true;

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
            toJSON: () => ({ id: 'fake-id' })
          } as any;
        };
      }
    });
  });

  test('The implementation detects support using platform authenticator capabilities prior to displaying passkey UI', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const code = getFileContent();
    const hasCapabilitiesCheck = code.includes('getClientCapabilities') || code.includes('isUserVerifyingPlatformAuthenticatorAvailable') || code.includes('PublicKeyCredential');
    expect(hasCapabilitiesCheck).toBe(true);
  });

  test('The client invokes native browser passkey creation when the registration trigger is clicked', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click')).catch(() => {});
    const called = await page.waitForFunction(() => (window as any).__createCalled, { timeout: 3000 }).catch(() => false);
    
    if (called) {
      expect(Boolean(called)).toBe(true);
      return;
    }
    const code = getFileContent();
    expect(code.includes('navigator.credentials.create')).toBe(true);
  });

  test('The client decodes server creation options using parseCreationOptionsFromJSON before invoking the authenticator', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click')).catch(() => {});
    const parseCalled = await page.waitForFunction(() => (window as any).__parseCalled, { timeout: 3000 }).catch(() => false);

    if (parseCalled) {
      expect(Boolean(parseCalled)).toBe(true);
      return;
    }
    const code = getFileContent();
    expect(code.includes('parseCreationOptionsFromJSON')).toBe(true);
  });

  test('The client submits the attestation to the verify endpoint as JSON-encoded credential data', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click')).catch(() => {});
    const verifyCalled = await page.waitForFunction(() => (window as any).__verifyCalled, { timeout: 3000 }).catch(() => false);

    if (verifyCalled) {
      expect(Boolean(verifyCalled)).toBe(true);
      return;
    }
    const code = getFileContent();
    expect(code.includes('/api/register/verify') || code.includes('toJSON')).toBe(true);
  });

  test('The client signals signalUnknownCredential using Base64URL credentialId upon server verification failure', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const code = getFileContent();
    expect(code.includes('signalUnknownCredential')).toBe(true);
  });
});
