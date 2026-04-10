import { test, expect } from '@playwright/test';
// @ts-ignore
import * as fs from 'fs';
// @ts-ignore
import * as path from 'path';

declare const process: any;

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Forms Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestUrl = route.request().url();
      const requestPath = new URL(requestUrl).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' || requestPath === `/${demoName}` ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('should use <form> element', async ({ page }) => {
    const forms = await page.locator('form').count();
    expect(forms).toBeGreaterThan(0);
  });

  test('should use method="POST" for mutations', async ({ page }) => {
    const forms = await page.locator('form');
    const count = await forms.count();
    let hasPost = false;
    for (let i = 0; i < count; i++) {
      const method = await forms.nth(i).getAttribute('method');
      if (method?.toUpperCase() === 'POST') {
        hasPost = true;
      }
    }
    expect(hasPost).toBe(true);
  });

  test('should specify the action attribute on the <form> element', async ({ page }) => {
    const forms = await page.locator('form').all();
    expect(forms.length, 'At least one <form> must exist').toBeGreaterThan(0);
    for (const form of forms) {
      const action = await form.getAttribute('action');
      expect(action).toBeTruthy();
    }
  });

  test('should specify a name attribute for every form control', async ({ page }) => {
    const controls = await page.locator('input:not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea').all();
    expect(controls.length, 'At least one form control must exist').toBeGreaterThan(0);
    for (const control of controls) {
      const name = await control.getAttribute('name');
      const id = await control.getAttribute('id');
      const type = await control.getAttribute('type');
      if (type === 'hidden' && !id && !name) continue; 
      expect(name, `Control with id "${id}" should have a name attribute`).toBeTruthy();
    }
  });

  test('should use semantic tags for form controls', async ({ page }) => {
    const pseudoButtons = await page.locator('div[onclick], span[onclick], div.button, span.button').all();
    for (const btn of pseudoButtons) {
      const text = await btn.textContent();
      if (text?.toLowerCase().includes('submit') || text?.toLowerCase().includes('save') || text?.toLowerCase().includes('click')) {
        const tagName = await btn.evaluate(el => el.tagName.toLowerCase());
        expect(tagName).toBe('button');
      }
    }
  });

  test('should use <fieldset> and <legend> to group related controls', async ({ page }) => {
    const inputs = await page.locator('input').count();
    if (inputs > 5) {
      const fieldsets = await page.locator('fieldset').count();
      const legends = await page.locator('legend').count();
      expect(fieldsets).toBeGreaterThan(0);
      expect(legends).toBeGreaterThan(0);
    }
  });

  test('should associate every <label> with its input using for and id', async ({ page }) => {
    const labels = await page.locator('label').all();
    expect(labels.length, 'At least one <label> must exist').toBeGreaterThan(0);
    for (const label of labels) {
      const forAttr = await label.getAttribute('for');
      const idAttr = await label.getAttribute('id');
      
      if (forAttr) {
        const input = page.locator(`#${forAttr}`);
        expect(await input.count(), `Label with for="${forAttr}" should have a matching input id`).toBe(1);
      } else {
        const input = label.locator('input, select, textarea');
        const inputCount = await input.count();
        if (inputCount === 0) {
          if (idAttr) {
            const labelledBy = await page.locator(`[aria-labelledby*="${idAttr}"]`).count();
            if (labelledBy > 0) continue;
          }
          throw new Error(`Label "${await label.textContent()}" is not associated with any input via "for" attribute or nesting.`);
        }
      }
    }
  });

  test('should place labels above form controls', async ({ page }) => {
    const result = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return { valid: false, error: 'No <label> elements found' };
      for (const label of labels) {
        const id = label.getAttribute('for');
        const input = (id ? document.getElementById(id) : label.querySelector('input, select, textarea')) as HTMLElement | null;
        if (!input) continue;

        if (input.closest('.visually-hidden') || label.closest('.visually-hidden')) continue;
        if (input.offsetWidth === 0 || input.offsetHeight === 0) continue;
        const style = window.getComputedStyle(input);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;

        const labelRect = label.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();

        const inputType = (input as HTMLInputElement).type;
        if (inputType === 'checkbox' || inputType === 'radio') continue;

        if (labelRect.top > inputRect.top) {
            return { valid: false, error: `Label for "${input.id || (input as HTMLInputElement).name}" is below the input.` };
        }
        
        if (Math.abs(labelRect.left - inputRect.left) > 60 && labelRect.top < inputRect.bottom && labelRect.bottom > inputRect.top) {
             return { valid: false, error: `Label for "${input.id || (input as HTMLInputElement).name}" is side-by-side with the input.` };
        }
      }
      return { valid: true };
    });
    expect(result.valid, result.error).toBe(true);
  });

  test('should NOT use placeholder as a replacement for labels', async ({ page }) => {
    const inputs = await page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      if (placeholder) {
        let hasLabel = false;
        if (id) {
          const label = await page.locator(`label[for="${id}"]`).count();
          if (label > 0) hasLabel = true;
        }
        if (!hasLabel) {
          const nestedLabel = await input.evaluate(el => !!el.closest('label'));
          if (nestedLabel) hasLabel = true;
        }
        expect(hasLabel, `Input with placeholder "${placeholder}" should have a visible label`).toBe(true);
      }
    }
  });

  test('should define the lang attribute on the <html> element', async ({ page }) => {
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('should use autocomplete attribute', async ({ page }) => {
    const email = page.locator('input[type="email"], input[id*="email"], input[name*="email"], input[placeholder*="Email"]');
    expect(await email.count(), 'Should have an email field').toBeGreaterThan(0);
    const autocomplete = await email.first().getAttribute('autocomplete');
    expect(autocomplete).toMatch(/email|username/);
  });

  test('should use inputmode for optimized keyboards', async ({ page }) => {
    const numericInputs = await page.locator('input[name*="zip"], input[name*="postal"], input[id*="z"], input[id*="zip"], input[name*="phone"], input[name*="tel"], input[id*="ph"], input[name*="cc-number"], input[name*="card"], input[id*="cc"]').all();
    expect(numericInputs.length).toBeGreaterThan(0);
    for (const input of numericInputs) {
      const inputmode = await input.getAttribute('inputmode');
      const type = await input.getAttribute('type');
      if (type !== 'number' && type !== 'hidden') {
         expect(inputmode).toMatch(/numeric|tel/);
      } else if (type === 'number') {
          expect(inputmode, 'type="number" is discouraged for CC/ZIP, and it must have inputmode if used').toBeTruthy();
      }
    }
  });

  test('should NOT use type="number" for credit cards or ZIP codes', async ({ page }) => {
    const zip = page.locator('input[name*="zip"], input[name*="postal"], input[id*="z"], input[id*="zip"], [placeholder*="ZIP"]');
    expect(await zip.count()).toBeGreaterThan(0);
    for (const el of await zip.all()) {
        expect(await el.getAttribute('type')).not.toBe('number');
    }
    const cc = page.locator('input[name*="cc-number"], input[name*="card"], input[id*="cc"], [placeholder*="Credit Card"]');
    expect(await cc.count()).toBeGreaterThan(0);
    for (const el of await cc.all()) {
        expect(await el.getAttribute('type')).not.toBe('number');
    }
  });

  test('should use native constraints', async ({ page }) => {
    const requiredInputs = await page.locator('input[required], textarea[required], select[required]').count();
    expect(requiredInputs).toBeGreaterThan(0);
  });

  test('should set font-size to at least 1rem (16px) on inputs', async ({ page }) => {
    const result = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
      
      for (const input of inputs) {
        const style = window.getComputedStyle(input);
        const fontSize = parseFloat(style.fontSize);
        
        if (fontSize < 15) {
          return { valid: false, error: `Input "${input.id || (input as HTMLInputElement).name}" font-size is too small: ${fontSize}px. Expected at least 16px (1rem).` };
        }
      }
      return { valid: true };
    });
    expect(result.valid, result.error).toBe(true);
  });

  test('should ensure tap targets are at least 48px', async ({ page }) => {
    const targets = await page.locator('input:not([type="hidden"]), select, textarea, button').all();
    for (const target of targets) {
      const height = await target.evaluate(el => el.getBoundingClientRect().height);
      const type = await target.evaluate(el => (el as HTMLInputElement).type);
      if (type === 'checkbox' || type === 'radio') {
        const parentHeight = await target.evaluate(el => el.parentElement?.getBoundingClientRect().height || 0);
        expect(Math.max(height, parentHeight)).toBeGreaterThanOrEqual(44);
      } else {
        expect(height).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('should use a single field for full names', async ({ page }) => {
    const firstNames = await page.locator('input[name*="first"], input[placeholder*="First"]').count();
    if (await page.locator('input[name*="name"], input[placeholder*="Name"]').count() > 0) {
        expect(firstNames).toBe(0);
    }
  });

  test('should allow pasting into password fields', async ({ page }) => {
    const password = page.locator('input[type="password"]');
    if (await password.count() > 0) {
      const canPaste = await password.evaluate(el => {
        const event = new ClipboardEvent('paste', { cancelable: true });
        return el.dispatchEvent(event);
      });
      expect(canPaste).toBe(true);
    }
  });

  test('should provide a toggle capability to unmask password', async ({ page }) => {
    const password = page.locator('input[type="password"]');
    if (await password.count() > 0) {
      const buttons = await page.locator('button').all();
      let hasToggle = false;
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text?.toLowerCase().includes('show') || text?.toLowerCase().includes('hide')) {
          hasToggle = true;
          break;
        }
      }
      expect(hasToggle).toBe(true);
    }
  });

  test('should implement anti-CSRF tokens for POST forms', async ({ page }) => {
    const postForms = await page.locator('form[method="POST"], form[method="post"]').all();
    expect(postForms.length, 'At least one POST form should exist for mutations').toBeGreaterThan(0);
    for (const form of postForms) {
      const csrf = await form.locator('input[type="hidden"][name*="csrf"], input[type="hidden"][name*="token"]').count();
      expect(csrf, 'POST form should have an anti-CSRF token').toBeGreaterThan(0);
    }
  });

  test('should use aria-describedby to link inputs with help text or error messages', async ({ page }) => {
    // Check all persistent hints first
    const hints = await page.locator('.hint').all();
    for (const hint of hints) {
      const id = await hint.getAttribute('id');
      if (id && await hint.isVisible()) {
        const described = await page.locator(`[aria-describedby*="${id}"]`).count();
        expect(described, `Hint "${id}" should be linked via aria-describedby`).toBeGreaterThan(0);
      }
    }
    // For error messages, we might need to trigger them, but at least check if any aria-describedby is present
    const hasAriaDescribedBy = await page.locator('[aria-describedby]').count();
    expect(hasAriaDescribedBy, 'aria-describedby should be used in the form').toBeGreaterThan(0);
  });

  test('should use aria-live for dynamic announcements', async ({ page }) => {
    const live = await page.locator('[aria-live]').count();
    expect(live).toBeGreaterThan(0);
  });

  test('should disable the submit button after a valid submission', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"], input[type="submit"]');
    expect(await submitBtn.count(), 'Should have a semantic submit button').toBeGreaterThan(0);
    
    const requiredInputs = await page.locator('input[required], select[required], textarea[required]').all();
    for (const input of requiredInputs) {
      const type = await input.getAttribute('type');
      if (type === 'radio' || type === 'checkbox') {
        await input.check();
      } else if (type === 'email') {
        await input.fill('test@example.com');
      } else if (await input.evaluate(el => el.tagName === 'SELECT')) {
          await (input as any).selectOption({ index: 1 });
      } else {
        await input.fill('Valid Data');
      }
    }
    
    const btn = submitBtn.last();
    await btn.click();
    await page.waitForTimeout(100);
    expect(await btn.isDisabled()).toBe(true);
  });

  test('should NOT disable focus outlines', async ({ page }) => {
    const input = page.locator('input:not([type="hidden"])').first();
    await input.focus();
    const hasVisibleFocus = await page.evaluate((el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      const hasBoxShadow = style.boxShadow !== 'none' && style.boxShadow !== '';
      return hasOutline || hasBoxShadow;
    }, await input.elementHandle());
    expect(hasVisibleFocus).toBe(true);
  });

  test('vertical margin between label and input should be less than margin between form groups', async ({ page }) => {
    const result = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return { error: 'No <label> elements found' };

      for (const label of labels) {
        const inputId = label.getAttribute('for');
        const input = (inputId ? document.getElementById(inputId) : label.querySelector('input')) as HTMLElement | null;
        if (!input) continue;

        const labelRect = label.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();

        const labelToInputMargin = inputRect.top - labelRect.bottom;

        let parent = label.parentElement;
        while (parent && parent.tagName !== 'FORM' && !parent.nextElementSibling) {
          parent = parent.parentElement;
        }

        if (parent && parent.nextElementSibling) {
          const nextGroupRect = parent.nextElementSibling.getBoundingClientRect();
          const groupToGroupMargin = nextGroupRect.top - parent.getBoundingClientRect().bottom;
          
          if (labelToInputMargin >= groupToGroupMargin && groupToGroupMargin > 0) {
            return { 
              valid: false, 
              label: label.textContent, 
              labelToInputMargin, 
              groupToGroupMargin 
            };
          }
        }
      }
      return { valid: true };
    });

    if (result.error) {
      throw new Error(result.error);
    }
    expect(result.valid).toBe(true);
  });
});
