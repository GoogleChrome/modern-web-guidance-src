import { test, expect } from '@playwright/test';
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

test.describe(`Autofill Sign-up Form Expectations: ${demoName}`, () => {

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
  });

  test('Input elements MUST be within a <form> element', async ({ page }) => {
    const allInputsInForm = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      return inputs.every(i => !!i.closest('form'));
    });
    expect(allInputsInForm).toBe(true);
  });

  test('The form MUST have a submit button', async ({ page }) => {
    await expect(page.locator('form button:not([type]), form button[type="submit"], form input[type="submit"]').first()).toBeVisible();
  });

  test('Every <input> in the form MUST be labeled using a <label> element', async ({ page }) => {
    const allLabeled = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('form input:not([type="submit"]):not([type="button"]):not([type="hidden"])'));
      if (inputs.length === 0) return false;
      return inputs.every(i => !!document.querySelector(`label[for="${i.id}"]`) || !!i.closest('label'));
    });
    expect(allLabeled).toBe(true);
  });

  test('Every <label> MUST have a "for" attribute matching an input "id"', async ({ page }) => {
    const labelsValid = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return false;
      return labels.every(l => {
        const forId = l.getAttribute('for');
        return forId && document.getElementById(forId)?.tagName === 'INPUT';
      });
    });
    expect(labelsValid).toBe(true);
  });

  test('The email input MUST have type="email"', async ({ page }) => {
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test('The email input MUST have autocomplete="username"', async ({ page }) => {
    await expect(page.locator('input[type="email"]').first()).toHaveAttribute('autocomplete', 'username');
  });

  test('The password input MUST have type="password"', async ({ page }) => {
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('The password input MUST have autocomplete="new-password"', async ({ page }) => {
    await expect(page.locator('input[type="password"]').first()).toHaveAttribute('autocomplete', 'new-password');
  });

  test('The password input MUST have id="new-password"', async ({ page }) => {
    await expect(page.locator('input[type="password"]').first()).toHaveId('new-password');
  });

  test('The email input MUST have the "required" attribute', async ({ page }) => {
    await expect(page.locator('input[type="email"]').first()).toHaveJSProperty('required', true);
  });

  test('The password input MUST have the "required" attribute', async ({ page }) => {
    await expect(page.locator('input[type="password"]').first()).toHaveJSProperty('required', true);
  });

  test('There MUST be exactly one email input', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toHaveCount(1);
  });

  test('There MUST be exactly one password input', async ({ page }) => {
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
  });

  test('Name input pattern MUST NOT restrict to Latin-only characters', async ({ page }) => {
    const pattern = await page.locator('input[autocomplete="name"], input[id*="name"], input[name*="name"]').first().getAttribute('pattern').catch(() => null);
    if (!pattern) return;
    expect(new RegExp(`^(?:${pattern})$`, 'u').test('Renée')).toBe(true);
  });

});
