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
test.describe(`Validate Input After Interaction Expectations: ${demoName}`, () => {
  
  // Static assertions
  test(`CSS uses :user-invalid pseudo-class`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);
  });

  test(`CSS avoids raw :invalid pseudo-class for validation styling`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/input:invalid\s*\{/);
  });

  test('Format hints and rules must be positioned above their corresponding input elements in the markup', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);
    const hasHintOrRule = /class=["'][^"']*(?:hint|rule)[^"']*["']/i.test(html);
    if (hasHintOrRule) {
      expect(/class=["'][^"']*(?:hint|rule)[^"']*["'][\s\S]*?<input/i.test(html)).toBe(true);
    }
  });

  test('Format rules or hints must not use the placeholder attribute', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);
    expect(/placeholder=["'][^"']*(?:@|example\.com|8\+|uppercase|character)/i.test(html)).toBe(false);
  });

  test('The visual error representation must incorporate multiple visual indicators', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);
    expect(/input:user-invalid[\s\S]*?(?:background|outline|\+\s*\.[a-z0-9_-]*error|~|\.[a-z0-9_-]*error)/i.test(html)).toBe(true);
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      let localFilePath;
      if (requestPath === '/' || requestPath === `/${demoName}`) {
          localFilePath = filePath;
      } else {
          localFilePath = path.join(targetDir, requestPath);
      }

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);

    // Disable transitions and animations to ensure instant E2E checks
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
  });

  // Browser assertions
  test(`On page load, the required input field MUST have a neutral border (not red)`, async ({ page }) => {
    const input = page.locator('input[required]').first();
    const color = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    expect(color).not.toBe('rgb(255, 0, 0)');
  });

  test(`Clicking into the required empty input field and clicking away (blur) MUST trigger the :user-invalid state`, async ({ page }) => {
    const input = page.locator('input[required]').first();
    const colorBefore = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    
    await input.focus();
    await input.fill('a');
    await input.fill('');
    await input.blur();
    
    const colorAfter = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    expect(colorAfter).not.toBe(colorBefore);
  });

  test(`Typing an invalid value before blur MUST NOT trigger the error state prematurely`, async ({ page }) => {
    const input = page.locator('input[required]').first();
    await input.focus();
    await input.fill('invalid');
    
    const color = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    expect(color).not.toBe('rgb(255, 0, 0)');
  });

  test(`Typing a valid value MUST remove the error state immediately (on input) or after blur`, async ({ page }) => {
    const input = page.locator('input[required]').first();
    const initialColor = await input.evaluate(el => window.getComputedStyle(el).borderColor);

    await input.focus();
    await input.fill('invalid');
    await input.blur();
    const errorColor = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    expect(errorColor).not.toBe(initialColor);

    await input.fill('test@example.com');
    await input.blur();
    const validColor = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    // Asserts that the error state is removed and does not use the naive 'green' fallback from the negative example
    expect(validColor).not.toBe(errorColor);
    expect(validColor).not.toBe('rgb(0, 128, 0)');
  });

  test(`Submitting the form with an empty required field MUST trigger the error state`, async ({ page }) => {
    const input = page.locator('input[required]').first();
    const colorBefore = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:not([type="button"])').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
    } else {
      await page.evaluate(() => {
        document.querySelector('form')?.requestSubmit();
      });
    }
    
    const colorAfter = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    expect(colorAfter).not.toBe(colorBefore);
  });

});
