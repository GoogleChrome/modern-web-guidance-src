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

  test(`The aria-invalid attribute must NOT be present (or set to false) on page load`, async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    const ariaInvalid = await input.getAttribute('aria-invalid');
    expect(['false', null]).toContain(ariaInvalid);
  });

  test(`Tabbing through a field without typing should NOT trigger aria-invalid="true"`, async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    await input.focus();
    await input.blur();
    const ariaInvalid = await input.getAttribute('aria-invalid');
    expect(['false', null]).toContain(ariaInvalid);
  });

  test(`Typing an invalid value and blurring MUST set aria-invalid="true"`, async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    await input.fill('bad-email');
    await input.blur();
    const ariaInvalid = await input.getAttribute('aria-invalid');
    expect(ariaInvalid === 'true' || ariaInvalid === '').toBe(true);
  });

  test(`Correcting the value to a valid format MUST remove the aria-invalid attribute immediately on input`, async ({ page }) => {
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
    const isBeforeInvalid = stateBefore === 'true' || stateBefore === '';
    const isAfterValid = stateAfter === 'false' || stateAfter === null || stateAfter === undefined;
    expect(isBeforeInvalid && isAfterValid).toBe(true);
  });

  test(`The visual error message visibility must match the aria-invalid state`, async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    
    // Make the input invalid to test visibility synchronization
    await input.fill('bad-email');
    await input.blur();

    const matches = await input.evaluate((el: HTMLInputElement) => {
      const attr = el.getAttribute('aria-invalid');
      const ariaInvalid = attr === 'true' || attr === '';

      // Attempt to find the error message associated with this input
      let errMsg: HTMLElement | null = null;
      
      const errId = el.getAttribute('aria-errormessage');
      if (errId) {
        errMsg = document.getElementById(errId);
      }
      
      if (!errMsg) {
        // Fallback: look for an adjacent or sibling element with an error-related class
        const sibling = el.nextElementSibling as HTMLElement;
        if (sibling && (sibling.classList.contains('error-message') || sibling.classList.contains('error-msg'))) {
          errMsg = sibling;
        }
      }

      if (!errMsg) {
        // Fallback: look inside the parent container
        const parent = el.parentElement;
        if (parent) {
          errMsg = parent.querySelector('.error-message, .error-msg') as HTMLElement;
        }
      }

      if (!errMsg) {
        return false; // Cannot test if no error message is found
      }

      // Check if the error message is visibly rendered
      const style = window.getComputedStyle(errMsg);
      const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

      return ariaInvalid === isVisible;
    });

    expect(matches).toBe(true);
  });

});
