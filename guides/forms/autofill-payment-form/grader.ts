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
      const inputs = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"]), select, textarea'));
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

  test('A single input element must be used for the payment card number with autocomplete="cc-number"', async ({ page }) => {
    await expect(page.locator('input[autocomplete*="cc-number"]')).toHaveCount(1, { timeout: 2000 });
  });

  test('The cardholder name input must have autocomplete="cc-name" and allow Unicode characters', async ({ page }) => {
    const nameInput = page.locator('input[autocomplete*="cc-name"]');
    await expect(nameInput).toHaveCount(1, { timeout: 2000 });
    const pattern = await nameInput.first().getAttribute('pattern', { timeout: 2000 });
    const isValid = !pattern || new RegExp(pattern, 'u').test('Jérôme');
    expect(isValid).toBe(true);
  });

  test('The card expiry date input must have autocomplete="cc-exp"', async ({ page }) => {
    await expect(page.locator('input[autocomplete*="cc-exp"]')).toHaveCount(1, { timeout: 2000 });
  });

  test('The card security code input must have autocomplete="cc-csc" and must not use type="password"', async ({ page }) => {
    const cscInput = page.locator('input[autocomplete*="cc-csc"]');
    await expect(cscInput).toHaveCount(1, { timeout: 2000 });
    const type = await cscInput.first().getAttribute('type', { timeout: 2000 });
    expect(type).not.toBe('password');
  });

  test('No payment card input field should use type="number"', async ({ page }) => {
    const hasControls = await page.locator('form input').count();
    expect(hasControls).toBeGreaterThan(0);
    const numberInputs = await page.locator('input[type="number"]').count();
    expect(numberInputs).toBe(0);
  });

  test('The card number and security code inputs must have inputmode="numeric"', async ({ page }) => {
    const ccInput = page.locator('input[autocomplete*="cc-number"]').first();
    const cscInput = page.locator('input[autocomplete*="cc-csc"]').first();
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
        const input = document.querySelector(`input[autocomplete*="${field}"]`);
        return input && input.hasAttribute('required');
      });
    });
    expect(result).toBe(true);
  });

  test('The expiry date input must have a visible format hint rendered above the input and linked with aria-describedby', async ({ page }) => {
    const result = await page.evaluate(() => {
      const expInput = document.querySelector<HTMLInputElement>('input[autocomplete*="cc-exp"]');
      if (!expInput) return false;

      // A placeholder must not stand in for the label
      const hasLabel = Boolean(
        (expInput.id && document.querySelector(`label[for="${CSS.escape(expInput.id)}"]`)) ||
        expInput.closest('label')
      );
      if (!hasLabel) return false;

      // Must be linked via aria-describedby to a visible hint rendered above the input
      const describedBy = expInput.getAttribute('aria-describedby')?.trim();
      if (!describedBy) return false;

      const hintEls = describedBy
        .split(/\s+/)
        .map(id => document.getElementById(id))
        .filter((el): el is HTMLElement => Boolean(el));
      if (hintEls.length === 0) return false;

      const inputRect = expInput.getBoundingClientRect();
      return hintEls.some(hint => {
        const text = (hint.textContent || '').trim();
        if (!text) return false;
        const rect = hint.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.top <= inputRect.top;
      });
    });
    expect(result).toBe(true);
  });

});
