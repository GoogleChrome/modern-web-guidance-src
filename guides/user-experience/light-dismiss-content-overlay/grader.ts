// @ts-nocheck
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.use({ hasTouch: true, isMobile: true });

test.describe(`Swipeable Layered Navigation Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.slice(1));

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  async function openMenu(page: Page) {
    const menuBtn = page.locator('button', { hasText: /Menu/i }).first();
    if (await menuBtn.isVisible()) {
      await menuBtn.evaluate((btn: HTMLElement) => btn.click());
      await page.waitForTimeout(500); // Wait for transition
    } else {
      // Fallback
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        if (await btn.isVisible()) {
          await btn.click({ force: true });
          await page.waitForTimeout(500);
          if (await page.locator(':popover-open').count() > 0) {
            break;
          }
        }
      }
    }
    
    const openPopover = page.locator(':popover-open').first();
    await expect(openPopover).toBeVisible({ timeout: 2000 });
    return openPopover;
  }

  test('The navigation menu must be a manual popover', async ({ page }) => {
    const popovers = await page.locator('[popover]').all();
    let hasManual = false;
    for (const p of popovers) {
      if (await p.getAttribute('popover') === 'manual') {
        hasManual = true;
        break;
      }
    }
    expect(hasManual).toBe(true);
  });

  test('Inert the rest of the page using JavaScript if you are using a ::backdrop to visually separate the menu from the rest of the DOM content.', async ({ page }) => {
    await openMenu(page);

    // After opening the menu, an element (like main) should have the inert attribute
    const inertElementsCount = await page.locator('[inert]').count();
    expect(inertElementsCount).toBeGreaterThan(0);
  });

  test('The user must be able to swipe the menu closed on touch devices', async ({ page }) => {
    const openPopover = await openMenu(page);
    
    // Pragmatic approach: Programmatically set scroll and dispatch event to verify logic
    await openPopover.evaluate((el) => {
      const scrollable = el.querySelector('.scroll-container') || el;
      scrollable.scrollLeft = scrollable.scrollWidth;
      scrollable.dispatchEvent(new Event('scrollend'));
    });
    
    // Wait for the closing animation/logic
    await page.waitForTimeout(1000);
    
    // Verify it is closed
    await expect(page.locator(':popover-open')).not.toBeVisible();
  });
});
