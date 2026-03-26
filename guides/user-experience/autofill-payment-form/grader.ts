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

test.describe(`Autofill Payment Form Expectations: ${demoName}`, () => {

  // Browser Tests
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

  test('All input, select, and textarea elements must be within a <form> element', async ({ page }) => {
    const nonFormInputs = await page.locator('input:not(form input), select:not(form select), textarea:not(form textarea)').count();
    expect(nonFormInputs).toBe(0);
  });

  test('Every input, select, or textarea element in a form must have an associated <label>', async ({ page }) => {
    const result = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      if (inputs.length === 0) return false;
      return inputs.every(input => {
        const id = input.getAttribute('id');
        return id && document.querySelector(`label[for="${id}"]`);
      });
    });
    expect(result).toBe(true);
  });

  test('Every label element must have a "for" attribute matching an input "id"', async ({ page }) => {
    const result = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return false;
      return labels.every(label => {
        const forAttr = label.getAttribute('for');
        return forAttr && document.getElementById(forAttr);
      });
    });
    expect(result).toBe(true);
  });

  test('A single input element must be used for the payment card number', async ({ page }) => {
    await expect(page.locator('input[autocomplete="cc-number"]')).toHaveCount(1, { timeout: 2000 });
  });

  test('The cardholder name input must allow Unicode characters', async ({ page }) => {
    const pattern = await page.locator('input[autocomplete="cc-name"]').getAttribute('pattern', { timeout: 2000 });
    // If no pattern is provided, it doesn't enforce Latin-only, so it passes.
    // If a pattern is provided, it must allow a Unicode letter like 'é'.
    const isValid = pattern ? new RegExp(pattern, 'u').test('Jérôme') : true;
    expect(isValid).toBe(true);
  });

  test('The card security code input must not use type="password"', async ({ page }) => {
    const type = await page.locator('input[autocomplete="cc-csc"]').getAttribute('type', { timeout: 2000 });
    expect(type).not.toBe('password');
  });

  test('No payment card input field should use type="number"', async ({ page }) => {
    const numberInputs = await page.locator('input[type="number"]').count();
    expect(numberInputs).toBe(0);
  });

  test('The payment card inputs must have inputmode="numeric"', async ({ page }) => {
    const ccInput = page.locator('input[autocomplete="cc-number"]');
    const cscInput = page.locator('input[autocomplete="cc-csc"]');
    const result = await Promise.all([
      ccInput.getAttribute('inputmode', { timeout: 2000 }),
      cscInput.getAttribute('inputmode', { timeout: 2000 })
    ]);
    expect(result.every(mode => mode === 'numeric')).toBe(true);
  });

  test('All required payment form fields must have the "required" attribute', async ({ page }) => {
    const result = await page.evaluate(() => {
      const fields = ['cc-number', 'cc-name', 'cc-exp', 'cc-csc'];
      return fields.every(field => {
        const input = document.querySelector(`input[autocomplete="${field}"]`);
        return input && input.hasAttribute('required');
      });
    });
    expect(result).toBe(true);
  });

});
