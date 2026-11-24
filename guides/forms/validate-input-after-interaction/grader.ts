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

  test("When a value doesn't meet a field's requirements, visible error text says so", async ({ page }) => {
    const fields = page.locator('input[required]:not([type="checkbox"]):not([type="radio"])');
    const count = await fields.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const field = fields.nth(i);
      const getVisibleErrorText = () =>
        field.evaluate((el) => {
          const errId = el.getAttribute('data-error');
          const container = el.closest('.form-group, .field') || el.parentElement || document.body;
          const candidates = errId
            ? [document.getElementById(errId)].filter((n): n is HTMLElement => Boolean(n))
            : Array.from(container.querySelectorAll('.error-msg, .error-message, [role="alert"], [id*="error"]'));
          const visible = candidates.find((node) => node.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
          if (!visible) return '';
          const clone = visible.cloneNode(true) as Element;
          clone.querySelectorAll('[role="img"], [aria-hidden="true"]').forEach((n) => n.remove());
          return (clone.textContent || '').replace(/\s+/g, ' ').trim();
        });

      expect(await getVisibleErrorText()).toBe('');

      await field.focus();
      await field.fill('invalid');
      await field.blur();

      await expect.poll(getVisibleErrorText, { timeout: 1000 }).not.toBe('');
    }
  });

  test('A field has aria-invalid="true" while its error state is shown, and doesn\'t have aria-invalid="true" before the error appears or after it clears', async ({ page }) => {
    const fields = page.locator('input[required]:not([type="checkbox"]):not([type="radio"])');
    const count = await fields.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const field = fields.nth(i);
      expect(await field.getAttribute('aria-invalid')).not.toBe('true');

      await field.focus();
      await field.fill('invalid');
      await field.blur();
      await expect(field).toHaveAttribute('aria-invalid', 'true');

      const inputType = await field.getAttribute('type');
      await field.fill(inputType === 'password' ? 'Valid#Pass1' : 'user@example.com');
      await expect.poll(() => field.getAttribute('aria-invalid')).not.toBe('true');
    }
  });

  test('After the form is submitted with an invalid field, focus is on the first invalid field', async ({ page }) => {
    const fields = page.locator('input[required]:not([type="checkbox"]):not([type="radio"])');
    const count = await fields.count();
    expect(count).toBeGreaterThan(0);

    const getFieldValidationState = (fieldLocator: ReturnType<typeof page.locator>) =>
      fieldLocator.evaluate((el) => {
        const errId = el.getAttribute('data-error');
        const container = el.closest('.form-group, .field') || el.parentElement || document.body;
        const candidates = errId
          ? [document.getElementById(errId)].filter((n): n is HTMLElement => Boolean(n))
          : Array.from(container.querySelectorAll('.error-msg, .error-message, [role="alert"], [id*="error"]'));
        const hasVisibleErrorText = candidates.some((node) => {
          if (!node.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
          const clone = node.cloneNode(true) as Element;
          clone.querySelectorAll('[role="img"], [aria-hidden="true"]').forEach((n) => n.remove());
          return (clone.textContent || '').replace(/\s+/g, ' ').trim().length > 0;
        });
        return {
          ariaInvalid: el.getAttribute('aria-invalid'),
          matchesUserInvalid: el.matches(':user-invalid'),
          hasVisibleErrorText,
        };
      });

    // Pair with initial-load check so broken eager-invalid forms fail
    for (let i = 0; i < count; i++) {
      const initialState = await getFieldValidationState(fields.nth(i));
      expect(initialState.ariaInvalid).not.toBe('true');
      expect(initialState.matchesUserInvalid).toBe(false);
      expect(initialState.hasVisibleErrorText).toBe(false);
    }

    const emailField = page.locator('input[type="email"][required], input[required]').first();
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:not([type="button"])').first();
    expect(await submitBtn.count()).toBeGreaterThan(0);
    await submitBtn.click();

    await expect(emailField).toBeFocused();
    await expect.poll(() => getFieldValidationState(emailField)).toEqual({
      ariaInvalid: 'true',
      matchesUserInvalid: true,
      hasVisibleErrorText: true,
    });

    // When the first field is valid and a subsequent field is invalid, focus moves to that first invalid field
    if (count > 1) {
      const firstType = await fields.nth(0).getAttribute('type');
      await fields.nth(0).fill(firstType === 'password' ? 'Valid#Pass1' : 'user@example.com');
      await submitBtn.click();
      await expect(fields.nth(1)).toBeFocused();
      await expect.poll(() => getFieldValidationState(fields.nth(1))).toEqual({
        ariaInvalid: 'true',
        matchesUserInvalid: true,
        hasVisibleErrorText: true,
      });
    }
  });

  test('While a field has aria-invalid="true", its accessible description includes its visible error text', async ({ page }) => {
    const fields = page.locator('input[required]:not([type="checkbox"]):not([type="radio"])');
    const count = await fields.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const field = fields.nth(i);
      await field.focus();
      await field.fill('invalid');
      await field.blur();

      await expect(field).toHaveAttribute('aria-invalid', 'true');

      const visibleErrorText = await field.evaluate((el) => {
        const errId = el.getAttribute('data-error');
        const container = el.closest('.form-group, .field') || el.parentElement || document.body;
        const candidates = errId
          ? [document.getElementById(errId)].filter((n): n is HTMLElement => Boolean(n))
          : Array.from(container.querySelectorAll('.error-msg, .error-message, [role="alert"], [id*="error"]'));
        const visible = candidates.find((node) => node.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
        if (!visible) return '';
        const clone = visible.cloneNode(true) as Element;
        clone.querySelectorAll('[role="img"], [aria-hidden="true"]').forEach((n) => n.remove());
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
      });
      expect(visibleErrorText.length).toBeGreaterThan(0);

      const escaped = visibleErrorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(field).toHaveAccessibleDescription(new RegExp(escaped));
    }
  });

  test("On page load, no field's accessible description includes its error text", async ({ page }) => {
    const fields = page.locator('input[required]:not([type="checkbox"]):not([type="radio"])');
    const count = await fields.count();
    expect(count).toBeGreaterThan(0);

    // Trigger validation first to collect each field's error copy and verify linkage when invalid
    const fieldErrorTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      const field = fields.nth(i);
      await field.focus();
      await field.fill('invalid');
      await field.blur();

      const errorText = await field.evaluate((el) => {
        const errId = el.getAttribute('data-error');
        const container = el.closest('.form-group, .field') || el.parentElement || document.body;
        const candidates = errId
          ? [document.getElementById(errId)].filter((n): n is HTMLElement => Boolean(n))
          : Array.from(container.querySelectorAll('.error-msg, .error-message, [role="alert"], [id*="error"]'));
        const errEl = candidates.find((node) => node.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
        if (!errEl) return '';
        const clone = errEl.cloneNode(true) as Element;
        clone.querySelectorAll('[role="img"], [aria-hidden="true"]').forEach((n) => n.remove());
        return (clone.textContent || '').replace(/\s+/g, ' ').trim();
      });
      expect(errorText.length).toBeGreaterThan(0);
      fieldErrorTexts.push(errorText);

      const escaped = errorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(field).toHaveAccessibleDescription(new RegExp(escaped));
    }

    // Reload and verify that on initial page load no field's accessible description includes its error text
    await page.reload();
    const reloadedFields = page.locator('input[required]:not([type="checkbox"]):not([type="radio"])');
    for (let i = 0; i < count; i++) {
      const escaped = fieldErrorTexts[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(reloadedFields.nth(i)).not.toHaveAccessibleDescription(new RegExp(escaped));
    }
  });
});
