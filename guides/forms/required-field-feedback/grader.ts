import { test, expect, type Locator } from '@playwright/test';
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

interface InputStyleSnapshot {
  border: string;
  borderLeft: string;
  background: string;
  outline: string;
  boxShadow: string;
  hasUserInvalid: boolean;
}

// Tests
test.describe(`Required Field Feedback Expectations: ${demoName}`, () => {
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

    // Disable transitions and animations to ensure instant E2E style checks
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
  });

  async function getStyling(input: Locator): Promise<InputStyleSnapshot> {
    return await input.evaluate((el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      const hasUserInvalid =
        el.matches(':user-invalid') ||
        el.classList.contains('user-invalid') ||
        el.classList.contains('user-invalid-fallback');
      return {
        border: style.borderColor,
        borderLeft: style.borderLeftColor,
        background: style.backgroundColor,
        outline: style.outlineColor,
        boxShadow: style.boxShadow,
        hasUserInvalid,
      };
    });
  }

  function differs(s1: InputStyleSnapshot, s2: InputStyleSnapshot): boolean {
    return (
      s1.hasUserInvalid !== s2.hasUserInvalid ||
      s1.border !== s2.border ||
      s1.borderLeft !== s2.borderLeft ||
      s1.background !== s2.background ||
      s1.outline !== s2.outline ||
      s1.boxShadow !== s2.boxShadow
    );
  }

  test('On page load, all required fields appear neutral and do not match :user-invalid', async ({ page }) => {
    const inputs = page.locator('form input[required]');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const style = await getStyling(input);
      expect(style.hasUserInvalid).toBe(false);
      const ariaInvalid = await input.getAttribute('aria-invalid');
      expect(ariaInvalid).not.toBe('true');
    }
  });

  test('Focusing and blurring an empty required field without typing keeps the field in a neutral state, while interacting with the field (such as typing and clearing it) and blurring triggers the :user-invalid error state', async ({ page }) => {
    const input = page.locator('form input[required]').first();
    expect(await input.count()).toBeGreaterThan(0);
    const initialStyle = await getStyling(input);

    // Bare focus and blur without modifying the value must keep the field neutral
    await input.focus();
    await input.blur();
    const afterBareBlurStyle = await getStyling(input);
    expect(afterBareBlurStyle.hasUserInvalid).toBe(false);
    expect(differs(initialStyle, afterBareBlurStyle)).toBe(false);

    // Interacting with the field (typing and deleting) and blurring must trigger the error state
    await input.focus();
    await page.keyboard.press('a');
    await page.keyboard.press('Backspace');
    await input.blur();

    const errorStyle = await getStyling(input);
    expect(errorStyle.hasUserInvalid).toBe(true);
    expect(differs(initialStyle, errorStyle)).toBe(true);
  });

  test('Typing a valid value into an invalid required field removes the error state immediately', async ({ page }) => {
    const input = page.locator('form input[required]').first();
    expect(await input.count()).toBeGreaterThan(0);
    const initialStyle = await getStyling(input);

    await input.focus();
    await page.keyboard.press('a');
    await page.keyboard.press('Backspace');
    await input.blur();

    const errorStyle = await getStyling(input);
    expect(errorStyle.hasUserInvalid).toBe(true);
    expect(differs(initialStyle, errorStyle)).toBe(true);

    await input.focus();
    const inputType = await input.getAttribute('type');
    const validVal = inputType === 'email' ? 'test@example.com' : 'valid';
    await page.keyboard.type(validVal);

    const finalStyle = await getStyling(input);
    expect(finalStyle.hasUserInvalid).toBe(false);
    expect(differs(errorStyle, finalStyle)).toBe(true);
  });

  test('Attempting to submit the form with empty required fields triggers the error state on all of them', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    expect(await submitBtn.count()).toBeGreaterThan(0);
    expect(await submitBtn.isEnabled()).toBe(true);

    // Strip novalidate attribute prior to submit so that the browser natively triggers the :user-invalid state
    await page.evaluate(() => {
      document.querySelectorAll('form[novalidate]').forEach((form) => form.removeAttribute('novalidate'));
    });

    const inputs = page.locator('form input[required]');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);

    const initialStyles: InputStyleSnapshot[] = [];
    for (let i = 0; i < count; i++) {
      initialStyles.push(await getStyling(inputs.nth(i)));
    }

    await submitBtn.click();

    for (let i = 0; i < count; i++) {
      const finalStyle = await getStyling(inputs.nth(i));
      expect(finalStyle.hasUserInvalid).toBe(true);
      expect(differs(initialStyles[i], finalStyle)).toBe(true);
    }
  });

  test('The aria-invalid="true" attribute is dynamically synchronized via JavaScript when a required field enters an error state and removed or set to "false" when the field becomes valid', async ({ page }) => {
    const input = page.locator('form input[required]').first();
    expect(await input.count()).toBeGreaterThan(0);

    expect(await input.getAttribute('aria-invalid')).not.toBe('true');

    // Bare focus + blur without typing must not mark aria-invalid="true"
    await input.focus();
    await input.blur();
    expect(await input.getAttribute('aria-invalid')).not.toBe('true');

    // Typing, clearing, and blurring must synchronize aria-invalid="true"
    await input.focus();
    await page.keyboard.press('a');
    await page.keyboard.press('Backspace');
    await input.blur();
    expect(await input.getAttribute('aria-invalid')).toBe('true');

    // Typing a valid value must clear aria-invalid="true"
    await input.focus();
    const inputType = await input.getAttribute('type');
    const validVal = inputType === 'email' ? 'test@example.com' : 'valid';
    await page.keyboard.type(validVal);
    expect(await input.getAttribute('aria-invalid')).not.toBe('true');
  });

  test('Visual error feedback incorporates multiple state indicators (such as an error message or icon alongside border styling) rather than relying on color alone', async ({ page }) => {
    const input = page.locator('form input[required]').first();
    expect(await input.count()).toBeGreaterThan(0);
    const initialStyle = await getStyling(input);

    await input.focus();
    await page.keyboard.press('a');
    await page.keyboard.press('Backspace');
    await input.blur();

    const errorStyle = await getStyling(input);
    const hasInputStyleChange = differs(initialStyle, errorStyle) && errorStyle.hasUserInvalid;

    const hasVisibleErrorMsg = await input.evaluate((el: HTMLElement) => {
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

      const errId = el.getAttribute('aria-errormessage') || el.getAttribute('aria-describedby');
      if (errId && isVisible(document.getElementById(errId))) return true;

      const next = el.nextElementSibling;
      if (next && next.matches('.error-msg, .error-message, [role="alert"], [id*="error"]')) {
        return isVisible(next);
      }

      const container = el.parentElement || el.closest('form');
      if (container) {
        const candidates = Array.from(
          container.querySelectorAll('.error-msg, [class*="error"], [role="alert"], [id*="error"]')
        );
        if (candidates.some(isVisible)) return true;
      }
      return false;
    });

    expect(hasInputStyleChange && hasVisibleErrorMsg).toBe(true);
  });
});
