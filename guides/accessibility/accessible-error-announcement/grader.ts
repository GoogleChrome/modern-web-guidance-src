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
test.describe(`Accessible Error Announcement Expectations: ${demoName}`, () => {

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

  test('The `aria-invalid` attribute is not present (or is set to `false`) on page load, even for required empty fields.', async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    const ariaInvalid = await input.getAttribute('aria-invalid');
    expect(['false', null]).toContain(ariaInvalid);
  });

  test('Tabbing through a field without typing does not trigger `aria-invalid="true"`.', async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    await input.focus();
    await input.blur();
    const ariaInvalid = await input.getAttribute('aria-invalid');
    expect(['false', null]).toContain(ariaInvalid);
  });

  test('Typing an invalid value and blurring sets `aria-invalid="true"`.', async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    await input.fill('bad-email');
    await input.blur();
    const ariaInvalid = await input.getAttribute('aria-invalid');
    expect(['true', '']).toContain(ariaInvalid);
  });

  test('Correcting the value to a valid format removes the `aria-invalid` attribute (or sets it to `false`) immediately on input.', async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    await input.fill('bad-email');
    await input.blur();
    
    // Evaluate the state before typing
    const stateBefore = await input.getAttribute('aria-invalid');
    
    // Type a valid email (triggers input event without blurring)
    await input.fill('test@example.com');
    
    // Evaluate the state after typing
    const stateAfter = await input.getAttribute('aria-invalid');
    
    // Assertion: It was invalid before, and is now removed or false
    expect(['true', '']).toContain(stateBefore);
    expect(['false', null, undefined]).toContain(stateAfter);
  });

  test(`Submitting a form with multiple invalid fields must synchronize aria-invalid on all of them`, async ({ page }) => {
    const email = page.locator('input[type="email"], input[name="email"], #email').first();
    const form = email.locator('xpath=ancestor::form[1]');

    // Ensure the form has at least two empty required inputs (eval tasks may only create an email input)
    // and strip novalidate so clicking submit runs native constraint validation.
    await form.evaluate((formEl: HTMLFormElement) => {
      formEl.removeAttribute('novalidate');
      const requiredInputs = formEl.querySelectorAll<HTMLInputElement>('input[required], textarea[required], select[required]');
      requiredInputs.forEach((inp) => { inp.value = ''; });
      if (requiredInputs.length < 2) {
        const extra = document.createElement('input');
        extra.type = 'text';
        extra.required = true;
        formEl.prepend(extra);
      }
    });

    const requiredFields = form.locator('input[required], textarea[required], select[required]');
    const count = await requiredFields.count();
    expect(count).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i++) {
      expect(['false', null]).toContain(await requiredFields.nth(i).getAttribute('aria-invalid'));
    }

    await form.locator('button[type="submit"], input[type="submit"], button:not([type])').first().click();

    for (let i = 0; i < count; i++) {
      await expect(requiredFields.nth(i)).toHaveAttribute('aria-invalid', 'true');
    }
  });

  test('The visual error message visibility matches the `aria-invalid` state.', async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    
    // Check initial state (valid / un-interacted)
    const initialMatches = await input.evaluate((el: HTMLInputElement) => {
      const errId = el.getAttribute('aria-errormessage') || el.getAttribute('aria-describedby');
      const errMsg = errId ? (document.getElementById(errId) || document.querySelector(`#${CSS.escape(errId)}`)) : el.parentElement?.querySelector('.error-message, .error-msg, [role="alert"]');
      if (!errMsg) return true;
      const style = window.getComputedStyle(errMsg);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && (errMsg.textContent ?? '').trim() !== '';
      const attr = el.getAttribute('aria-invalid');
      const ariaInvalid = attr === 'true' || attr === '';
      return ariaInvalid === isVisible;
    });
    expect(initialMatches).toBe(true);

    // Make the input invalid to test visibility synchronization
    await input.fill('bad-email');
    await input.blur();

    const matches = await input.evaluate((el: HTMLInputElement) => {
      const attr = el.getAttribute('aria-invalid');
      const ariaInvalid = attr === 'true' || attr === '';

      // Attempt to find the error message associated with this input
      let errMsg: HTMLElement | null = null;
      
      const errId = el.getAttribute('aria-errormessage') || el.getAttribute('aria-describedby');
      if (errId) {
        errMsg = (document.getElementById(errId) || document.querySelector(`#${CSS.escape(errId)}`)) as HTMLElement | null;
      }
      
      if (!errMsg) {
        // Fallback: look for an adjacent or sibling element with an error-related class
        const sibling = el.nextElementSibling as HTMLElement;
        if (sibling && (sibling.classList.contains('error-message') || sibling.classList.contains('error-msg') || sibling.getAttribute('role') === 'alert')) {
          errMsg = sibling;
        }
      }

      if (!errMsg) {
        // Fallback: look inside the parent container
        const parent = el.parentElement;
        if (parent) {
          errMsg = parent.querySelector('.error-message, .error-msg, [role="alert"]') as HTMLElement;
        }
      }

      if (!errMsg) {
        return false; // Cannot test if no error message is found
      }

      // Check if the error message is visibly rendered
      const style = window.getComputedStyle(errMsg);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && (errMsg.textContent ?? '').trim() !== '';

      return ariaInvalid === isVisible;
    });

    expect(matches).toBe(true);
  });

});
