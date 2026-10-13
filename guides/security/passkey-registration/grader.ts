import { test, expect } from '../../test-fixture.ts';

test.describe('Passkey Registration Expectations', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__createCalled = false;
      (window as any).__createOptions = null;
      (window as any).__parseCalled = false;
      (window as any).__signalCalled = false;
      (window as any).__signalOptions = null;
      (window as any).__verifyCalled = false;
      (window as any).__verifyBody = null;
      (window as any).__capabilitiesCalled = false;
      (window as any).__verifyShouldFail = false;
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
          if ((window as any).__verifyShouldFail) {
            return {
              ok: false,
              status: 400,
              json: async () => ({ status: 'error' })
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
        OriginalPKC.getClientCapabilities = async () => {
          (window as any).__capabilitiesCalled = true;
          return { passkeyPlatformAuthenticator: (window as any).__mockPasskeyPlatformAuthenticator, conditionalCreate: true };
        };
        OriginalPKC.isUserVerifyingPlatformAuthenticatorAvailable = async () => {
          (window as any).__capabilitiesCalled = true;
          return Boolean((window as any).__mockPasskeyPlatformAuthenticator);
        };
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
    await page.goto(TARGET_URL);
    await page.waitForTimeout(300);
    const capabilitiesCalled = await page.evaluate(() => Boolean((window as any).__capabilitiesCalled));
    expect(capabilitiesCalled).toBe(true);
  });

  test('invokes native browser create biometrics trigger upon register click', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey")').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click'));
    await page.waitForTimeout(500);
    
    const called = await page.evaluate(() => Boolean((window as any).__createCalled));
    expect(called).toBe(true);
  });

  test('decodes server creation options via parseCreationOptionsFromJSON before invoking the authenticator', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey")').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click'));
    await page.waitForTimeout(500);

    const parseCalled = await page.evaluate(() => Boolean((window as any).__parseCalled));
    expect(parseCalled).toBe(true);
  });

  test('submits the attestation to the verify endpoint as JSON-encoded credential data', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey")').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click'));
    await page.waitForTimeout(500);

    const verifyState = await page.evaluate(() => ({
      called: Boolean((window as any).__verifyCalled),
      body: (window as any).__verifyBody
    }));
    expect(verifyState.called && Boolean(verifyState.body)).toBe(true);
  });

  test('signals signalUnknownCredential using Base64URL credentialId upon server verification failure', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      (window as any).__verifyShouldFail = true;
    });
    await page.goto(TARGET_URL);
    const button = page.locator('[data-testid="register-button"], button:has-text("Register"), button:has-text("Create Passkey")').first();
    await button.click({ force: true }).catch(() => button.dispatchEvent('click'));
    await page.waitForTimeout(500);

    const signalState = await page.evaluate(() => ({
      called: Boolean((window as any).__signalCalled),
      options: (window as any).__signalOptions
    }));
    expect(signalState.called && typeof signalState.options?.credentialId === 'string' && signalState.options.credentialId.length > 0).toBe(true);
  });
});
