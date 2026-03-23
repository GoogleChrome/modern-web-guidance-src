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

  test(`The use of :auto-fill as a CSS pseudo-class is INCORRECT`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/:auto-fill/);
  });

  test(`<input>, <select>, and <textarea> elements MUST be within a <form> element`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    if (html.includes('<input') || html.includes('<select') || html.includes('<textarea')) {
      expect(html).toMatch(/<form/);
    }
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

  test(`id and name attributes MUST be unique to each element`, async ({ page }) => {
    const result = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input, select, textarea'));
      const ids = elements.map(e => e.id).filter(Boolean);
      const names = elements.map(e => e.getAttribute('name')).filter(Boolean);

      const hasUniqueIds = new Set(ids).size === ids.length;
      const hasUniqueNames = new Set(names).size === names.length;
      return hasUniqueIds && hasUniqueNames;
    });
    expect(result).toBe(true);
  });

  test(`Every <input>, <select>, or <textarea> element in a form MUST be visually labeled using a <label> element`, async ({ page }) => {
    const allLabeled = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="hidden"]), select, textarea'));
      if (elements.length === 0) return true;
      return elements.every(e => {
        if (!e.id) return false;
        const label = document.querySelector(`label[for="${e.id}"]`);
        return label !== null;
      });
    });
    expect(allLabeled).toBe(true);
  });

  test(`The type="number" attribute MUST NOT be included in an <input> element used for entry of a number that is not meant to be incremented`, async ({ page }) => {
    const count = await page.locator('input[type="number"]').count();
    expect(count).toBe(0);
  });

  test(`DO NOT include a separate form field for the user's title`, async ({ page }) => {
    const titleInputs = await page.locator('input[name*="title" i], input[id*="title" i], input[autocomplete*="honorific" i]').count();
    expect(titleInputs).toBe(0);
  });

  test(`DO NOT enforce Latin-only characters for names`, async ({ page }) => {
    const nameInputs = page.locator('input[id*="name" i], input[name*="name" i], input[autocomplete*="name" i]');
    const count = await nameInputs.count();
    
    let allAcceptNonLatin = true;

    for (let i = 0; i < count; i++) {
      const input = nameInputs.nth(i);
      const pattern = await input.getAttribute('pattern');
      if (pattern) {
        const isValid = await input.evaluate((el: HTMLInputElement) => {
          // Temporarily set value to a non-Latin string and check if the pattern allows it
          const originalValue = el.value;
          el.value = 'José 李';
          const valid = el.checkValidity();
          el.value = originalValue; // Restore
          return valid;
        });
        if (!isValid) {
          allAcceptNonLatin = false;
        }
      }
    }
    
    expect(allAcceptNonLatin).toBe(true);
  });

  test(`A single <textarea> MUST be used for address entry`, async ({ page }) => {
    const textareas = await page.locator('textarea[name*="address" i], textarea[id*="address" i], textarea[autocomplete*="address" i]').count();
    const addressInputs = await page.locator('input[name*="addr" i], input[id*="addr" i]').count();
    const isValid = textareas > 0 && addressInputs === 0;
    expect(isValid).toBe(true);
  });

  test(`Entry of a postal code in an address form MUST be optional`, async ({ page }) => {
    const zipInputs = page.locator('input[name*="zip" i], input[id*="zip" i], input[name*="postal" i], input[id*="postal" i]');
    const count = await zipInputs.count();
    if (count > 0) {
      const isRequired = await zipInputs.first().evaluate((el: HTMLInputElement) => el.required);
      expect(isRequired).toBe(false);
    } else {
      expect(true).toBe(true);
    }
  });

  test(`Do not double-up form fields for passwords or email addresses`, async ({ page }) => {
    const emailInputs = await page.locator('input[name*="email" i], input[id*="email" i], input[type="email"]').count();
    expect(emailInputs).toBeLessThan(2);
  });

});
