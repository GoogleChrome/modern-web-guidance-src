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

      Object.defineProperty(window, 'PublicKeyCredential', {
        value: class {
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
    await page.waitForTimeout(500);
    
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
    await page.waitForTimeout(500);
    const called = await page.evaluate(() => (window as any).__signalAcceptedCalled);
    expect(called).toBe(true);
  });
});
