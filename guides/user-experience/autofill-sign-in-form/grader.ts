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
test.describe(`autofill-sign-in-form Expectations: ${demoName}`, () => {
  // Static assertions
  test(`HTML must contain a <form> element`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasForm = /<form\b[^>]*>/i.test(html);
    expect(hasForm).toBe(true);
  });

  test(`HTML must contain <label> elements for form fields`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasLabel = /<label\b[^>]*>/i.test(html);
    expect(hasLabel).toBe(true);
  });

  test(`HTML must not use autocomplete="off"`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const usesAutocompleteOff = /autocomplete=["']off["']/i.test(html);
    expect(usesAutocompleteOff).toBe(false);
  });

  test(`HTML must use type="email"`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasTypeEmail = /type=["']email["']/i.test(html);
    expect(hasTypeEmail).toBe(true);
  });

  test(`HTML must use type="password"`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasTypePassword = /type=["']password["']/i.test(html);
    expect(hasTypePassword).toBe(true);
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
  test(`Inputs must be within a form element`, async ({ page }) => {
    const allInputsInForm = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      return inputs.every(input => input.closest('form') !== null);
    });
    expect(allInputsInForm).toBe(true);
  });

  test(`Inputs must have a valid autocomplete attribute`, async ({ page }) => {
    const allInputsHaveValidAutocomplete = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      return inputs.every(input => {
        const attr = input.getAttribute('autocomplete');
        return attr !== null && attr.trim() !== '' && attr.toLowerCase() !== 'off';
      });
    });
    expect(allInputsHaveValidAutocomplete).toBe(true);
  });

  test(`Email input must have type="email"`, async ({ page }) => {
    const emailInputIsCorrect = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const emailInputs = inputs.filter(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const text = label ? label.textContent : (input.previousElementSibling?.textContent || '');
        return text?.toLowerCase().includes('email');
      });
      if (emailInputs.length === 0) return false;
      return emailInputs.every(input => input.getAttribute('type') === 'email');
    });
    expect(emailInputIsCorrect).toBe(true);
  });

  test(`Password input must have type="password"`, async ({ page }) => {
    const passwordInputIsCorrect = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const passwordInputs = inputs.filter(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const text = label ? label.textContent : (input.previousElementSibling?.textContent || '');
        return text?.toLowerCase().includes('password');
      });
      if (passwordInputs.length === 0) return false;
      return passwordInputs.every(input => input.getAttribute('type') === 'password');
    });
    expect(passwordInputIsCorrect).toBe(true);
  });

  test(`Password input must have autocomplete="current-password"`, async ({ page }) => {
    const hasCurrentPasswordAutocomplete = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const passwordInputs = inputs.filter(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const text = label ? label.textContent : (input.previousElementSibling?.textContent || '');
        return text?.toLowerCase().includes('password');
      });
      if (passwordInputs.length === 0) return false;
      return passwordInputs.some(input => input.getAttribute('autocomplete') === 'current-password');
    });
    expect(hasCurrentPasswordAutocomplete).toBe(true);
  });

  test(`Password input must have id="current-password"`, async ({ page }) => {
    const hasCurrentPasswordId = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const passwordInputs = inputs.filter(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const text = label ? label.textContent : (input.previousElementSibling?.textContent || '');
        return text?.toLowerCase().includes('password');
      });
      if (passwordInputs.length === 0) return false;
      return passwordInputs.some(input => input.getAttribute('id') === 'current-password');
    });
    expect(hasCurrentPasswordId).toBe(true);
  });

  test(`Inputs must have an id attribute`, async ({ page }) => {
    const allInputsHaveId = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      return inputs.every(input => input.hasAttribute('id') && input.getAttribute('id') !== '');
    });
    expect(allInputsHaveId).toBe(true);
  });

  test(`Inputs must have a name attribute`, async ({ page }) => {
    const allInputsHaveName = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      return inputs.every(input => input.hasAttribute('name') && input.getAttribute('name') !== '');
    });
    expect(allInputsHaveName).toBe(true);
  });

  test(`Inputs must be visually labeled using a label element`, async ({ page }) => {
    const allInputsHaveLabel = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      return inputs.every(input => {
        if (input.closest('label')) return true;
        if (input.id && document.querySelector(`label[for="${input.id}"]`)) return true;
        return false;
      });
    });
    expect(allInputsHaveLabel).toBe(true);
  });

  test(`Inputs must have a required attribute`, async ({ page }) => {
    const allInputsAreRequired = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length === 0) return false;
      return inputs.every(input => input.hasAttribute('required'));
    });
    expect(allInputsAreRequired).toBe(true);
  });

  test(`Do not double-up form fields for email addresses`, async ({ page }) => {
    const hasSingleEmailField = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const emailInputs = inputs.filter(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const text = label ? label.textContent : (input.previousElementSibling?.textContent || '');
        return text?.toLowerCase().includes('email');
      });
      return emailInputs.length === 1;
    });
    expect(hasSingleEmailField).toBe(true);
  });

  test(`Do not double-up form fields for passwords`, async ({ page }) => {
    const hasSinglePasswordField = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const passwordInputs = inputs.filter(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const text = label ? label.textContent : (input.previousElementSibling?.textContent || '');
        return text?.toLowerCase().includes('password');
      });
      return passwordInputs.length === 1;
    });
    expect(hasSinglePasswordField).toBe(true);
  });

  test(`Email input must have an appropriate autocomplete attribute`, async ({ page }) => {
    const emailAutocompleteValid = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const emailInputs = inputs.filter(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const text = label ? label.textContent : (input.previousElementSibling?.textContent || '');
        return text?.toLowerCase().includes('email');
      });
      if (emailInputs.length === 0) return false;
      return emailInputs.every(input => {
        const ac = input.getAttribute('autocomplete');
        return ac === 'email' || ac === 'username';
      });
    });
    expect(emailAutocompleteValid).toBe(true);
  });

  test(`Password input MUST have an aria-describedby attribute`, async ({ page }) => {
    const hasAriaDescribedby = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const passwordInputs = inputs.filter(input => {
        const label = document.querySelector(`label[for="${input.id}"]`);
        const text = label ? label.textContent : (input.previousElementSibling?.textContent || '');
        return text?.toLowerCase().includes('password');
      });
      if (passwordInputs.length === 0) return false;
      return passwordInputs.some(input => input.hasAttribute('aria-describedby') && input.getAttribute('aria-describedby') !== '');
    });
    expect(hasAriaDescribedby).toBe(true);
  });
});
