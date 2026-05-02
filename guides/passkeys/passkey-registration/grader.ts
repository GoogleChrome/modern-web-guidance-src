/// <reference types="node" />
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

      Object.defineProperty(window, 'PublicKeyCredential', {
        value: class {
          static async getClientCapabilities() {
            return { passkeyPlatformAuthenticator: (window as any).__mockPasskeyPlatformAuthenticator };
          }
          static parseCreationOptionsFromJSON(opts: any) {
            (window as any).__parseCalled = true;
            return { __magic: 'parsed' };
          }
          static async signalUnknownCredential(opts: any) {
            (window as any).__signalCalled = true;
            (window as any).__signalOptions = opts;
          }
        },
        writable: true,
        configurable: true
      });

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

    await page.route('**/api/register/options', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          challenge: 'fake-challenge', 
          user: { id: 'fake-user-id' },
          excludeCredentials: [{ id: 'fake-cred-id' }]
        })
      });
    });
    await page.route('**/api/register/verify', async (route) => {
      await route.fulfill({ status: 200 });
    });
  });

  test('detects passkeyPlatformAuthenticator support using getClientCapabilities prior to prompting', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__mockPasskeyPlatformAuthenticator = false;
    });
    
    await page.goto(`file://${targetFile}`);
    await page.locator('[data-testid="register-button"]').click();
    await page.waitForTimeout(200);
    
    const createCalled = await page.evaluate(() => (window as any).__createCalled);
    expect(createCalled).toBe(false);
  });

  test('triggers options generation from the /register/options server endpoint using an action-oriented promo flag parameter', async ({ page }) => {
    let optionsRequest: any = null;
    let optionsBody: any = null;
    
    await page.route('**/api/register/options', async (route) => {
      optionsRequest = route.request();
      if (optionsRequest.method() === 'POST') {
        try {
          optionsBody = JSON.parse(optionsRequest.postData() || '{}');
        } catch (e) {}
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          challenge: 'fake', 
          user: { id: 'fake' },
          excludeCredentials: [{ id: 'fake' }]
        })
      });
    });
    
    await page.goto(`file://${targetFile}`);
    await page.locator('[data-testid="register-button"]').click();
    await page.waitForTimeout(200);
    
    expect(optionsRequest).not.toBeNull();
    expect(optionsRequest.method()).toBe('POST');
    expect(optionsBody).not.toBeNull();
    expect(optionsBody).toHaveProperty('promotion');
    expect(optionsBody.promotion).toBe(true);
  });

  test('decodes option parameters safely using PublicKeyCredential.parseCreationOptionsFromJSON', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    await page.locator('[data-testid="register-button"]').click();
    await page.waitForTimeout(200);
    
    const parseCalled = await page.evaluate(() => (window as any).__parseCalled);
    expect(parseCalled).toBe(true);
  });

  test('invokes the native biometric creation flow via navigator.credentials.create with parsed options', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    await page.locator('[data-testid="register-button"]').click();
    await page.waitForTimeout(200);
    
    const createCalled = await page.evaluate(() => (window as any).__createCalled);
    expect(createCalled).toBe(true);
    
    const createOptions = await page.evaluate(() => (window as any).__createOptions);
    expect(createOptions?.publicKey?.__magic).toBe('parsed');
  });

  test('segregates WebAuthn API exceptions try/catch scopes to avoid signaling safe cancels', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__mockCreateError = { name: 'NotAllowedError', message: 'User cancelled' };
    });
    
    await page.goto(`file://${targetFile}`);
    await page.locator('[data-testid="register-button"]').click();
    await page.waitForTimeout(200);
    
    const signalCalled = await page.evaluate(() => (window as any).__signalCalled);
    expect(signalCalled).toBe(false);
  });

  test('triggers signalUnknownCredential using Base64URL-encoded credential ID if server verification fails', async ({ page }) => {
    await page.route('**/api/register/verify', async (route) => {
      await route.fulfill({ status: 500 });
    });
    
    await page.goto(`file://${targetFile}`);
    await page.locator('[data-testid="register-button"]').click();
    await page.waitForTimeout(200);
    
    const signalCalled = await page.evaluate(() => (window as any).__signalCalled);
    expect(signalCalled).toBe(true);
    
    const signalOptions = await page.evaluate(() => (window as any).__signalOptions);
    expect(signalOptions?.credentialId).toBe('fake-id');
  });
});
