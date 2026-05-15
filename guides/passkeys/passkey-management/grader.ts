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
            lastUsedAt: Date.now() - 50000
          },
          {
            id: 'fake-cred-2',
            name: 'iCloud Keychain',
            aaguid: 'adce0002-35bc-c60a-2b7b-40b2fed21711',
            registeredAt: Date.now() - 200000,
            lastUsedAt: Date.now() - 10000
          }
        ])
      });
    });

    // Singular route matching demo paths correctly
    await page.route('**/api/credential/*', async (route) => {
      await route.fulfill({ status: 200 });
    });
  });

  test('renders credentials list containing zeroed AAGUID bypassed item', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForTimeout(500); // DOM parsing delay
    
    await expect(page.locator('body')).toContainText('My Security Key');
  });

  test('invokes signalAllAcceptedCredentials on DOMContentLoaded load', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForFunction(() => (window as any).__signalAcceptedCalled === true, { timeout: 2000 }).catch(() => {});
    
    const called = await page.evaluate(() => (window as any).__signalAcceptedCalled);
    expect(called).toBe(true);
  });

  test('invokes signalAllAcceptedCredentials upon credentials deletion triggers', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForTimeout(500);

    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    const deleteBtn = page.locator('button').filter({ hasText: /Remove|Delete/i });
    const count = await deleteBtn.count();
    expect(count).toBeGreaterThan(0); // Ensures button actually exists and fails if absent!

    await deleteBtn.first().click();
    await page.waitForFunction(() => (window as any).__signalAcceptedCalled === true, { timeout: 2000 }).catch(() => {});
    const called = await page.evaluate(() => (window as any).__signalAcceptedCalled);
    expect(called).toBe(true);
  });

  test('invokes signalCurrentUserDetails upon credential rename', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForTimeout(500);

    page.on('dialog', async dialog => {
      if (dialog.type() === 'prompt') {
        await dialog.accept('Renamed Passkey');
      } else {
        await dialog.accept();
      }
    });

    const renameBtn = page.locator('button').filter({ hasText: /Rename/i }).first();
    await renameBtn.click();
    await page.waitForFunction(() => (window as any).__signalDetailsCalled === true, { timeout: 2000 }).catch(() => {});
    const called = await page.evaluate(() => (window as any).__signalDetailsCalled);
    expect(called).toBe(true);
  });

  test('renders provider icon and last-used timestamp for AAGUID-resolvable credentials', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForTimeout(500);

    const icon = page.locator('[data-testid="provider-icon"]').first();
    await expect(icon).toBeVisible();

    const lastUsed = page.locator('[data-testid="last-used"]').first();
    await expect(lastUsed).toBeVisible();
  });

  test('feature-detects platform authenticator before rendering Create Passkey button', async ({ page, TARGET_URL }) => {
    await page.addInitScript(() => {
      (window as any).__mockPasskeyPlatformAuthenticator = false;
    });
    await page.goto(TARGET_URL);
    await page.waitForTimeout(500);
    const createBtn = page.locator('[data-testid="create-passkey-button"]');
    await expect(createBtn).toBeHidden();
  });
});
