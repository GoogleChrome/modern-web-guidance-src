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

  test('The interface must include a semantic, visible submit button', async ({ page }) => {
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

  test('Pressing Enter (without Shift) when NOT composing triggers form submission', async ({ page }) => {
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

  test('Pressing Enter when IS composing (standard) does NOT trigger submission', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Composition test');

    await textarea.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    });

    await textarea.focus();
    await textarea.evaluate((el) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        isComposing: true
      });
      el.dispatchEvent(event);
    });

    const value = await textarea.inputValue();
    expect(value, 'Textarea should not be cleared during composition').toBe('Composition test');
  });

  test('Pressing Enter when IS composing (Safari confirmation) does NOT trigger submission', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Composition test');

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

    const value = await textarea.inputValue();
    expect(value, 'Textarea should not be cleared during composition').toBe('Composition test');
  });

  test('Pressing Shift+Enter does NOT trigger submission', async ({ page }) => {
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Shift test');

    await textarea.focus();
    await page.keyboard.press('Shift+Enter');

    const value = await textarea.inputValue();
    expect(value, 'Textarea should not be cleared on Shift+Enter').toContain('Shift test');
  });

  test('Shift+Enter should allow normal newline insertion', async ({ page }) => {
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
