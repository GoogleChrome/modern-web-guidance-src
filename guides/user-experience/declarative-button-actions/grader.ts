import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Invoker Commands API Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Route local files
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

    // Inject a minimal polyfill to ensure the declarative API works even if the browser 
    // version in the test environment hasn't fully implemented custom commands yet.
    // This allows us to test the declarative intent even in older Playwright environments,
    // though Playwright 1.59+ should be very recent.
    await page.addInitScript(() => {
      if (!('commandForElement' in HTMLButtonElement.prototype)) {
        document.addEventListener('click', (event: MouseEvent) => {
          const button = (event.target as Element).closest('button[commandfor][command]');
          if (!button) return;
          const targetId = button.getAttribute('commandfor');
          const command = button.getAttribute('command');
          if (targetId && command) {
            const target = document.getElementById(targetId);
            if (target) {
              const cmdEvent = new CustomEvent('command', {
                bubbles: true,
                cancelable: true,
                detail: { command }
              });
              // Custom commands should also be available on the event object itself
              Object.defineProperty(cmdEvent, 'command', { value: command, enumerable: true });
              target.dispatchEvent(cmdEvent);
            }
          }
        });
      }
    });
  });

  test('Spin button uses commandfor attribute to link to target', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Spin/i });
    await expect(btn).toHaveAttribute('commandfor');
  });

  test('Spin button uses a custom command starting with --', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Spin/i });
    await expect(btn).toHaveAttribute('command', /^--/);
  });

  test('Clicking Spin toggles is-spun class on target element', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Spin/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    await expect(target).toHaveClass(/is-spun/);
  });

  test('Clicking Grow toggles is-grown class on target element', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Grow/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    await expect(target).toHaveClass(/is-grown/);
  });

  test('Clicking Make Round toggles is-rounded class on target element', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Make Round/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    await expect(target).toHaveClass(/is-rounded/);
  });

  test('Clicking Reset All removes all transformation classes', async ({ page }) => {
    // Setup: Apply all transformations first
    await page.getByRole('button', { name: /Spin/i }).click();
    await page.getByRole('button', { name: /Grow/i }).click();
    await page.getByRole('button', { name: /Make Round/i }).click();

    const btn = page.getByRole('button', { name: /Reset All/i });
    const targetId = (await btn.getAttribute('commandfor')) || 'non-existent-target';
    const target = page.locator(`#${targetId}`);

    await btn.click();
    // Use a single assertion to verify no state-specific classes remain
    await expect(target).not.toHaveClass(/is-spun|is-grown|is-rounded/);
  });

});
