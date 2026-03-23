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
test.describe(`autofill-highlight-inputs Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Should not use JavaScript to style inputs`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Using a regex to test for inline script styling as shown in negative-demo
    expect(html).not.toMatch(/\.style\./);
  });

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

  // Browser assertions
  test(`Should use :autofill pseudo-class on input, select, or textarea elements`, async ({ page }) => {
    const validSelectorsCount = await page.evaluate(() => {
      let count = 0;
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          for (let j = 0; j < sheet.cssRules.length; j++) {
            if (!(rule instanceof CSSStyleRule)) {
              continue;
            }
            const rule = sheet.cssRules[j];
            if (rule.selectorText && rule.selectorText.includes(':autofill')) {
              const selectors = rule.selectorText.split(',');
              for (let sel of selectors) {
                sel = sel.trim();
                if (sel.includes(':autofill')) {
                  const parts = sel.split(/[\s>+~]+/);
                  const targetPart = parts[parts.length - 1];
                  const tagMatch = targetPart.match(/^([a-zA-Z0-9_-]+)/);
                  if (tagMatch && ['input', 'select', 'textarea'].includes(tagMatch[1].toLowerCase())) {
                    count++;
                  }
                }
              }
            }
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
            continue;
          }
          throw e;
        }
      }
      return count;
    });
    expect(validSelectorsCount).toBeGreaterThan(0);
  });

  test(`Should not use :auto-fill pseudo-class`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/:auto-fill/);
  });

  test(`Should not use :autofill on non-allowed elements`, async ({ page }) => {
    const invalidSelectorsCount = await page.evaluate(() => {
      let count = 0;
      for (let i = 0; i < document.styleSheets.length; i++) {
        const sheet = document.styleSheets[i];
        try {
          for (let j = 0; j < sheet.cssRules.length; j++) {
            const rule = sheet.cssRules[j];
            if (rule.selectorText && rule.selectorText.includes(':autofill')) {
              const selectors = rule.selectorText.split(',');
              for (let sel of selectors) {
                sel = sel.trim();
                if (sel.includes(':autofill')) {
                  const parts = sel.split(/[\s>+~]+/);
                  const targetPart = parts[parts.length - 1];
                  const tagMatch = targetPart.match(/^([a-zA-Z0-9_-]+)/);
                  if (!tagMatch || !['input', 'select', 'textarea'].includes(tagMatch[1].toLowerCase())) {
                    count++;
                  }
                }
              }
            }
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
            continue;
          }
          throw e;
        }
      }
      return count;
    });
    expect(invalidSelectorsCount).toBe(0);
  });
});
