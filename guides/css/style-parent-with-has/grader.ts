import { test, expect, type Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) throw new Error('TARGET_FILE environment variable not set.');

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

// Helper: robust ancestor check leveraging Playwright's auto-retrying locators
async function waitForErrorState(page: any, formField: Locator, expectRed: boolean) {
  await expect(async () => {
    const isRed = await formField.evaluate((el: HTMLElement) => {
      let current = el.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        const colors = [style.borderColor, style.borderLeftColor, style.backgroundColor, style.color];
        for (const color of colors) {
          const m = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (m) {
            const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
            if (r > g + 40 && r > b + 40) return true; // It's red-ish
          }
        }
        current = current.parentElement;
      }
      return false;
    });
    expect(isRed).toBe(expectRed);
  }).toPass({ timeout: 2000 });
}

test.describe(`Style parent with :has() Expectations: ${demoName}`, () => {
  // Browser tests
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);
      if (fs.existsSync(localFilePath)) await route.fulfill({ path: localFilePath });
      else await route.continue();
    });
    await page.goto(demoUrl);
  });

  test('On page load, ancestor container should have neutral styling', async ({ page }) => {
    const input = page.locator('input[required]').first();
    await waitForErrorState(page, input, false);
  });

  test('Invalid interaction must trigger error state on a parent container', async ({ page }) => {
    const input = page.locator('input[required]').first();
    await waitForErrorState(page, input, false); // initial
    await input.fill('a');
    await input.fill('');
    await input.blur();
    await waitForErrorState(page, input, true); // should turn red!
  });

  test('Correcting the input must revert parent to neutral state', async ({ page }) => {
    const input = page.locator('input[required]').first();
    await input.fill('a');
    await input.fill('');
    await input.blur();
    await waitForErrorState(page, input, true); // triggered
    
    await input.fill('valid@example.com');
    await input.blur();
    await waitForErrorState(page, input, false); // cleared
  });

  test('The stylesheet uses :has(:user-invalid) scoped to a form field container rather than body', async ({ page }) => {
    const check = await page.evaluate(() => {
      let hasScopedHasUserInvalid = false;
      let hasBodyHas = false;
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            const sel = rule.selectorText || '';
            if (sel.includes(':has(') && sel.includes(':user-invalid')) {
              const parts = sel.split(',').map(s => s.trim());
              for (const part of parts) {
                if (part.includes(':has(') && part.includes(':user-invalid')) {
                  if (/^(body|html|:root)\s*:has\(/i.test(part)) {
                    hasBodyHas = true;
                  } else {
                    hasScopedHasUserInvalid = true;
                  }
                }
              }
            }
            if (/^(body|html|:root)\s*:has\(/i.test(sel)) {
              hasBodyHas = true;
            }
          }
        }
      }
      return { hasScopedHasUserInvalid, hasBodyHas };
    });
    expect(check.hasScopedHasUserInvalid).toBe(true);
    expect(check.hasBodyHas).toBe(false);
  });
});
