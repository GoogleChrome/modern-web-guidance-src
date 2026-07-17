import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.resolve('demo.html');
const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`persistent-toast-notifications Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);

    // Speed up transitions and animations to ensure instant E2E style checks without breaking transitionend events
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition-duration: 0.001s !important; animation-duration: 0.001s !important; }';
      document.head.appendChild(style);
    });
  });

  test(`1. Toasts must appear on top of all other page content`, async ({ page }) => {
    await page.locator('.toast-trigger').first().evaluate((btn: HTMLElement) => btn.click());
    
    const toast = page.locator('.toast').first();
    await toast.waitFor({ state: 'visible' });

    // Give time for any entry animations to finish
    await page.waitForTimeout(500);

    const isTopLayer = await toast.evaluate((el) => el.matches(':popover-open'));
    expect(isTopLayer).toBe(true);
  });

  test(`2. Clicking on the DOM content outside of the popover must not dismiss the toast notification.`, async ({ page }) => {
    await page.locator('.toast-trigger').first().evaluate((btn: HTMLElement) => btn.click());
    const toast = page.locator('.toast').first();
    await toast.waitFor({ state: 'visible' });

    await page.mouse.click(0, 0);
    await page.waitForTimeout(300);

    await expect(toast).toBeVisible();
  });

  test(`3. Multiple toasts must be able to be open at the same time without closing one another.`, async ({ page }) => {
    await page.locator('.toast-trigger').first().evaluate((btn: HTMLElement) => btn.click());
    await page.waitForTimeout(100);
    await page.locator('.toast-trigger').first().evaluate((btn: HTMLElement) => btn.click());
    await page.waitForTimeout(100);
    
    const toasts = page.locator('.toast');
    await expect(toasts).toHaveCount(2);
    await expect(toasts.nth(0)).toBeVisible();
    await expect(toasts.nth(1)).toBeVisible();
    
    // Also check that it's popover=manual
    const hasManual = await toasts.nth(0).evaluate((el) => el.getAttribute('popover') === 'manual');
    expect(hasManual).toBe(true);
  });

  test(`4. The toast must correctly remove itself from the Top Layer once dismissed.`, async ({ page }) => {
    await page.locator('.toast-trigger').first().evaluate((btn: HTMLElement) => btn.click());
    const toast = page.locator('.toast').first();
    await toast.waitFor({ state: 'visible' });

    const closeBtn = toast.locator('button, .toast-close').first();
    await closeBtn.evaluate((btn: HTMLElement) => btn.click()).catch(() => {});

    await expect(toast).toBeHidden({ timeout: 4000 });
  });
});
