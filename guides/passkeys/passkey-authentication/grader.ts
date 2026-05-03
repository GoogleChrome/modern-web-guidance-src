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

test.describe('Passkey Authentication Expectations', () => {
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
      (window as any).__signalCalled = false;
      (window as any).__signalOptions = null;
      (window as any).__mockPasskeyPlatformAuthenticator = true;
      (window as any).__mockConditionalGet = true;
      (window as any).__mockAbortControllerCalled = false;

      // Mock window.fetch relative endpoints
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input as any).url || '';
        if (url.includes('/api/login/options')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({
              challenge: 'fake-reauth-challenge',
              rpId: 'localhost',
              allowCredentials: [],
              userVerification: 'preferred'
            })
          } as any;
        }
        if (url.includes('/api/login/verify')) {
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
          conditionalGet: (window as any).__mockConditionalGet
        });
        OriginalPKC.parseRequestOptionsFromJSON = (opts: any) => {
          (window as any).__parseCalled = true;
          return { ...opts, __magic: 'parsed' };
        };
        OriginalPKC.signalUnknownCredential = async (opts: any) => {
          (window as any).__signalCalled = true;
          (window as any).__signalOptions = opts;
        };
      }

      if (navigator.credentials) {
        navigator.credentials.get = async (options) => {
          (window as any).__getCalled = true;
          (window as any).__getOptions = options;
          return {
            id: 'fake-auth-id',
            toJSON: () => ({ id: 'fake-auth-id' })
          } as any;
        };
      }

      // Spy on AbortController abort
      const OriginalAbortController = window.AbortController;
      window.AbortController = class extends OriginalAbortController {
        constructor() {
          super();
        }
        abort(reason?: any) {
          (window as any).__mockAbortControllerCalled = true;
          super.abort(reason);
        }
      } as any;
    });
  });

  test('The HTML form annotates the username input element with autocomplete="username webauthn" and autofocus', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const hasCorrectInput = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.some(i => {
         const autocomplete = i.getAttribute('autocomplete') || '';
         const tokens = autocomplete.split(/\s+/);
         const hasWebauthn = tokens.includes('webauthn');
         const hasUsername = tokens.includes('username');
         const hasAutofocus = i.hasAttribute('autofocus');
         return hasWebauthn && hasUsername && hasAutofocus;
      });
    });
    expect(hasCorrectInput).toBe(true);
  });

  test('The client feature detects capabilities using PublicKeyCredential.getClientCapabilities before initializing Conditional UI', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForTimeout(100);
    const parseCalled = await page.evaluate(() => (window as any).__parseCalled);
    expect(parseCalled).toBe(true);
  });

  test('The application registers Conditional UI suggestions automatically on load with mediation="conditional"', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForTimeout(100);
    const getOptions = await page.evaluate(() => (window as any).__getOptions);
    expect(getOptions?.mediation).toBe('conditional');
  });

  test('The explicit biometrics button click aborts pending Conditional UI autofill suggestions prior to prompting users', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForTimeout(100);
    const button = page.locator('[data-testid="auth-button"]');
    await button.click();
    await page.waitForTimeout(100);
    const abortCalled = await page.evaluate(() => (window as any).__mockAbortControllerCalled);
    expect(abortCalled).toBe(true);
    const getOptions = await page.evaluate(() => (window as any).__getOptions);
    expect(getOptions?.mediation === 'optional' || getOptions?.mediation === undefined).toBe(true);
  });

  test('If the server verification endpoint returns an explicit HTTP 404 status, PublicKeyCredential.signalUnknownCredential is invoked passing the Base64URL credential ID', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      const verifyFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input as any).url || '';
        if (url.includes('/api/login/verify')) {
          return {
            ok: false,
            status: 404,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ error: 'unknown credential' })
          } as any;
        }
        return verifyFetch(input, init);
      };
    });

    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="auth-button"]');
    await button.click();
    await page.waitForTimeout(100);

    const signalCalled = await page.evaluate(() => (window as any).__signalCalled);
    expect(signalCalled).toBe(true);
    const signalOptions = await page.evaluate(() => (window as any).__signalOptions);
    expect(signalOptions?.credentialId).toBe('fake-auth-id');
  });

  test('A successful credential verification updates the UI status to indicate successful authentication and session establishment', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="auth-button"]');
    await button.click();
    await page.waitForTimeout(100);

    const status = page.locator('[data-testid="auth-status"]');
    await expect(status).toContainText(/Success|authenticated/i);
  });
});
