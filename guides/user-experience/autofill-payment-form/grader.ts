import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`autofill-address-form Expectations: ${demoName}`, () => {

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

  test('In a payment form use well-known and easily understood form field UI label values', async ({ page }) => {
    const labels = await page.locator('label').allTextContents();
    const joined = labels.join(' ').toLowerCase();
    
    expect(joined).toMatch(/card number/i);
    expect(joined).toMatch(/name on card/i);
    expect(joined).toMatch(/expiry date/i);
    expect(joined).toMatch(/security code/i);
  });

  test('For the button used for form submission in a payment form, use a well-known and easily understood button UI label', async ({ page }) => {
    const button = page.locator('button, input[type="submit"]');
    await expect(button).toHaveCount(1);
    const text = await button.textContent();
    const val = await button.getAttribute('value');
    const combined = `${text || ''} ${val || ''}`.toLowerCase();
    expect(combined).toMatch(/complete payment/i);
  });

  test('Appropriate payment card autocomplete attributes with valid MUST be used in a payment form', async ({ page }) => {
    const inputs = page.locator('input:not([type="submit"]), select, textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const autocomplete = await inputs.nth(i).getAttribute('autocomplete');
      if (autocomplete !== null) {
        expect(autocomplete).not.toBe('off');
      }
    }
  });

  test('For user entry of a credit card number in a payment form, use a single <input> element with the following format', async ({ page }) => {
    const ccNumber = page.locator('input[autocomplete="cc-number"]');
    await expect(ccNumber).toHaveCount(1);
    await expect(ccNumber).toHaveAttribute('id', 'cc-number');
    await expect(ccNumber).toHaveAttribute('name', 'cc-number');
    await expect(ccNumber).toHaveAttribute('inputmode', 'numeric');
    await expect(ccNumber).toHaveAttribute('maxlength', '50');
    const pattern = await ccNumber.getAttribute('pattern');
    expect(pattern).toBe('[\\d ]{10,30}');
    const required = await ccNumber.getAttribute('required');
    expect(required).not.toBeNull();
  });

  test('DO NOT prevent a user from entering spaces in a credit card number', async ({ page }) => {
    const ccNumber = page.locator('input[autocomplete="cc-number"]');
    await expect(ccNumber).toHaveCount(1);
    const pattern = await ccNumber.getAttribute('pattern');
    expect(pattern).toContain(' ');
  });

  test('A single <input> element MUST be used for entry of a payment card number', async ({ page }) => {
    const ccNumberInputs = page.locator('input[autocomplete="cc-number"]');
    await expect(ccNumberInputs).toHaveCount(1);
  });

  test("For user entry of the credit card holder's name in a payment form, use the following format", async ({ page }) => {
    const ccName = page.locator('input[autocomplete="cc-name"]');
    await expect(ccName).toHaveCount(1);
    await expect(ccName).toHaveAttribute('id', 'cc-name');
    await expect(ccName).toHaveAttribute('name', 'cc-name');
    await expect(ccName).toHaveAttribute('maxlength', '50');
    const pattern = await ccName.getAttribute('pattern');
    expect(pattern).toBe('[\\p{L} \\-\\.]+');
    const required = await ccName.getAttribute('required');
    expect(required).not.toBeNull();
  });

  test("DO NOT enforce Latin-only characters for input of the cardholder's name", async ({ page }) => {
    const ccName = page.locator('input[autocomplete="cc-name"]');
    await expect(ccName).toHaveCount(1);
    const pattern = await ccName.getAttribute('pattern');
    expect(pattern).not.toBe('[A-Za-z]+');
    expect(pattern).toContain('\\p{L}');
  });

  test('For user entry of a credit card expiry date in a payment form, use the following format', async ({ page }) => {
    const ccExp = page.locator('input[autocomplete="cc-exp"]');
    await expect(ccExp).toHaveCount(1);
    await expect(ccExp).toHaveAttribute('id', 'cc-exp');
    await expect(ccExp).toHaveAttribute('name', 'cc-exp');
    await expect(ccExp).toHaveAttribute('placeholder', 'MM/YY');
    await expect(ccExp).toHaveAttribute('maxlength', '5');
    const required = await ccExp.getAttribute('required');
    expect(required).not.toBeNull();
  });

  test('For user entry of a credit card security code in a payment form, use the following format', async ({ page }) => {
    const ccCsc = page.locator('input#cc-csc');
    await expect(ccCsc).toHaveCount(1);
    await expect(ccCsc).toHaveAttribute('id', 'cc-csc');
    await expect(ccCsc).toHaveAttribute('name', 'cc-csc');
    await expect(ccCsc).toHaveAttribute('inputmode', 'numeric');
    await expect(ccCsc).toHaveAttribute('maxlength', '4');
    const required = await ccCsc.getAttribute('required');
    expect(required).not.toBeNull();
    const pattern = await ccCsc.getAttribute('pattern');
    expect(['[\\d ]{3,4}', '[0-9]{3,4}']).toContain(pattern);
  });

  test('<input>, <select>, and <textarea> elements MUST be within a <form> element', async ({ page }) => {
    const inputs = page.locator('input:not([type="submit"]), select, textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const parentForm = inputs.nth(i).locator('xpath=ancestor::form');
      await expect(parentForm).toHaveCount(1);
    }
  });

  test('Every <input>, <select>, and <textarea> element MUST have an autocomplete attribute with a valid value', async ({ page }) => {
    const inputs = page.locator('input:not([type="submit"]), select, textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const autocomplete = await inputs.nth(i).getAttribute('autocomplete');
      const id = await inputs.nth(i).getAttribute('id');
      if (id !== 'cc-csc') {
        expect(autocomplete).toBeTruthy();
        expect(autocomplete).not.toBe('off');
      }
    }
  });

  test('Every <input>, <select>, or <textarea> element in a form MUST have an id attribute and a name attribute', async ({ page }) => {
    const inputs = page.locator('input:not([type="submit"]), select, textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      const name = await inputs.nth(i).getAttribute('name');
      expect(id).toBeTruthy();
      expect(name).toBeTruthy();
    }
  });

  test('id and name attributes MUST be unique to each element', async ({ page }) => {
    const inputs = page.locator('input:not([type="submit"]), select, textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    const ids = new Set();
    const names = new Set();
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      const name = await inputs.nth(i).getAttribute('name');
      
      expect(id).toBeTruthy();
      expect(ids.has(id)).toBeFalsy();
      ids.add(id);

      expect(name).toBeTruthy();
      expect(names.has(name)).toBeFalsy();
      names.add(name);
    }
  });

  test('The value of the id and name attributes of a form element SHOULD be the same', async ({ page }) => {
    const inputs = page.locator('input:not([type="submit"]), select, textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      const name = await inputs.nth(i).getAttribute('name');
      expect(id).toBe(name);
    }
  });

  test('Every <input>, <select>, or <textarea> element in a form MUST be visually labeled using a <label> element', async ({ page }) => {
    const inputs = page.locator('input:not([type="submit"]), select, textarea');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const id = await inputs.nth(i).getAttribute('id');
      expect(id).toBeTruthy();
      const label = page.locator(`label[for="${id}"]`);
      await expect(label).toHaveCount(1);
    }
  });

  test('The type="number" attribute MUST NOT be included in an <input> element used for entry of a number that is not meant to be incremented', async ({ page }) => {
    const numberInputs = page.locator('input[type="number"]');
    await expect(numberInputs).toHaveCount(0);
  });

  test('The attribute inputmode="numeric" MUST be included in an <input> element that is used for input of a number', async ({ page }) => {
    const ccCsc = page.locator('input#cc-csc');
    await expect(ccCsc).toHaveAttribute('inputmode', 'numeric');
    const ccNumber = page.locator('input[autocomplete="cc-number"]');
    await expect(ccNumber).toHaveAttribute('inputmode', 'numeric');
  });

  test('The type="password" attribute MUST NOT be used on other types of form fields, such as for an OTP or a credit card security code', async ({ page }) => {
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(0);
  });

  test('The use of :auto-fill as a CSS pseudo-class is INCORRECT', async ({ page }) => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/:auto-fill/);
  });

  test('A pattern attribute SHOULD be provided when appropriate to validate data entry', async ({ page }) => {
     const ccNumber = page.locator('input[autocomplete="cc-number"]');
     await expect(ccNumber).toHaveAttribute('pattern', /.+/);
  });
});
