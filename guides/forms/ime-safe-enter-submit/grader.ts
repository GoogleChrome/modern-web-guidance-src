import { test, expect } from '@playwright/test';

declare var process: { env: { [key: string]: string | undefined } };
const target = process.env.TARGET_FILE;

test.describe('IME-Safe Enter-to-Submit', () => {
  test.beforeEach(async ({ page }) => {
    if (!target) {
      throw new Error('TARGET_FILE environment variable is not set');
    }
    const url = target.startsWith('http') ? target : `file://${target}`;
    await page.goto(url);
  });

  test('The interface includes a semantic, visible submit button.', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Send"), button:has-text("Submit")');

    const count = await submitButton.count();
    let visibleFound = false;
    for (let i = 0; i < count; i++) {
      if (await submitButton.nth(i).isVisible()) {
        visibleFound = true;
        break;
      }
    }
    expect(visibleFound, 'No visible semantic submit button found').toBe(true);
  });

  test('Pressing Enter without Shift on a textarea when not composing triggers form submission.', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    await textarea.fill('Hello World');

    const resultPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const form = document.querySelector('form');
        if (!form) return resolve('no-form');

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          resolve('submitted');
        }, { once: true });

        setTimeout(() => resolve('timeout'), 2000);
      });
    });

    await textarea.focus();
    await page.keyboard.press('Enter');

    expect(await resultPromise).toBe('submitted');
  });

  test('Pressing Enter on a textarea when composition is active (`isComposing` is true) does not trigger form submission.', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Composition test');

    await page.evaluate(() => {
      (window as any).__formSubmitted = false;
      const form = document.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          (window as any).__formSubmitted = true;
        }, { once: true });
      }
    });

    await textarea.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    });

    await textarea.focus();
    // Real browsers report keyCode 229 (VK_PROCESSKEY) during IME composition, never 13
    await textarea.evaluate((el) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 229,
        which: 229,
        bubbles: true,
        cancelable: true,
        isComposing: true
      });
      el.dispatchEvent(event);
    });

    const wasSubmitted = await page.evaluate(() => (window as any).__formSubmitted === true);
    expect(wasSubmitted).toBe(false);

    const value = await textarea.inputValue();
    expect(value, 'Textarea should not be cleared during composition').toBe('Composition test');
  });

  test('Pressing Enter on a textarea when the browser signals an IME-consumed keystroke (`keyCode 229`) does not trigger form submission.', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Composition test');

    await page.evaluate(() => {
      (window as any).__formSubmitted = false;
      const form = document.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          (window as any).__formSubmitted = true;
        }, { once: true });
      }
    });

    await textarea.focus();
    // Dispatch keydown with key: 'Enter', keyCode: 229, isComposing: false (Safari composition confirmation behavior)
    await textarea.evaluate((el) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 229,
        which: 229,
        bubbles: true,
        cancelable: true,
        isComposing: false
      });
      el.dispatchEvent(event);
    });

    const wasSubmitted = await page.evaluate(() => (window as any).__formSubmitted === true);
    expect(wasSubmitted).toBe(false);

    const value = await textarea.inputValue();
    expect(value, 'Textarea should not be cleared during composition').toBe('Composition test');
  });

  test('Pressing Shift+Enter on a textarea does not trigger form submission.', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Shift test');

    await page.evaluate(() => {
      (window as any).__formSubmitted = false;
      const form = document.querySelector('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          (window as any).__formSubmitted = true;
        }, { once: true });
      }
    });

    await textarea.focus();
    await page.keyboard.press('Shift+Enter');

    const wasSubmitted = await page.evaluate(() => (window as any).__formSubmitted === true);
    expect(wasSubmitted).toBe(false);

    const value = await textarea.inputValue();
    expect(value, 'Textarea should not be cleared on Shift+Enter').toContain('Shift test');
  });

  test('Pressing Shift+Enter on a textarea inserts a newline into the text content.', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Line 1');

    await textarea.focus();
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Line 2');

    const value = await textarea.inputValue();
    expect(value, 'Textarea should contain a newline between Line 1 and Line 2').toMatch(/Line 1[\r\n]+Line 2/);
  });
});
