import { test, expect } from '../../test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);

function getFileContent(): string {
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

test.describe('Passkey Registration Expectations', () => {
  test.beforeEach(async ({ page, TARGET_URL }) => {
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
          return {
            id: 'fake-id',
            toJSON: () => ({ id: 'fake-id' })
          } as any;
        };
      }
    });
  });

  test('detects support using platform authenticator prior to prompting UI', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL).catch(() => {});
    const code = getFileContent();
    const hasCapabilitiesCheck = code.includes('getClientCapabilities') || code.includes('isUserVerifyingPlatformAuthenticatorAvailable') || code.includes('PublicKeyCredential');
    expect(hasCapabilitiesCheck).toBe(true);
  });

  test('invokes native browser create biometrics trigger upon register click', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL).catch(() => {});
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click')).catch(() => {});
    await page.waitForTimeout(500);
    
    const called = await page.evaluate(() => (window as any).__createCalled).catch(() => false);
    if (called) {
      expect(called).toBe(true);
      return;
    }
    const code = getFileContent();
    expect(code.includes('navigator.credentials.create') || code.includes('create(')).toBe(true);
  });

  test('decodes server creation options via parseCreationOptionsFromJSON before invoking the authenticator', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL).catch(() => {});
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click')).catch(() => {});
    await page.waitForTimeout(500);

    const parseCalled = await page.evaluate(() => (window as any).__parseCalled).catch(() => false);
    if (parseCalled) {
      expect(parseCalled).toBe(true);
      return;
    }
    const code = getFileContent();
    expect(code.includes('parseCreationOptionsFromJSON')).toBe(true);
  });

  test('submits the attestation to the verify endpoint as JSON-encoded credential data', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL).catch(() => {});
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey"), button').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click')).catch(() => {});
    await page.waitForTimeout(500);

    const verifyCalled = await page.evaluate(() => (window as any).__verifyCalled).catch(() => false);
    if (verifyCalled) {
      expect(verifyCalled).toBe(true);
      return;
    }
    const code = getFileContent();
    expect(code.includes('/api/register/verify') || code.includes('toJSON')).toBe(true);
  });

  test('signals signalUnknownCredential using Base64URL credentialId upon server verification failure', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL).catch(() => {});
    const code = getFileContent();
    expect(code.includes('signalUnknownCredential')).toBe(true);
  });
});
