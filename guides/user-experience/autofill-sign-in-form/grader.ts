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
test.describe(`Sign-in form Expectations: ${demoName}`, () => {
  // Static assertions
  test('Static: The document MUST contain a <form> element', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(/<form\b[^>]*>/i.test(html)).toBe(true);
  });

  test('Static: The document MUST contain an input with type="email"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(/<input[^>]*type="email"[^>]*>/i.test(html)).toBe(true);
  }); e

  test('Static: The document MUST contain an input with type="password"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(/<input[^>]*type="password"[^>]*>/i.test(html)).toBe(true);
  });

  test('Static: The document MUST contain an input with autocomplete="current-password"', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(/<input[^>]*autocomplete="current-password"[^>]*>/i.test(html)).toBe(true);
  });

  test('Static: The document MUST contain a <label> element', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(/<label\b[^>]*>/i.test(html)).toBe(true);
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
  test('Browser: <input> elements MUST be within a <form> element', async ({ page }) => {
    const allInputs = await page.locator('input').count();
    const formInputs = await page.locator('form input').count();
    expect(allInputs > 0 && allInputs === formInputs).toBe(true);
  });

  test('Browser: Every <input> element MUST have an autocomplete attribute with a valid value', async ({ page }) => {
    const invalidAutocompleteInputs = await page.locator('input:not([autocomplete]), input[autocomplete="off"]').count();
    const allInputs = await page.locator('input').count();
    expect(allInputs > 0 && invalidAutocompleteInputs === 0).toBe(true);
  });

  test('Browser: Every <input> element MUST have an id attribute with a non-empty value', async ({ page }) => {
    const inputsWithoutId = await page.locator('input:not([id]), input[id=""]').count();
    const allInputs = await page.locator('input').count();
    expect(allInputs > 0 && inputsWithoutId === 0).toBe(true);
  });

  test('Browser: Every <input> element MUST have a name attribute with a non-empty value', async ({ page }) => {
    const inputsWithoutName = await page.locator('input:not([name]), input[name=""]').count();
    const allInputs = await page.locator('input').count();
    expect(allInputs > 0 && inputsWithoutName === 0).toBe(true);
  });

  test('Browser: id and name attributes MUST be unique to each element', async ({ page }) => {
    const uniqueIdsValid = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      const ids = inputs.map(i => i.id).filter(id => id);
      return ids.length === inputs.length && new Set(ids).size === inputs.length;
    });
    expect(uniqueIdsValid).toBe(true);
  });

  test('Browser: The value of the id and name attributes of a form element SHOULD be the same', async ({ page }) => {
    const idNameMatchValid = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      return inputs.every(i => i.id && i.name && i.id === i.name);
    });
    expect(idNameMatchValid).toBe(true);
  });

  test('Browser: Every <input> element MUST be visually labeled using a <label> element', async ({ page }) => {
    const labeledValid = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      const labels = Array.from(document.querySelectorAll('label'));
      return inputs.every(input => labels.some(label => label.htmlFor === input.id) || !!input.closest('label'));
    });
    expect(labeledValid).toBe(true);
  });

  test('Browser: Every <label> element MUST have a for attribute that matches the id attribute value of an input', async ({ page }) => {
    const labelsValid = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return false;
      return labels.every(label => label.htmlFor && document.getElementById(label.htmlFor));
    });
    expect(labelsValid).toBe(true);
  });

  test('Browser: An <input> element MUST have a required attribute', async ({ page }) => {
    const requiredInputsCount = await page.locator('input[required]').count();
    expect(requiredInputsCount).toBeGreaterThan(0);
  });

  test('Browser: autocomplete="current-password" and id="current-password" attributes MUST be provided in an <input> element', async ({ page }) => {
    const currentPasswordInputs = await page.locator('input#current-password[autocomplete="current-password"]').count();
    expect(currentPasswordInputs).toBe(1);
  });

  test('Browser: Do not double-up form fields for passwords or email addresses', async ({ page }) => {
    const inputCountValid = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const textInputs = inputs.filter(i => i.type === 'text' || i.type === 'email' || i.type === 'password');
      return textInputs.length > 0 && textInputs.length <= 2;
    });
    expect(inputCountValid).toBe(true);
  });
});
