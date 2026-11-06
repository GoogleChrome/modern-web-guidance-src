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

  test('The street address must be collected as a single <textarea autocomplete="street-address"> or address-line inputs', async ({ page }) => {
    const isValid = await page.evaluate(() => {
      const streetTextarea = document.querySelector<HTMLTextAreaElement>('textarea[autocomplete~="street-address"], textarea[autocomplete*="street-address"]');
      const addressLine1 = document.querySelector<HTMLInputElement>('input[autocomplete~="address-line1"], input[autocomplete*="address-line1"]');

      if (!streetTextarea && !addressLine1) return false;
      if (streetTextarea && document.querySelectorAll('textarea').length > 1) return false;

      // Ensure street address is not split across inputs lacking valid autocomplete tokens
      const validTokens = ['street-address', 'address-line1', 'address-line2', 'address-line3'];
      const candidateInputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')).filter(el => {
        const identifiers = `${el.id} ${el.name} ${el.getAttribute('placeholder') || ''}`.toLowerCase();
        return /(?:street|addr(?:ess)?[-_\s]*(?:line|1|2|3)|line[-_\s]*[123])/i.test(identifiers);
      });

      return candidateInputs.every(el => {
        const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
        return validTokens.some(token => ac.includes(token));
      });
    });
    expect(isValid).toBe(true);
  });

  test('The postal code input must have autocomplete="postal-code"', async ({ page }) => {
    await expect(page.locator('input[autocomplete*="postal-code"]').first()).toBeVisible();
  });

  test('Name and address inputs must not restrict to Latin-only characters', async ({ page }) => {
    const patterns = await page.evaluate(() => {
      const controls = Array.from(document.querySelectorAll('input[pattern], textarea[pattern]'));
      return controls.map(el => el.getAttribute('pattern')).filter(Boolean) as string[];
    });
    const invalidPatterns = patterns.filter(pattern => !new RegExp(`^(?:${pattern})$`, 'u').test('Renée Müller'));
    expect(invalidPatterns).toHaveLength(0);
  });

  test('Mandatory fields (at minimum the name and street address) must have the "required" attribute', async ({ page }) => {
    const result = await page.evaluate(() => {
      const nameInput = document.querySelector<HTMLInputElement>('input[autocomplete*="name"]');
      const streetControl = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
        'textarea[autocomplete*="street-address"], input[autocomplete*="address-line1"]'
      );
      if (!nameInput || !streetControl) return false;
      return nameInput.required && streetControl.required;
    });
    expect(result).toBe(true);
  });

});
