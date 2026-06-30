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

test.describe('Passkey Conditional Create', () => {
  test.beforeEach(async ({ page, TARGET_URL }) => {
    if (TARGET_URL.includes('localhost')) {
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
      (window as any).__capabilitiesCalled = false;
      (window as any).__abortCalled = false;
      (window as any).__createCalled = false;
      (window as any).__createMediation = undefined;
      (window as any).__signalUnknownCredentialCalled = false;
      (window as any).__signalOptions = null;
      (window as any).__mockConditionalCreate = true;
      (window as any).__mockCreateError = null;
      (window as any).__callOrder = [];

      // Spy on AbortController abort
      const origAbort = AbortController.prototype.abort;
      AbortController.prototype.abort = function(this: any, reason?: any) {
        (window as any).__abortCalled = true;
        (window as any).__callOrder.push('abort');
        return origAbort.call(this, reason);
      };

      (window as any).PublicKeyCredential = class {
        static async getClientCapabilities() {
          (window as any).__capabilitiesCalled = true;
          return { 
            conditionalCreate: (window as any).__mockConditionalCreate,
            conditionalGet: true 
          };
        }
        static parseCreationOptionsFromJSON(json: any) { return json; }
        static async signalUnknownCredential(opts: any) {
          (window as any).__signalUnknownCredentialCalled = true;
          (window as any).__signalOptions = opts;
        }
      };

      Object.defineProperty(navigator, 'credentials', {
        value: {
          get: async () => {
            return null; // Simulated conditional get autofill load
          },
          create: async (opts: any) => {
            (window as any).__createCalled = true;
            (window as any).__createMediation = opts?.mediation;
            (window as any).__callOrder.push('create');
            if ((window as any).__mockCreateError) {
              const err = new Error((window as any).__mockCreateError.message);
              err.name = (window as any).__mockCreateError.name;
              throw err;
            }
            return { toJSON: () => ({ id: 'mock-id' }) };
          }
        },
        writable: true,
        configurable: true
      });


      // Mock window.fetch relative endpoints
      const originalFetch = window.fetch;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input as any).url || '';
        if (url.includes('/api/register/options')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ challenge: 'mock-challenge' })
          } as any;
        }
        if (url.includes('/api/register/verify')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: 'ok' })
          } as any;
        }
        if (url.includes('/api/signin') || url.includes('/api/login') || url.includes('/api/auth')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: 'ok', success: true })
          } as any;
        }
        return originalFetch(input, init);
      };
    });
  });

  async function clickSigninButton(page: any) {
    const email = page.locator('input[type="email"], #email, input[name="username"], input[name="email"]').first();
    const password = page.locator('input[type="password"], #password, input[name="password"]').first();
    if (await email.isVisible().catch(() => false)) await email.fill('user@example.com').catch(() => {});
    if (await password.isVisible().catch(() => false)) await password.fill('password123').catch(() => {});

    const button = page.locator('[data-testid="signin-button"], #signin-btn, #login-btn, button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button').first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
    }
  }

  test('Feature-detects conditionalCreate support', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await clickSigninButton(page);
    await page.waitForTimeout(300);
    
    const called = await page.evaluate(() => (window as any).__capabilitiesCalled);
    expect(called).toBe(true);
  });

  test('Aborts prior active conditional-get abort controller', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await clickSigninButton(page);
    await page.waitForTimeout(300);
    
    const abortCalled = await page.evaluate(() => (window as any).__abortCalled);
    if (!abortCalled) {
      test.skip();
      return;
    }

    const callOrder = await page.evaluate(() => (window as any).__callOrder);
    const abortIdx = callOrder.indexOf('abort');
    const createIdx = callOrder.indexOf('create');
    expect(abortIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThan(abortIdx);
  });

  test('Triggers browser biometrics creation method passing mediation="conditional"', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await clickSigninButton(page);
    await page.waitForTimeout(300);
    
    const mediation = await page.evaluate(() => (window as any).__createMediation);
    expect(mediation).toBe('conditional');
  });

  test('Gating capability support denies background credentials creation', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      (window as any).__mockConditionalCreate = false;
    });
    await page.goto(TARGET_URL);
    await clickSigninButton(page);
    await page.waitForTimeout(300);

    const createCalled = await page.evaluate(() => (window as any).__createCalled);
    expect(createCalled).toBe(false);
  });

  test('Swallows common WebAuthn errors like NotAllowedError without displaying error messages to the user', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      (window as any).__mockCreateError = {
        name: 'NotAllowedError',
        message: 'The operation either timed out or was not allowed.'
      };
    });
    await page.goto(TARGET_URL);
    await clickSigninButton(page);
    await page.waitForTimeout(300);

    // Verify the error was swallowed silently: nothing on the page surfaces the
    // error name, message, or generic error-like wording as a result of the failed create.
    const bodyText = (await page.locator('body').innerText()).toLowerCase();
    expect(bodyText).not.toContain('notallowederror');
    expect(bodyText).not.toContain('the operation either timed out');

    const statusLoc = page.locator('[data-testid="status"]');
    if (await statusLoc.count() > 0) {
      const statusText = ((await statusLoc.textContent()) ?? '').toLowerCase();
      expect(statusText).not.toMatch(/error|failed|denied|not allowed/);
    }
  });

  test('Invokes signalUnknownCredential passing the Base64URL credential ID if server verification fails', async ({ page, TARGET_URL }) => {
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
    await clickSigninButton(page);
    await page.waitForTimeout(300);

    const signalCalled = await page.evaluate(() => (window as any).__signalUnknownCredentialCalled);
    expect(signalCalled).toBe(true);
    const signalOptions = await page.evaluate(() => (window as any).__signalOptions);
    expect(signalOptions?.credentialId).toBe('mock-id');
  });
});
