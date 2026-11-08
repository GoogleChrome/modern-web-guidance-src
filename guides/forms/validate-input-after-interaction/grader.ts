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
test.describe(`Validate Input After Interaction Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath =
        requestPath === '/' || requestPath === `/${demoName}`
          ? filePath
          : path.join(targetDir, requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);

    // Disable transitions and animations to ensure instant E2E checks
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
  });

  test('Validation styling uses the :user-invalid pseudo-class rather than raw :invalid so required fields appear neutral on initial page load', async ({ page }) => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);
    expect(html).not.toMatch(/input:invalid\s*\{/);

    const input = page.locator('input[required]').first();
    expect(await input.count()).toBeGreaterThan(0);

    const initialState = await input.evaluate((el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      return {
        borderColor: style.borderColor,
        matchesUserInvalid: el.matches(':user-invalid'),
      };
    });

    expect(initialState.matchesUserInvalid).toBe(false);
    expect(initialState.borderColor).not.toBe('rgb(255, 0, 0)');
  });

  test('Focusing a required field without editing (or while actively typing before blur) does not trigger the error state prematurely; entering an invalid value and blurring triggers the :user-invalid error state', async ({ page }) => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);

    const input = page.locator('input[type="email"][required], input[required]').first();
    expect(await input.count()).toBeGreaterThan(0);

    const initialBorder = await input.evaluate((el) => window.getComputedStyle(el).borderColor);

    // Bare focus and blur without editing must NOT trigger :user-invalid or change border to error state
    await input.focus();
    await input.blur();
    const afterBareBlur = await input.evaluate((el) => ({
      borderColor: window.getComputedStyle(el).borderColor,
      matchesUserInvalid: el.matches(':user-invalid'),
    }));
    expect(afterBareBlur.matchesUserInvalid).toBe(false);
    expect(afterBareBlur.borderColor).toBe(initialBorder);

    // Typing an incomplete/invalid value before blurring must NOT trigger :user-invalid prematurely
    await input.focus();
    await page.keyboard.type('invalid');
    const whileTyping = await input.evaluate((el) => ({
      borderColor: window.getComputedStyle(el).borderColor,
      matchesUserInvalid: el.matches(':user-invalid'),
    }));
    expect(whileTyping.matchesUserInvalid).toBe(false);
    expect(whileTyping.borderColor).toBe(initialBorder);

    // Blurring with the invalid value committed MUST trigger :user-invalid and error border styling
    await input.blur();
    const afterInvalidBlur = await input.evaluate((el) => ({
      borderColor: window.getComputedStyle(el).borderColor,
      matchesUserInvalid: el.matches(':user-invalid'),
    }));
    expect(afterInvalidBlur.matchesUserInvalid).toBe(true);
    expect(afterInvalidBlur.borderColor).not.toBe(initialBorder);
  });

  test('Typing a valid value into a field that is in the :user-invalid error state clears the error state immediately', async ({ page }) => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);

    const input = page.locator('input[type="email"][required], input[required]').first();
    expect(await input.count()).toBeGreaterThan(0);

    // First trigger the :user-invalid error state
    await input.focus();
    await page.keyboard.type('invalid');
    await input.blur();

    const errorState = await input.evaluate((el) => ({
      borderColor: window.getComputedStyle(el).borderColor,
      matchesUserInvalid: el.matches(':user-invalid'),
    }));
    expect(errorState.matchesUserInvalid).toBe(true);

    // Now type a valid value and verify the error state clears immediately
    await input.focus();
    const inputType = await input.getAttribute('type');
    await input.fill(inputType === 'password' ? 'Valid#Pass1' : 'user@example.com');

    const validState = await input.evaluate((el) => ({
      borderColor: window.getComputedStyle(el).borderColor,
      matchesUserInvalid: el.matches(':user-invalid'),
    }));
    expect(validState.matchesUserInvalid).toBe(false);
    expect(validState.borderColor).not.toBe(errorState.borderColor);
  });

  test('Attempting to submit the form with an invalid or empty required field triggers the :user-invalid error state', async ({ page }) => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);

    const input = page.locator('input[required]').first();
    expect(await input.count()).toBeGreaterThan(0);

    const colorBefore = await input.evaluate((el) => window.getComputedStyle(el).borderColor);

    // Remove novalidate if present on demo form so native constraint validation triggers :user-invalid on submit
    await page.evaluate(() => {
      document.querySelectorAll('form[novalidate]').forEach((form) => form.removeAttribute('novalidate'));
    });

    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:not([type="button"])').first();
    expect(await submitBtn.count()).toBeGreaterThan(0);
    await submitBtn.click();

    const afterSubmit = await input.evaluate((el) => ({
      borderColor: window.getComputedStyle(el).borderColor,
      matchesUserInvalid: el.matches(':user-invalid'),
    }));
    expect(afterSubmit.matchesUserInvalid).toBe(true);
    expect(afterSubmit.borderColor).not.toBe(colorBefore);
  });

  test('Format hints or password complexity rules are positioned above their corresponding input element in the DOM and linked via aria-describedby', async ({ page }) => {
    const validHintLayout = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[aria-describedby]'));
      if (inputs.length === 0) return false;

      return inputs.every((input) => {
        const describedByIds = (input.getAttribute('aria-describedby') || '').trim().split(/\s+/).filter(Boolean);
        if (describedByIds.length === 0) return false;

        return describedByIds.some((id) => {
          const descEl = document.getElementById(id);
          if (!descEl) return false;
          // descEl must precede input in DOM order (DOCUMENT_POSITION_FOLLOWING = 4)
          return Boolean(descEl.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING);
        });
      });
    });

    expect(validHintLayout).toBe(true);
  });

  test('Visual error feedback displays an associated visible error message alongside input border styling rather than relying on color alone', async ({ page }) => {
    const input = page.locator('input[type="email"][required], input[required]').first();
    expect(await input.count()).toBeGreaterThan(0);

    const isErrorIndicatorVisible = async () =>
      await input.evaluate((el: HTMLElement) => {
        const isVisible = (node: Element | null) => {
          if (!node) return false;
          const s = window.getComputedStyle(node);
          return (
            s.display !== 'none' &&
            s.visibility !== 'hidden' &&
            s.opacity !== '0' &&
            (node.textContent || '').trim().length > 0
          );
        };

        const errId = el.getAttribute('aria-errormessage');
        if (errId) {
          const node = document.getElementById(errId);
          if (node) return isVisible(node);
        }

        const next = el.nextElementSibling;
        if (next && next.matches('.error-msg, .error-message, [role="alert"], [id*="error"]')) {
          return isVisible(next);
        }

        const container = el.parentElement;
        if (container) {
          const candidates = Array.from(
            container.querySelectorAll('.error-msg, .error-message, [role="alert"], [id*="error"]')
          );
          if (candidates.some(isVisible)) return true;
        }
        return false;
      });

    // Error message must be hidden on initial neutral load
    expect(await isErrorIndicatorVisible()).toBe(false);

    const initialStyle = await input.evaluate((el) => ({
      borderColor: window.getComputedStyle(el).borderColor,
      backgroundColor: window.getComputedStyle(el).backgroundColor,
    }));

    // Trigger :user-invalid state
    await input.focus();
    await page.keyboard.type('invalid');
    await input.blur();

    const errorStyle = await input.evaluate((el) => ({
      borderColor: window.getComputedStyle(el).borderColor,
      backgroundColor: window.getComputedStyle(el).backgroundColor,
    }));

    expect(errorStyle.borderColor).not.toBe(initialStyle.borderColor);
    expect(await isErrorIndicatorVisible()).toBe(true);
  });
});
