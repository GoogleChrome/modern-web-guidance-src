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

  test('The `aria-invalid` attribute is set to `false` on page load, even for required empty fields.', async ({ page }) => {
    const requiredFields = page.locator('form input[required], form textarea[required], form select[required]');
    const reqCount = await requiredFields.count();
    expect(reqCount).toBeGreaterThan(0);
    for (let i = 0; i < reqCount; i++) {
      await expect(requiredFields.nth(i)).toHaveAttribute('aria-invalid', 'false');
    }
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

  test('While a field has aria-invalid="true", its accessible description includes its visible error text.', async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    await expect(input).toBeVisible();

    await input.fill('bad-email');
    await input.blur();
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    const errorText = await input.evaluate((el: HTMLInputElement) => {
      const errId = el.dataset.error || el.getAttribute('aria-errormessage') || el.getAttribute('aria-describedby');
      let errMsg: HTMLElement | null = null;
      if (errId) {
        for (const id of errId.split(/\s+/)) {
          const candidate = document.getElementById(id);
          if (candidate && (candidate.className.includes('error') || id.includes('error') || candidate.getAttribute('role') === 'alert')) {
            errMsg = candidate;
            break;
          }
        }
      }
      if (!errMsg) {
        errMsg = (el.parentElement?.querySelector('.error-message, .error-msg, [role="alert"], [class*="error"]') ?? null) as HTMLElement | null;
      }
      if (!errMsg) return '';
      const style = window.getComputedStyle(errMsg);
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      return visible ? (errMsg.textContent ?? '').replace(/\s+/g, ' ').trim() : '';
    });

    expect(errorText.length).toBeGreaterThan(0);
    const escaped = errorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(input).toHaveAccessibleDescription(new RegExp(escaped));
  });

  test('On page load, no field\'s accessible description includes its error text.', async ({ page }) => {
    const fields = page.locator('form input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]), form select, form textarea');
    const count = await fields.count();
    expect(count).toBeGreaterThan(0);

    // Verify on load no field exposes its error text in its accessible description,
    // then trigger invalidation to verify error descriptions are genuinely wired up.
    const preLoad = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLElement>('form input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]), form select, form textarea'));
      return inputs.map((el, idx) => {
        const selector = el.id ? `#${CSS.escape(el.id)}` : `form :is(input,select,textarea):nth-of-type(${idx + 1})`;
        const errId = el.dataset.error || el.getAttribute('aria-errormessage');
        let errEl = errId ? document.getElementById(errId) : null;
        if (!errEl && el.parentElement) {
          errEl = el.parentElement.querySelector('.error-message, .error-msg, [role="alert"], [class*="error"]');
        }
        const describedIds = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        const describedText = describedIds
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        return {
          selector,
          staticErrorText: (errEl?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          describedText,
        };
      });
    });

    expect(preLoad.length).toBeGreaterThan(0);
    for (const { selector, staticErrorText } of preLoad) {
      if (!staticErrorText) continue;
      const escaped = staticErrorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(page.locator(selector).first()).not.toHaveAccessibleDescription(new RegExp(escaped));
    }

    const submitBtn = page.locator('form button[type="submit"], form input[type="submit"], form button:not([type])').first();
    await submitBtn.click();

    const postInvalid = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLElement>('form input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]), form select, form textarea'));
      return inputs.map((el, idx) => {
        const selector = el.id ? `#${CSS.escape(el.id)}` : `form :is(input,select,textarea):nth-of-type(${idx + 1})`;
        const errId = el.dataset.error || el.getAttribute('aria-errormessage');
        let errEl = errId ? document.getElementById(errId) : null;
        if (!errEl && el.parentElement) {
          errEl = el.parentElement.querySelector('.error-message, .error-msg, [role="alert"], [class*="error"]');
        }
        const visible = Boolean(errEl && window.getComputedStyle(errEl).display !== 'none' && window.getComputedStyle(errEl).visibility !== 'hidden');
        return {
          selector,
          isInvalid: el.getAttribute('aria-invalid') === 'true',
          errorText: visible ? (errEl?.textContent ?? '').replace(/\s+/g, ' ').trim() : '',
        };
      }).filter((item) => item.isInvalid && item.errorText.length > 0);
    });

    expect(postInvalid.length).toBeGreaterThan(0);
    const preLoadBySelector = new Map(preLoad.map((p) => [p.selector, p.describedText]));
    for (const { selector, errorText } of postInvalid) {
      const initialDesc = preLoadBySelector.get(selector) ?? '';
      expect(initialDesc).not.toContain(errorText);
      const escaped = errorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(page.locator(selector).first()).toHaveAccessibleDescription(new RegExp(escaped));
    }
  });

  test('When a field becomes invalid as the user leaves it, its error text is announced through a polite live region.', async ({ page }) => {
    const liveRegions = page.locator('[aria-live="polite"], [role="status"]');
    expect(await liveRegions.count()).toBeGreaterThan(0);

    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    await input.fill('bad-email');
    await input.blur();

    const errorText = await input.evaluate((el: HTMLInputElement) => {
      const errId = el.dataset.error || el.getAttribute('aria-errormessage');
      const errEl = (errId ? document.getElementById(errId) : null) ??
        el.parentElement?.querySelector('.error-message, .error-msg, [role="alert"], [class*="error"]');
      return (errEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
    });
    expect(errorText.length).toBeGreaterThan(0);

    await expect.poll(async () => {
      return page.evaluate((expected) => {
        const regions = Array.from(document.querySelectorAll('[aria-live="polite"], [role="status"]'));
        return regions.some((r) => (r.textContent ?? '').replace(/\s+/g, ' ').includes(expected));
      }, errorText);
    }).toBe(true);
  });

  test('Submitting the form with an empty required field sets aria-invalid="true" on that field.', async ({ page }) => {
    const requiredField = page.locator('form input[required], form textarea[required], form select[required]').first();
    await expect(requiredField).toBeVisible();
    await expect(requiredField).not.toHaveAttribute('aria-invalid', 'true');
    await requiredField.fill('');

    const submitBtn = page.locator('form button[type="submit"], form input[type="submit"], form button:not([type])').first();
    await submitBtn.click();

    await expect(requiredField).toHaveAttribute('aria-invalid', 'true');
  });

  test('After a submit attempt with an invalid field, focus is on the first invalid field or on an error summary.', async ({ page }) => {
    const firstRequired = page.locator('form input[required], form textarea[required], form select[required]').first();
    await expect(firstRequired).toBeVisible();
    await expect(firstRequired).not.toHaveAttribute('aria-invalid', 'true');

    const submitBtn = page.locator('form button[type="submit"], form input[type="submit"], form button:not([type])').first();
    await submitBtn.focus();
    await submitBtn.click();

    const focusTargetValid = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return false;
      const firstInvalid = document.querySelector('form [aria-invalid="true"]');
      if (active === firstInvalid && active.getAttribute('aria-invalid') === 'true') return true;
      // Or an error summary container/heading with links to invalid fields
      const summary = active.closest('[role="alert"], [aria-labelledby], .error-summary, #error-summary, section, div');
      if (summary && summary.querySelector('a[href^="#"]')) return true;
      return false;
    });

    expect(focusTargetValid).toBe(true);
  });

  test('When a corrected field is edited back to an invalid value, it has aria-invalid="true" before it loses focus.', async ({ page }) => {
    const input = page.locator('input[type="email"], input[name="email"], #email').first();
    await input.fill('bad-email');
    await input.blur();
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.focus();
    await input.fill('test@example.com');
    const validState = await input.getAttribute('aria-invalid');
    expect(['false', null]).toContain(validState);

    // Edit back to invalid value without blurring
    await input.fill('still-bad');
    const stillFocused = await input.evaluate((el) => document.activeElement === el);
    expect(stillFocused).toBe(true);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  });

});
