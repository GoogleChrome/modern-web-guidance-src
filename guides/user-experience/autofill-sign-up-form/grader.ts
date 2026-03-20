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
test.describe(`autofill-sign-up-form Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Static: File MUST contain a <form> element`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html.includes('<form')).toBe(true);
  });

  test(`Static: Ask for personal names with a single <input> (do not assume first/last name)`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasMultipleNameFields = html.includes('name="fn"') || html.includes('name="ln"');
    expect(hasMultipleNameFields).toBe(false);
  });

  test(`Static: DO NOT include a separate form field for the user's title`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasTitleField = html.toLowerCase().includes('name="usr_title"');
    expect(hasTitleField).toBe(false);
  });

  test(`Static: type="number" MUST NOT be used for postal codes or other non-incremented numbers`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasNumberType = html.includes('type="number"');
    expect(hasNumberType).toBe(false);
  });

  test(`Static: Must not prevent default behavior for "paste" events on passwords`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const preventsPaste = html.includes(`addEventListener('paste'`) && html.includes('preventDefault()');
    expect(preventsPaste).toBe(false);
  });

  test(`Static: DO NOT enforce Latin-only characters for names and usernames`, () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const enforcesLatinOnly = html.includes('^[A-Za-z0-9]+$');
    expect(enforcesLatinOnly).toBe(false);
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
  test(`Browser: Every <input> element MUST be within a <form> element`, async ({ page }) => {
    const inputsOutsideForm = await page.locator('input:not(form input)').count();
    expect(inputsOutsideForm).toBe(0);
  });

  test(`Browser: Inputs MUST have an autocomplete attribute that is not "off"`, async ({ page }) => {
    const inputsWithOffOrMissing = await page.locator('input:not([autocomplete]), input[autocomplete="off"]').count();
    expect(inputsWithOffOrMissing).toBe(0);
  });

  test(`Browser: Every input MUST have a corresponding <label> with a matching "for" attribute`, async ({ page }) => {
    const inputsWithoutMatchingLabel = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).filter(input => {
        const id = input.id;
        return !id || !document.querySelector(`label[for="${id}"]`);
      }).length;
    });
    expect(inputsWithoutMatchingLabel).toBe(0);
  });

  test(`Browser: Email inputs MUST include the attribute type="email"`, async ({ page }) => {
    const invalidEmailInputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).filter(input => {
        const name = input.name.toLowerCase();
        const id = input.id.toLowerCase();
        const isEmail = name.includes('email') || name.includes('eml') || id.includes('email') || id.includes('eml') || input.previousElementSibling?.textContent?.toLowerCase().includes('email');
        return isEmail && input.type !== 'email';
      }).length;
    });
    expect(invalidEmailInputs).toBe(0);
  });

  test(`Browser: The value of the id and name attributes of a form element SHOULD be the same`, async ({ page }) => {
    const differingIdName = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).filter(i => i.id !== i.name).length;
    });
    expect(differingIdName).toBe(0);
  });

  test(`Browser: Password inputs MUST have aria-describedby attributes`, async ({ page }) => {
    const pwdWithoutAria = await page.locator('input[type="password"]:not([aria-describedby])').count();
    expect(pwdWithoutAria).toBe(0);
  });

  test(`Browser: Password input MUST have autocomplete="new-password"`, async ({ page }) => {
    const pwdWithoutAutocomplete = await page.locator('input[type="password"]:not([autocomplete="new-password"])').count();
    expect(pwdWithoutAutocomplete).toBe(0);
  });

  test(`Browser: Do not double-up form fields for passwords or email addresses`, async ({ page }) => {
    const hasDoubledUpFields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const passwords = inputs.filter(i => i.type === 'password' || i.name.includes('pwd')).length;
      const emails = inputs.filter(i => i.type === 'email' || i.name.includes('eml') || i.name.includes('email')).length;
      return passwords > 1 || emails > 1;
    });
    expect(hasDoubledUpFields).toBe(false);
  });

  test(`Browser: Inputs MUST have a required attribute if mandatory`, async ({ page }) => {
    const inputsWithoutRequired = await page.locator('input:not([required])').count();
    expect(inputsWithoutRequired).toBe(0);
  });
});
