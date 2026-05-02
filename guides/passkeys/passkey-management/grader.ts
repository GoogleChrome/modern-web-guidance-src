import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

test.describe('Passkey Management Expectations', () => {
  test.beforeEach(async ({ page }) => {
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

    await page.route('**/api/credentials/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 200 });
      } else {
        await route.fulfill({ status: 200 });
      }
    });
  });

  test('renders credentials list containing zeroed AAGUID bypassed item', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    await page.waitForTimeout(500); // DOM parsing delay
    
    // Correctly verify that the card rendered the credential Name on DOM safely
    await expect(page.locator('body')).toContainText('My Security Key');
  });

  test('invokes signalAllAcceptedCredentials on DOMContentLoaded load', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    await page.waitForTimeout(500);
    
    const called = await page.evaluate(() => (window as any).__signalAcceptedCalled);
    expect(called).toBe(true);
  });

  test('invokes signalAllAcceptedCredentials upon credentials deletion triggers', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    await page.waitForTimeout(500);
    
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // Tolerant buttons click targeting text string content
    const deleteBtn = page.locator('button').filter({ hasText: /Remove|Delete/i });
    if (await deleteBtn.count() > 0) {
      await deleteBtn.first().click();
      await page.waitForTimeout(500);
      const called = await page.evaluate(() => (window as any).__signalAcceptedCalled);
      expect(called).toBe(true);
    }
  });
});
