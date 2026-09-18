import { test, expect } from '@playwright/test';

// Ensure TARGET_FILE is defined
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not defined.');
}

test.describe('Platform controls dismiss dialog tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any)._dialogCalls = {
        showModal: 0,
        show: 0
      };
      (window as any)._registeredKeyListeners = [];
      (window as any)._registeredPopStateListeners = [];
      (window as any)._registeredClickListeners = [];
      (window as any)._historyCalls = [];

      // Spy on HTMLDialogElement methods if exists
      if (typeof HTMLDialogElement !== 'undefined') {
        const originalShowModal = HTMLDialogElement.prototype.showModal;
        HTMLDialogElement.prototype.showModal = function() {
          (window as any)._dialogCalls.showModal++;
          return originalShowModal.apply(this, arguments as any);
        };
        const originalShow = HTMLDialogElement.prototype.show;
        HTMLDialogElement.prototype.show = function() {
          (window as any)._dialogCalls.show++;
          return originalShow.apply(this, arguments as any);
        };
      }

      // Spy on History methods
      const originalPushState = history.pushState;
      history.pushState = function(state: any) {
        (window as any)._historyCalls.push({ method: 'pushState', state });
        return originalPushState.apply(this, arguments as any);
      };
      const originalReplaceState = history.replaceState;
      history.replaceState = function(state: any) {
        (window as any)._historyCalls.push({ method: 'replaceState', state });
        return originalReplaceState.apply(this, arguments as any);
      };

      // Spy on addEventListener
      const spyAddEventListener = (targetName: string, original: Function) => {
        return function(this: any, type: string, listener: any, _options: any) {
          if (typeof listener === 'function') {
            const code = listener.toString();
            if (['keydown', 'keyup', 'keypress'].includes(type)) {
              (window as any)._registeredKeyListeners.push({ target: targetName, type, code });
            }
            if (['popstate', 'hashchange'].includes(type)) {
              (window as any)._registeredPopStateListeners.push({ target: targetName, type, code });
            }
            if (['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].includes(type)) {
              (window as any)._registeredClickListeners.push({ target: targetName, type, code });
            }
          }
          return original.apply(this, arguments as any);
        };
      };

      window.addEventListener = spyAddEventListener('window', window.addEventListener);
      document.addEventListener = spyAddEventListener('document', document.addEventListener);
      if (typeof Element !== 'undefined') {
        Element.prototype.addEventListener = spyAddEventListener('Element', Element.prototype.addEventListener);
      }
    });

    // Navigate to the target file
    await page.goto(`file://${targetFile}`);
    await page.waitForTimeout(100);
  });

  test('the modal dialog should be a <dialog> element', async ({ page }) => {
    const buttons = await page.locator('button').all();
    let modalTag = '';

    for (const button of buttons) {
      const text = await button.textContent();
      if (text && /show|open/i.test(text)) {
        await button.click();
        await page.waitForTimeout(100);

        modalTag = await page.evaluate(() => {
          const openDialog = document.querySelector('dialog[open]');
          if (openDialog) return openDialog.tagName.toLowerCase();

          const roleDialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
          for (const el of roleDialogs) {
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              return el.tagName.toLowerCase();
            }
          }

          const potentialModals = Array.from(document.querySelectorAll('[id*="modal"], [class*="modal"], [id*="dialog"], [class*="dialog"]'));
          for (const el of potentialModals) {
            if (['button', 'body', 'html'].includes(el.tagName.toLowerCase())) {
              continue;
            }
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              return el.tagName.toLowerCase();
            }
          }
          return '';
        });

        // Close it
        const closeBtn = page.locator('button:has-text("Close")').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(100);
        break; // Test first trigger
      }
    }

    expect(modalTag).toBe('dialog');
  });

  test('every <dialog> element has an accessible name', async ({ page }) => {
    const dialogs = await page.locator('dialog').all();

    const allHaveAccessibleName = dialogs.length > 0 && await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('dialog'));
      if (els.length === 0) return false;
      return els.every(el => {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim().length > 0) return true;

        const ariaLabelledby = el.getAttribute('aria-labelledby');
        if (ariaLabelledby) {
          const ids = ariaLabelledby.split(/\s+/);
          return ids.some(id => {
            const labelEl = document.getElementById(id);
            return labelEl && labelEl.textContent && labelEl.textContent.trim().length > 0;
          });
        }

        const title = el.getAttribute('title');
        if (title && title.trim().length > 0) return true;

        return false;
      });
    });

    expect(allHaveAccessibleName).toBe(true);
  });

  test('every <dialog> element has no closedby attribute or closedby set to any', async ({ page }) => {
    const dialogs = await page.locator('dialog').all();

    const validClosedByAttributes = dialogs.length > 0 && await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('dialog'));
      if (els.length === 0) return false;
      return els.every(el => {
        const closedby = el.getAttribute('closedby');
        return closedby === null || closedby === 'any';
      });
    });

    expect(validClosedByAttributes).toBe(true);
  });

  test('the dialog is opened with showModal or show-modal command', async ({ page }) => {
    const buttons = await page.locator('button').all();
    let correctOpeningMethod = false;

    for (const button of buttons) {
      const text = await button.textContent();
      if (text && /show|open/i.test(text)) {
        // Reset call counts
        await page.evaluate(() => {
          (window as any)._dialogCalls = { showModal: 0, show: 0 };
        });

        const command = await button.getAttribute('command');
        const commandfor = await button.getAttribute('commandfor');
        const isDeclarative = command === 'show-modal' && !!commandfor;

        await button.click();
        await page.waitForTimeout(100);

        const calls = await page.evaluate(() => (window as any)._dialogCalls);

        if (isDeclarative || (calls && calls.showModal > 0 && calls.show === 0)) {
          correctOpeningMethod = true;
        }

        // Close it
        const closeBtn = page.locator('button:has-text("Close")').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(100);
        break; // Test first trigger
      }
    }

    expect(correctOpeningMethod).toBe(true);
  });

  test('no fallback mechanism is provided for dismissing with the Esc key', async ({ page }) => {
    const listeners = await page.evaluate(() => (window as any)._registeredKeyListeners || []);

    let hasManualEscFallback = false;
    for (const listener of listeners) {
      if (/escape|esc|27/i.test(listener.code)) {
        hasManualEscFallback = true;
      }
    }

    const inlineHandlers = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .map(el => ({
          onkeydown: el.getAttribute('onkeydown'),
          onkeyup: el.getAttribute('onkeyup'),
          onkeypress: el.getAttribute('onkeypress')
        }))
        .filter(item => item.onkeydown || item.onkeyup || item.onkeypress);
    });

    for (const handler of inlineHandlers) {
      const code = `${handler.onkeydown || ''} ${handler.onkeyup || ''} ${handler.onkeypress || ''}`;
      if (/escape|esc|27/i.test(code)) {
        hasManualEscFallback = true;
      }
    }

    expect(hasManualEscFallback).toBe(false);
  });

  test('no fallback mechanism is provided for the mobile back button/gesture', async ({ page }) => {
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const text = await button.textContent();
      if (text && /show|open/i.test(text)) {
        await button.click();
        await page.waitForTimeout(100);

        const closeBtn = page.locator('button:has-text("Close")').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(100);
      }
    }

    const hasHistoryCallsOrPopstateListeners = await page.evaluate(() => {
      const calls = (window as any)._historyCalls || [];
      const listeners = (window as any)._registeredPopStateListeners || [];
      return calls.length > 0 || listeners.length > 0;
    });

    expect(hasHistoryCallsOrPopstateListeners).toBe(false);
  });

  test('no fallback mechanism is provided for light dismiss when using closedby=any', async ({ page }) => {
    const hasLightDismissFallback = await page.evaluate(() => {
      const listeners = (window as any)._registeredClickListeners || [];
      for (const listener of listeners) {
        const code = listener.code;
        const hasTargetCheck = /target|clientX|clientY|rect|getBoundingClientRect/i.test(code);
        const hasCloseAction = /close|hide|remove|active/i.test(code);
        if (hasTargetCheck && hasCloseAction) {
          return true;
        }
      }

      const inlineHandlers = Array.from(document.querySelectorAll('*'))
        .map(el => el.getAttribute('onclick'))
        .filter((val): val is string => !!val);

      for (const handler of inlineHandlers) {
        const hasTargetCheck = /target|clientX|clientY|rect|getBoundingClientRect/i.test(handler);
        const hasCloseAction = /close|hide|remove|active/i.test(handler);
        if (hasTargetCheck && hasCloseAction) {
          return true;
        }
      }

      return false;
    });

    expect(hasLightDismissFallback).toBe(false);
  });
});
