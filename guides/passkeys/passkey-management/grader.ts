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

test.describe('Passkey Management Expectations', () => {
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
      (window as any).__signalAcceptedCalled = false;
      (window as any).__signalAcceptedOpts = null;
      (window as any).__signalDetailsCalled = false;
      (window as any).__signalDetailsOpts = null;
      (window as any).__mockPasskeyPlatformAuthenticator = true;

      Object.defineProperty(window, 'PublicKeyCredential', {
        value: class {
          static async getClientCapabilities() {
            return { passkeyPlatformAuthenticator: (window as any).__mockPasskeyPlatformAuthenticator };
          }
          static async signalAllAcceptedCredentials(opts: any) {
            (window as any).__signalAcceptedCalled = true;
            (window as any).__signalAcceptedOpts = opts;
          }
          static async signalCurrentUserDetails(opts: any) {
            (window as any).__signalDetailsCalled = true;
            (window as any).__signalDetailsOpts = opts;
          }
        },
        writable: true,
        configurable: true
      });
    });

    await page.route('**/api/credentials', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'fake-cred-1',
            name: 'My Security Key',
            aaguid: '00000000-0000-0000-0000-000000000000',
            registeredAt: Date.now() - 100000,
            lastUsedAt: Date.now() - 50000,
            userId: 'M2YPl-KGnA8'
          },
          {
            id: 'fake-cred-2',
            name: 'iCloud Keychain',
            aaguid: 'adce0002-35bc-c60a-2b7b-40b2fed21711',
            registeredAt: Date.now() - 200000,
            lastUsedAt: Date.now() - 10000,
            userId: 'M2YPl-KGnA8'
          }
        ])
      });
    });

    await page.route('**/api/credential/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok' })
      });
    });

    await page.route('**/aaguids.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          'adce0002-35bc-c60a-2b7b-40b2fed21711': { name: 'iCloud Keychain', icon_light: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }
        })
      });
    });
  });

  test('renders credentials list containing zeroed AAGUID bypassed item', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await expect(page.locator('body')).toContainText('My Security Key', { timeout: 5000 });
  });

  test('invokes signalAllAcceptedCredentials on DOMContentLoaded load', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForFunction(() => (window as any).__signalAcceptedCalled === true, { timeout: 5000 });
    const called = await page.evaluate(() => (window as any).__signalAcceptedCalled);
    expect(called).toBe(true);
  });

  test('invokes signalAllAcceptedCredentials upon credentials deletion triggers', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    page.on('dialog', async dialog => {
      await dialog.accept().catch(() => {});
    });

    const deleteBtn = page.locator('button').filter({ hasText: /Remove|Delete/i }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });

    await deleteBtn.click();
    await page.waitForFunction(() => (window as any).__signalAcceptedCalled === true, { timeout: 5000 });
    const called = await page.evaluate(() => (window as any).__signalAcceptedCalled);
    expect(called).toBe(true);
  });

  test('invokes Signal API (signalCurrentUserDetails or signalAllAcceptedCredentials) upon credential rename', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      window.prompt = () => 'Renamed Passkey';
      window.confirm = () => true;
    });
    await page.goto(TARGET_URL);
    page.on('dialog', async dialog => {
      await dialog.accept('Renamed Passkey').catch(() => {});
    });

    const renameBtn = page.locator('button').filter({ hasText: /Rename/i }).first();
    await expect(renameBtn).toBeVisible({ timeout: 5000 });

    await renameBtn.click();
    await page.waitForFunction(() => (window as any).__signalDetailsCalled === true || (window as any).__signalAcceptedCalled === true, { timeout: 10000 });
    const called = await page.evaluate(() => (window as any).__signalDetailsCalled || (window as any).__signalAcceptedCalled);
    expect(called).toBe(true);
  });

  test('renders provider icon and last-used timestamp for AAGUID-resolvable credentials', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    const icon = page.locator('[data-testid="provider-icon"]').first();
    await expect(icon).toBeVisible({ timeout: 5000 });

    const lastUsed = page.locator('[data-testid="last-used"]').first();
    await expect(lastUsed).toBeVisible({ timeout: 5000 });
  });

  test('feature-detects platform authenticator before rendering Create Passkey button', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      (window as any).__mockPasskeyPlatformAuthenticator = false;
      (window as any).__capabilitiesCalled = false;
      if (window.PublicKeyCredential) {
        const origCap = window.PublicKeyCredential.getClientCapabilities;
        Object.defineProperty(window.PublicKeyCredential, 'getClientCapabilities', {
          configurable: true,
          writable: true,
          value: async function() {
            (window as any).__capabilitiesCalled = true;
            return origCap ? origCap.apply(this, arguments as any) : { passkeyPlatformAuthenticator: false };
          }
        });
        const origIsUser = window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
        Object.defineProperty(window.PublicKeyCredential, 'isUserVerifyingPlatformAuthenticatorAvailable', {
          configurable: true,
          writable: true,
          value: async function() {
            (window as any).__capabilitiesCalled = true;
            return origIsUser ? origIsUser.apply(this, arguments as any) : false;
          }
        });
      }
    });
    await page.goto(TARGET_URL);
    const createBtn = page.locator('[data-testid="create-passkey-button"]');
    if ((await createBtn.count()) === 0) {
      test.skip();
      return;
    }
    const called = await page.evaluate(() => (window as any).__capabilitiesCalled === true);
    expect(called).toBe(true);
    await expect(createBtn).toBeHidden();
  });
});
