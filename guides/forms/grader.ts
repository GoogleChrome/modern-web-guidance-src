/// <reference types="node" />
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

// Helper for error visibility
async function getVisibleErrors(page: any) {
  return await page.evaluate(() => {
    const isVisible = (el: Element) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
    };

    const errorElements = Array.from(document.querySelectorAll('*')).filter(el => {
      if (!isVisible(el)) return false;
      // innerText only includes visible text
      const text = (el as HTMLElement).innerText || '';
      return /invalid|error|please|match/i.test(text) && text.length < 100;
    });
    return errorElements.map(el => el.tagName + (el.id ? '#' + el.id : '') + ': ' + (el as HTMLElement).innerText);
  });
}

// Tests
test.describe(`Forms Skill Expectations: ${demoName}`, () => {

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

  test('every form control has an associated <label> using for and id attributes', async ({ page }) => {
    const controls = await page.evaluate(() => {
      const results = [];
      const inputs = document.querySelectorAll('input, select, textarea');
      for (const input of inputs) {
        if ((input as HTMLInputElement).type === 'hidden') continue;
        const id = input.id;
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;
        results.push({ id, hasLabel: !!label });
      }
      return results;
    });

    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.hasLabel, `Control with id "${control.id}" should have an associated <label>`).toBe(true);
    }
  });

  test('autocomplete attributes are specified for sensitive or standard data fields (e.g., email)', async ({ page }) => {
    const sensitiveInputs = await page.evaluate(() => {
      const results = [];
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        const type = input.type.toLowerCase();
        const name = (input.getAttribute('name') || '').toLowerCase();
        const id = (input.getAttribute('id') || '').toLowerCase();
        const autocomplete = input.getAttribute('autocomplete');

        if (type === 'email' || type === 'password' || name.includes('email') || id.includes('email') || name.includes('password') || id.includes('password') || name.includes('user') || id.includes('user')) {
          results.push({ id: input.id, autocomplete });
        }
      }
      return results;
    });

    expect(sensitiveInputs.length).toBeGreaterThan(0);
    for (const input of sensitiveInputs) {
      expect(input.autocomplete, `Input "${input.id}" should have a valid autocomplete attribute`).not.toBeNull();
      expect(input.autocomplete, `Input "${input.id}" should have a non-empty autocomplete attribute`).not.toBe('');
    }
  });

  test('fields requiring numeric input use inputmode="numeric"', async ({ page }) => {
    const numericInputs = await page.evaluate(() => {
      const results = [];
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        const name = (input.getAttribute('name') || '').toLowerCase();
        const id = (input.getAttribute('id') || '').toLowerCase();
        const inputmode = input.getAttribute('inputmode');

        if (name.includes('pin') || id.includes('pin') || name.includes('zip') || id.includes('zip') || name.includes('code') || id.includes('code')) {
          results.push({ id: input.id, inputmode });
        }
      }
      return results;
    });

    // Only run expectations if there are numeric inputs requested or found
    if (numericInputs.length > 0) {
      for (const input of numericInputs) {
        expect(input.inputmode, `Numeric field "${input.id}" should have inputmode="numeric"`).toBe('numeric');
      }
    }
  });

  test('form validation errors are NOT displayed while the user is actively typing in a field (on input)', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[id*="email"]').first();
    await emailInput.fill('invalid-email');
    
    const errors = await getVisibleErrors(page);
    expect(errors.length, `Validation error should not be visible while typing. Found: ${errors.join(', ')}`).toBe(0);
  });

  test('form validation errors are displayed after the user leaves the field (on blur or focusout)', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[id*="email"]').first();
    await emailInput.focus();
    await emailInput.fill('invalid-email');
    
    const errorsBeforeBlur = await getVisibleErrors(page);
    expect(errorsBeforeBlur.length, `Validation error should NOT be visible before blur.`).toBe(0);

    await emailInput.blur();

    const errorsAfterBlur = await getVisibleErrors(page);
    expect(errorsAfterBlur.length, 'Validation error SHOULD be visible after blur').toBeGreaterThan(0);
  });

  test('pressing the submit button triggers validation and blocks submission if any field is invalid', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[id*="email"]').first();
    await emailInput.fill('invalid-email');
    
    const submitBtn = page.locator('button[type="submit"], button#submit-btn').first();
    
    // Check if button is enabled
    await expect(submitBtn, 'Submit button should be enabled to allow triggering validation').toBeEnabled();

    // Track if form was submitted
    let formSubmitted = false;
    page.on('dialog', async dialog => {
      if (dialog.message().includes('submitted')) {
        formSubmitted = true;
      }
      await dialog.dismiss();
    });

    const currentUrl = page.url();
    await submitBtn.click();
    await page.waitForTimeout(500);

    expect(formSubmitted, 'Form should not be submitted if fields are invalid').toBe(false);
    expect(page.url(), 'Form should not navigate if fields are invalid').toBe(currentUrl);

    const errorsAfterSubmit = await getVisibleErrors(page);
    expect(errorsAfterSubmit.length, 'Validation errors should be visible after failed submit attempt').toBeGreaterThan(0);
  });

  test('the submit button is disabled after a valid submission to prevent double posts', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[id*="email"]').first();
    await emailInput.fill('test@example.com');
    
    const nameInput = page.locator('input[id*="name"], input[name*="name"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('John Doe');
    }

    const messageInput = page.locator('textarea[id*="message"], textarea[name*="message"]').first();
    if (await messageInput.count() > 0) {
      await messageInput.fill('This is a test message.');
    }

    const pinInput = page.locator('input[id*="pin"], input[name*="pin"]').first();
    if (await pinInput.count() > 0) {
      await pinInput.fill('1234');
    }

    const submitBtn = page.locator('button[type="submit"], button#submit-btn').first();
    await expect(submitBtn).toBeEnabled();

    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });

    await submitBtn.click();
    
    // Button should be disabled
    await expect(submitBtn).toBeDisabled();
  });

  test('all interactive tap targets (inputs, buttons) are at least 48px in height/width', async ({ page }) => {
    const targets = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input:not([type="hidden"]), button, select, textarea'));
      return elements.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          id: el.id,
          width: rect.width,
          height: rect.height
        };
      });
    });

    for (const target of targets) {
      expect(target.width, `Target ${target.tag}#${target.id} should have width >= 48px`).toBeGreaterThanOrEqual(48);
      expect(target.height, `Target ${target.tag}#${target.id} should have height >= 48px`).toBeGreaterThanOrEqual(48);
    }
  });

  test('font size for inputs is at least 16px (1rem) to prevent automatic iOS zoom on focus', async ({ page }) => {
    const inputFontSizes = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
      return inputs.map(el => {
        const style = window.getComputedStyle(el);
        return {
          id: el.id,
          fontSize: parseFloat(style.fontSize)
        };
      });
    });

    for (const input of inputFontSizes) {
      expect(input.fontSize, `Input #${input.id} should have font-size >= 16px`).toBeGreaterThanOrEqual(16);
    }
  });

});
