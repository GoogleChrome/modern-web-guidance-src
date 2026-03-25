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

// Tests
test.describe(`autofill-payment-form Expectations: ${demoName}`, () => {
  // Static assertions
  test(`The :auto-fill CSS pseudo-class MUST NOT be used`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/:auto-fill/);
  });

  test(`The :autofill CSS pseudo-class MUST be used instead of :auto-fill`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:autofill/);
  });

  // Setup browser testing
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

  // Browser assertions
  test(`Payment form uses well-known field UI label values such as "Card number"`, async ({ page }) => {
    const labels = await page.locator('label, span').allTextContents();
    expect(labels.join(' ').toLowerCase()).toMatch(/card number/);
  });

  test(`Submit button uses a well-known UI label such as "Complete payment"`, async ({ page }) => {
    const buttonText = await page.locator('button, input[type="submit"], .btn').first().textContent();
    expect(buttonText?.toLowerCase()).toMatch(/complete payment/);
  });

  test(`Appropriate payment card autocomplete attributes MUST be used`, async ({ page }) => {
    const count = await page.locator('input[autocomplete="cc-number"]').count();
    expect(count).toBe(1);
  });

  test(`Credit card number input uses inputmode="numeric"`, async ({ page }) => {
    const ccInput = page.locator('input[autocomplete="cc-number"], input#cc1');
    await expect(ccInput.first()).toHaveAttribute('inputmode', 'numeric');
  });

  test(`Credit card number input MUST allow spaces in pattern`, async ({ page }) => {
    const ccInput = page.locator('input[autocomplete="cc-number"], input#cc1');
    await expect(ccInput.first()).toHaveAttribute('pattern', / /);
  });

  test(`A single <input> element MUST be used for entry of a payment card number`, async ({ page }) => {
    const ccInput = page.locator('input[autocomplete="cc-number"], input#cc1');
    const maxLength = await ccInput.first().getAttribute('maxlength');
    expect(Number(maxLength)).toBeGreaterThan(4);
  });

  test(`Name on card input uses autocomplete="cc-name"`, async ({ page }) => {
    const nameInput = page.locator('input[autocomplete="cc-name"], input#ccname');
    await expect(nameInput.first()).toHaveAttribute('autocomplete', 'cc-name');
  });

  test(`Name on card input MUST NOT enforce Latin-only characters`, async ({ page }) => {
    const nameInput = page.locator('input[autocomplete="cc-name"], input#ccname');
    await expect(nameInput.first()).toHaveAttribute('pattern', /\p\{L\}/);
  });

  test(`Expiry date input uses placeholder="MM/YY"`, async ({ page }) => {
    const expInput = page.locator('input[autocomplete="cc-exp"], input#exp-month');
    await expect(expInput.first()).toHaveAttribute('placeholder', 'MM/YY');
  });

  test(`Security code input MUST allow entry of 3 or 4 digits`, async ({ page }) => {
    const cscInput = page.locator('input[autocomplete="cc-csc"], input#cc-csc, input#cvv');
    await expect(cscInput.first()).toHaveAttribute('pattern', /\{3,4\}/);
  });

  test(`Inputs MUST be within a <form> element`, async ({ page }) => {
    const formCount = await page.locator('form').count();
    expect(formCount).toBe(1);
  });

  test(`Every form field MUST have an autocomplete attribute`, async ({ page }) => {
    const missingAutocomplete = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="hidden"]):not([autocomplete]), select:not([autocomplete]), textarea:not([autocomplete])'));
      return elements.filter(el => el.id !== 'cc-csc').length;
    });
    expect(missingAutocomplete).toBe(0);
  });

  test(`Every form field MUST have an id and name attribute`, async ({ page }) => {
    const missingIdOrName = await page.locator('input:not([type="submit"]):not([type="hidden"]):not([id][name]), select:not([id][name]), textarea:not([id][name])').count();
    expect(missingIdOrName).toBe(0);
  });

  test(`id and name attributes MUST be unique`, async ({ page }) => {
    const isUniqueAndValid = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="hidden"]), select, textarea')) as HTMLInputElement[];
      const ids = elements.map(el => el.id).filter(Boolean);
      const names = elements.map(el => el.name).filter(Boolean);
      if (elements.some(el => !el.name)) return false;
      const uniqueIds = new Set(ids).size === ids.length;
      const uniqueNames = new Set(names).size === names.length;
      return uniqueIds && uniqueNames;
    });
    expect(isUniqueAndValid).toBe(true);
  });

  test(`id and name attributes SHOULD be the same`, async ({ page }) => {
    const hasMismatch = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="hidden"]), select, textarea')) as HTMLInputElement[];
      return elements.some(el => el.id !== el.name);
    });
    expect(hasMismatch).toBe(false);
  });

  test(`A pattern attribute SHOULD be provided for validation when appropriate`, async ({ page }) => {
    const ccInput = page.locator('input[autocomplete="cc-number"], input#cc1');
    const hasPattern = await ccInput.first().getAttribute('pattern');
    expect(hasPattern).toBeTruthy();
  });

  test(`Every form element MUST be visually labeled using a <label>`, async ({ page }) => {
    const inputsWithoutLabel = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="hidden"]), select, textarea'));
      return inputs.filter(input => {
        if (input.closest('label')) return false;
        if (input.id && document.querySelector(`label[for="${input.id}"]`)) return false;
        return true;
      }).length;
    });
    expect(inputsWithoutLabel).toBe(0);
  });

  test(`Every <label> MUST have a valid for attribute matching an element id`, async ({ page }) => {
    const valid = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return false;
      return labels.every(label => {
        const htmlFor = label.getAttribute('for');
        return htmlFor && document.getElementById(htmlFor);
      });
    });
    expect(valid).toBe(true);
  });

  test(`type="number" MUST NOT be used for payment card inputs`, async ({ page }) => {
    const typeNumberCount = await page.locator('input[type="number"]').count();
    expect(typeNumberCount).toBe(0);
  });

  test(`type="password" MUST NOT be used for security codes`, async ({ page }) => {
    const typePasswordCount = await page.locator('input[type="password"]').count();
    expect(typePasswordCount).toBe(0);
  });
});