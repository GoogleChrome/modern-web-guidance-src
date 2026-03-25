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

test.describe(`autofill-sign-up-form Expectations: ${demoName}`, () => {

  // Static assertions
  test('DO NOT enforce Latin-only characters using JS regex', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html.includes('A-Za-z')).toBe(false);
  });

  test('Allow password pasting by not preventing paste events in JS', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html.includes('paste')).toBe(false);
  });

  test('DO NOT include a separate form field for the users title', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html.includes('usr_title')).toBe(false);
  });

  test('Do not double-up form fields for email addresses (confirm email)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html.includes('eml_conf')).toBe(false);
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' || requestPath === `/${demoName}` ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  // Browser assertions
  test('Elements MUST be within a <form> element', async ({ page }) => {
    const formCount = await page.locator('form').count();
    expect(formCount).toBeGreaterThan(0);
  });

  test('Form must have a native submit button', async ({ page }) => {
    const submitButtonCount = await page.locator('button, input[type="submit"]').count();
    expect(submitButtonCount).toBeGreaterThan(0);
  });

  test('Every <input> element MUST have an autocomplete attribute with a valid value', async ({ page }) => {
    const invalidAutocompleteCount = await page.locator('input:not([autocomplete]), input[autocomplete="off"]').count();
    expect(invalidAutocompleteCount).toBe(0);
  });

  test('An <input> element used for entry of a username must have autocomplete="username"', async ({ page }) => {
    const usernameCount = await page.locator('input[autocomplete="username"]').count();
    expect(usernameCount).toBeGreaterThan(0);
  });

  test('An <input> element used for entry of a personal name must have autocomplete="name"', async ({ page }) => {
    const nameCount = await page.locator('input[autocomplete="name"]').count();
    expect(nameCount).toBeGreaterThan(0);
  });

  test('An <input> element used for entry of an email address MUST include the attribute type="email"', async ({ page }) => {
    const emailTypeCount = await page.locator('input[type="email"]').count();
    expect(emailTypeCount).toBeGreaterThan(0);
  });

  test('The value of the id and name attributes of a form element SHOULD be the same', async ({ page }) => {
    const mismatchedCount = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.filter(el => el.id !== el.name).length;
    });
    expect(mismatchedCount).toBe(0);
  });

  test('A pattern attribute SHOULD be provided when appropriate to validate data entry', async ({ page }) => {
    const patternCount = await page.locator('input[pattern]').count();
    expect(patternCount).toBeGreaterThan(0);
  });

  test('Every <input> element MUST be visually labeled using a <label> element', async ({ page }) => {
    const labelCount = await page.locator('label').count();
    expect(labelCount).toBeGreaterThan(0);
  });

  test('Every <label> element MUST have a valid for attribute', async ({ page }) => {
    const invalidLabels = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return 1;
      return labels.filter(label => {
        const htmlFor = label.getAttribute('for');
        if (!htmlFor) return true;
        const el = document.getElementById(htmlFor);
        return !el;
      }).length;
    });
    expect(invalidLabels).toBe(0);
  });

  test('The type="number" attribute MUST NOT be included in an <input> element used for a number not meant to be incremented', async ({ page }) => {
    const numberTypeCount = await page.locator('input[type="number"]').count();
    expect(numberTypeCount).toBe(0);
  });

  test('Do not double-up form fields for passwords', async ({ page }) => {
    const passwordCount = await page.locator('input[type="password"]').count();
    expect(passwordCount).toBeLessThan(2);
  });

  test('An <input> element MUST have a required attribute if it is mandatory', async ({ page }) => {
    const requiredCount = await page.locator('input[required]').count();
    expect(requiredCount).toBeGreaterThan(0);
  });

  test('An <input> element used for password entry MUST have aria-describedby attributes', async ({ page }) => {
    const ariaCount = await page.locator('input[aria-describedby]').count();
    expect(ariaCount).toBeGreaterThan(0);
  });

  test('autocomplete="new-password" MUST be included in an <input> element used for entry of a new password', async ({ page }) => {
    const newPasswordCount = await page.locator('input[autocomplete="new-password"]').count();
    expect(newPasswordCount).toBeGreaterThan(0);
  });

});
