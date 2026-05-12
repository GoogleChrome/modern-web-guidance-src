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

test.describe(`autofill-highlight-inputs Expectations: ${demoName}`, () => {

  // CSS selector checks use the HTML source because browsers normalize :autofill
  // to :-webkit-autofill in the CSSOM, making stylesheet inspection unreliable.

  test('The :autofill pseudo-class must be applied to a form control', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasAutofill = /:autofill\b/i.test(html) || /:-webkit-autofill\b/i.test(html);
    expect(hasAutofill).toBe(true);
  });

  test('The incorrect spelling :auto-fill must not be used', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(/:auto-fill\b/i.test(html)).toBe(false);
  });

  test('The :autofill pseudo-class must only be applied to <input>, <select>, or <textarea>', () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const matches = [...html.matchAll(/([a-zA-Z][\w-]*):(?:-webkit-)?auto-?fill\b/gi)];
    const invalidTags = matches.map(m => m[1].toLowerCase()).filter(t => !['input', 'select', 'textarea'].includes(t));
    expect(invalidTags).toHaveLength(0);
  });

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

  test('JavaScript must not apply inline styles to form controls', async ({ page }) => {
    const controls = await page.locator('input:not([type="submit"]):not([type="button"]), select, textarea').all();
    for (const control of controls) {
      await control.fill('Test Value').catch(() => {});
    }
    await page.waitForTimeout(1000);

    const hasInlineStyles = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input, select, textarea'))
        .some(el => (el as HTMLElement).style.length > 0);
    });
    expect(hasInlineStyles).toBe(false);
  });

});
