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
    // Intercept external polyfill CDNs so offline Playwright sandbox does not stall
    await page.route(/https?:\/\/(esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)\/.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'export default {}; export const parseCreationOptionsFromJSON = (x) => x; export const parseRequestOptionsFromJSON = (x) => x;',
      });
    });

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
      (window as any).__capabilitiesCalled = sessionStorage.getItem('__capabilitiesCalled') === 'true';
      (window as any).__createCalled = sessionStorage.getItem('__createCalled') === 'true';
      (window as any).__createMediation = sessionStorage.getItem('__createMediation') || undefined;
      (window as any).__signalUnknownCredentialCalled = sessionStorage.getItem('__signalUnknownCredentialCalled') === 'true';
      try {
        (window as any).__signalOptions = JSON.parse(sessionStorage.getItem('__signalOptions') || 'null');
      } catch {
        (window as any).__signalOptions = null;
      }
      (window as any).__mockConditionalCreate = sessionStorage.getItem('__mockConditionalCreate') !== 'false';
      try {
        (window as any).__mockCreateError = JSON.parse(sessionStorage.getItem('__mockCreateError') || 'null');
      } catch {
        (window as any).__mockCreateError = null;
      }
      (window as any).__mockVerifyFail = sessionStorage.getItem('__mockVerifyFail') === 'true';

      (window as any).PublicKeyCredential = class {
        static async getClientCapabilities() {
          (window as any).__capabilitiesCalled = true;
          sessionStorage.setItem('__capabilitiesCalled', 'true');
          return { 
            conditionalCreate: (window as any).__mockConditionalCreate,
            conditionalGet: true 
          };
        }
        static parseCreationOptionsFromJSON(json: any) { return json; }
        static async signalUnknownCredential(opts: any) {
          (window as any).__signalUnknownCredentialCalled = true;
          sessionStorage.setItem('__signalUnknownCredentialCalled', 'true');
          (window as any).__signalOptions = opts;
          try {
            sessionStorage.setItem('__signalOptions', JSON.stringify(opts));
          } catch {}
        }
      };

      Object.defineProperty(navigator, 'credentials', {
        value: {
          get: async () => null,
          create: async (opts: any) => {
            (window as any).__createCalled = true;
            sessionStorage.setItem('__createCalled', 'true');
            (window as any).__createMediation = opts?.mediation;
            if (opts?.mediation) sessionStorage.setItem('__createMediation', opts.mediation);
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
        if (url.includes('/api/auth/session') || url.includes('/session')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ authenticated: false, csrfToken: 'mock-csrf' })
          } as any;
        }
        if (url.includes('register/options') || (url.includes('passkey') && url.includes('options'))) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ challenge: 'mock-challenge', rp: { id: 'localhost' } })
          } as any;
        }
        if (url.includes('register/verify') || (url.includes('passkey') && url.includes('verify'))) {
          if ((window as any).__mockVerifyFail) {
            return {
              ok: false,
              status: 400,
              headers: new Headers({ 'Content-Type': 'application/json' }),
              json: async () => ({ error: 'bad signature', verified: false })
            } as any;
          }
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ status: 'ok', verified: true })
          } as any;
        }
        if (url.includes('/api/signin') || url.includes('/api/login') || url.includes('/api/auth') || url.includes('password')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
            json: async () => ({ status: 'ok', success: true, authenticated: true, user: { email: 'user@example.com' } })
          } as any;
        }
        return originalFetch(input, init);
      };
    });
  });

  async function clickSigninButton(page: any) {
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem('__capabilitiesCalled');
        sessionStorage.removeItem('__createCalled');
        sessionStorage.removeItem('__createMediation');
        sessionStorage.removeItem('__signalUnknownCredentialCalled');
        sessionStorage.removeItem('__signalOptions');
      } catch {}
    }).catch(() => {});

    let button = page.locator('[data-testid="signin-button"], #signin-btn, #login-btn, button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first();
    if (!(await button.isVisible().catch(() => false))) {
      const link = page.locator('a[href*="signin"], a[href*="login"], a:has-text("Sign In"), a:has-text("Log In")').first();
      if (await link.isVisible().catch(() => false)) {
        await link.click().catch(() => {});
      } else {
        try {
          const signinUrl = new URL('signin.html', page.url()).href;
          await page.goto(signinUrl);
        } catch {}
      }
      button = page.locator('[data-testid="signin-button"], #signin-btn, #login-btn, button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first();
    }

    const email = page.locator('input[type="email"], #email, #current-email, input[name="username"], input[name="email"]').first();
    const password = page.locator('input[type="password"], #password, #current-password, input[name="password"]').first();
    if (await email.isVisible().catch(() => false)) await email.fill('user@example.com').catch(() => {});
    if (await password.isVisible().catch(() => false)) await password.fill('password123').catch(() => {});

    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
    }
  }

  test('Feature-detects conditionalCreate support', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await clickSigninButton(page);
    
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__capabilitiesCalled);
    }, { timeout: 2000 }).toBe(true);
  });

  test('Triggers browser biometrics creation method passing mediation="conditional"', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await clickSigninButton(page);
    
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__createMediation);
    }, { timeout: 2000 }).toBe('conditional');
  });

  test('Gating capability support denies background credentials creation', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      (window as any).__mockConditionalCreate = false;
      sessionStorage.setItem('__mockConditionalCreate', 'false');
    });
    await page.goto(TARGET_URL);
    await clickSigninButton(page);

    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__capabilitiesCalled);
    }, { timeout: 2000 }).toBe(true);

    const createCalled = await page.evaluate(() => (window as any).__createCalled);
    expect(createCalled).toBe(false);
  });

  test('Swallows common WebAuthn errors like NotAllowedError without displaying error messages to the user', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      const err = {
        name: 'NotAllowedError',
        message: 'The operation either timed out or was not allowed.'
      };
      (window as any).__mockCreateError = err;
      sessionStorage.setItem('__mockCreateError', JSON.stringify(err));
    });
    await page.goto(TARGET_URL);
    await clickSigninButton(page);

    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__createCalled);
    }, { timeout: 2000 }).toBe(true);

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
      (window as any).__mockVerifyFail = true;
      sessionStorage.setItem('__mockVerifyFail', 'true');
    });

    await page.goto(TARGET_URL);
    await clickSigninButton(page);

    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__signalUnknownCredentialCalled);
    }, { timeout: 2000 }).toBe(true);

    const signalOptions = await page.evaluate(() => (window as any).__signalOptions);
    expect(signalOptions?.credentialId).toBe('mock-id');
  });
});
