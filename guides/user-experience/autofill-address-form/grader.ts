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
test.describe(`autofill-address-form Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Must use correct CSS pseudo-class :autofill without hyphen`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/:auto-fill/);
  });

  test(`Must not enforce Latin-only characters using restrictive patterns`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/pattern="\[a-zA-Z\]\+"/);
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
  test(`Inputs, selects, and textareas must be inside a form element`, async ({ page }) => {
    const inputsOutsideForm = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]), select, textarea'));
      return elements.filter(el => !el.closest('form')).length;
    });
    expect(inputsOutsideForm).toBe(0);
  });

  test(`Form controls must have valid autocomplete attributes`, async ({ page }) => {
    const invalidAutocompleteCount = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]), select, textarea'));
      return elements.filter(el => {
        const attr = el.getAttribute('autocomplete');
        return !attr || ['off', 'false', 'nope'].includes(attr);
      }).length;
    });
    expect(invalidAutocompleteCount).toBe(0);
  });

  test(`Form controls must have matching id and name attributes`, async ({ page }) => {
    const mismatchedCount = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]), select, textarea'));
      return elements.filter(el => !el.id || !(el as HTMLInputElement).name || el.id !== (el as HTMLInputElement).name).length;
    });
    expect(mismatchedCount).toBe(0);
  });

  test(`Form controls must be visually labeled using a label element`, async ({ page }) => {
    const unlabeledCount = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]), select, textarea'));
      return elements.filter(el => {
        const id = el.id;
        if (!id) return true;
        return !document.querySelector(`label[for="${id}"]`);
      }).length;
    });
    expect(unlabeledCount).toBe(0);
  });

  test(`The type="number" attribute MUST NOT be used for non-incrementing numbers`, async ({ page }) => {
    const numberInputsCount = await page.locator('input[type="number"]').count();
    expect(numberInputsCount).toBe(0);
  });

  test(`Name attributes MUST be unique`, async ({ page }) => {
    const duplicateNamesCount = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]), select, textarea'));
      const names = elements.map(el => (el as HTMLInputElement).name).filter(Boolean);
      return names.length - new Set(names).size;
    });
    expect(duplicateNamesCount).toBe(0);
  });

  test(`Address should use a single textarea, not multiple inputs`, async ({ page }) => {
    const addressInputsCount = await page.locator('input[id*="addr"], input[name*="addr"]').count();
    expect(addressInputsCount).toBe(0);
  });

  test(`Do not double-up form fields for email addresses`, async ({ page }) => {
    const emailInputsCount = await page.locator('input[id*="email"], input[name*="email"]').count();
    expect(emailInputsCount).toBeLessThanOrEqual(1);
  });

  test(`Email inputs must have correct type attribute`, async ({ page }) => {
    const incorrectEmailInputs = await page.evaluate(() => {
      const emailInputs = Array.from(document.querySelectorAll('input[name*="email"], input[id*="email"]'));
      return emailInputs.filter(el => el.getAttribute('type') !== 'email').length;
    });
    expect(incorrectEmailInputs).toBe(0);
  });
});
