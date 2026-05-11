import { test, expect } from '../../test-fixture.ts';
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

test.describe(`autofill-sign-in-form Expectations: ${demoName}`, () => {

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

    let urlToVisit = TARGET_URL;
    if (TARGET_URL.match(/^http:\/\/localhost:\d+$/)) {
      urlToVisit += '/signin';
    }

    await page.goto(urlToVisit);
  });

  test('All sign-in inputs must be within a <form> element', async ({ page }) => {
    const emailInForm = await page.locator('form input[type="email"]').count();
    const passwordInForm = await page.locator('form input[type="password"]').count();
    expect(emailInForm).toBe(1);
    expect(passwordInForm).toBe(1);
  });

  test('The form must have a submit button', async ({ page }) => {
    const submitButtons = page.locator('form button:not([type]), form button[type="submit"], form input[type="submit"]');
    await expect(submitButtons.first()).toBeVisible();
  });

  test('Every input in the form must have an associated label', async ({ page }) => {
    const result = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('form input'));
      if (inputs.length === 0) return { count: -1 };
      const unlabeled = inputs.filter(input => {
        const id = input.id;
        if (!id) return true;
        const label = document.querySelector(`label[for="${id}"]`);
        return !label || (label as HTMLElement).innerText.trim() === '';
      });
      return { count: unlabeled.length };
    });
    expect(result?.count).toBe(0);
  });

  test('Labels must have a "for" attribute matching an input "id"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return { count: -1 };
      const invalid = labels.filter(label => {
        const forAttr = label.getAttribute('for');
        if (!forAttr) return true;
        const input = document.getElementById(forAttr);
        return !input || input.tagName !== 'INPUT';
      });
      return { count: invalid.length };
    });
    expect(result?.count).toBe(0);
  });

  test('No element must use autocomplete="off"', async ({ page }) => {
    await expect(page.locator('[autocomplete="off"]')).toHaveCount(0);
  });

  test('Email input must have type="email"', async ({ page }) => {
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test('Email input must have autocomplete="username"', async ({ page }) => {
    await expect(page.locator('input[type="email"]').first()).toHaveAttribute('autocomplete', 'username');
  });

  test('Password input must have type="password"', async ({ page }) => {
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('Password input must have autocomplete="current-password"', async ({ page }) => {
    await expect(page.locator('input[type="password"]').first()).toHaveAttribute('autocomplete', 'current-password');
  });

  test('Password input must have id="current-password"', async ({ page }) => {
    await expect(page.locator('input[type="password"]').first()).toHaveId('current-password');
  });

  test('Email input must be required', async ({ page }) => {
    await expect(page.locator('input[type="email"]').first()).toHaveJSProperty('required', true);
  });

  test('Password input must be required', async ({ page }) => {
    await expect(page.locator('input[type="password"]').first()).toHaveJSProperty('required', true);
  });

  test('There must be exactly one email input', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toHaveCount(1);
  });

  test('There must be exactly one password input', async ({ page }) => {
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
  });

});
