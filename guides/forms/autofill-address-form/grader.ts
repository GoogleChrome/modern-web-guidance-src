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

test.describe(`autofill-address-form Expectations: ${demoName}`, () => {

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

  test('All form controls must be within a <form> element', async ({ page }) => {
    const allInsideForm = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input, select, textarea'));
      if (controls.length === 0) return false;
      return controls.every(el => !!el.closest('form'));
    });
    expect(allInsideForm).toBe(true);
  });

  test('Every form control must have an associated <label>', async ({ page }) => {
    const allHaveLabels = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"]), select, textarea'));
      if (controls.length === 0) return false;
      return controls.every(control => {
        const id = control.id;
        return id && !!document.querySelector(`label[for="${id}"]`);
      });
    });
    expect(allHaveLabels).toBe(true);
  });

  test('Every <label> must have a "for" attribute matching a control "id"', async ({ page }) => {
    const labelsValid = await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      if (labels.length === 0) return false;
      return labels.every(label => {
        const forAttr = label.getAttribute('for');
        const target = forAttr ? document.getElementById(forAttr) : null;
        return target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
      });
    });
    expect(labelsValid).toBe(true);
  });

  test('A single <textarea> must be used for the street address', async ({ page }) => {
    await expect(page.locator('textarea')).toHaveCount(1);
  });

  test('The street address textarea must have autocomplete="street-address"', async ({ page }) => {
    const attr = await page.locator('textarea').first().getAttribute('autocomplete');
    expect(attr?.includes('street-address')).toBe(true);
  });

  test('The postal code input must have autocomplete="postal-code"', async ({ page }) => {
    await expect(page.locator('input[autocomplete*="postal-code"]').first()).toBeVisible();
  });

  test('The postal code input must not use type="number"', async ({ page }) => {
    const type = await page.locator('input[autocomplete*="postal-code"]').first().getAttribute('type');
    expect(type).not.toBe('number');
  });

  test('Name and address inputs must not restrict to Latin-only characters', async ({ page }) => {
    const patterns = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input[pattern], textarea[pattern]'));
      return controls.map(el => el.getAttribute('pattern')).filter(Boolean) as string[];
    });
    for (const pattern of patterns) {
      expect(new RegExp(`^(?:${pattern})$`, 'u').test('Renée Müller')).toBe(true);
    }
  });

  test('Required form fields must have the "required" attribute', async ({ page }) => {
    const result = await page.evaluate(() => {
      const nameInput = document.querySelector<HTMLInputElement>('input[autocomplete*="name"]');
      const addressTextarea = document.querySelector<HTMLTextAreaElement>('textarea[autocomplete*="street-address"]');
      if (!nameInput || !addressTextarea) return false;
      return nameInput.required && addressTextarea.required;
    });
    expect(result).toBe(true);
  });

});
