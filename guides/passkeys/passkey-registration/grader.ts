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
      (window as any).__createCalled = false;
      (window as any).__createOptions = null;
      (window as any).__parseCalled = false;
      (window as any).__signalCalled = false;
      (window as any).__signalOptions = null;
      (window as any).__verifyCalled = false;
      (window as any).__verifyBody = null;
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

  test('detects support using platform authenticator prior to prompting UI', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      (window as any).__mockPasskeyPlatformAuthenticator = false;
    });
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"]');
    await expect(button).toBeHidden();
  });

  test('invokes native browser create biometrics trigger upon register click', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const called = await page.evaluate(() => (window as any).__createCalled);
    expect(called).toBe(true);
  });

  test('decodes server creation options via parseCreationOptionsFromJSON before invoking the authenticator', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"]');
    await button.click();
    await page.waitForTimeout(500);

    const parseCalled = await page.evaluate(() => (window as any).__parseCalled);
    expect(parseCalled).toBe(true);
  });

  test('submits the attestation to the verify endpoint as JSON-encoded credential data', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"]');
    await button.click();
    await page.waitForTimeout(500);

    const verifyCalled = await page.evaluate(() => (window as any).__verifyCalled);
    expect(verifyCalled).toBe(true);
    const body = await page.evaluate(() => (window as any).__verifyBody);
    expect(body).toBeTruthy();
    expect(body.id).toBe('fake-id');
  });

  test('signals signalUnknownCredential using Base64URL credentialId upon server verification failure', async ({ page, TARGET_URL }) => {
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

    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"]');
    await button.click();
    await page.waitForTimeout(500);
    
    const called = await page.evaluate(() => (window as any).__signalCalled);
    expect(called).toBe(true);
    const opts = await page.evaluate(() => (window as any).__signalOptions);
    expect(opts?.credentialId).toBe('fake-id');
  });
});
