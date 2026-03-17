import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Style Parent with :has() Expectations: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.substring(1));

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
    // Disable CSS transitions to get accurate color readings immediately
    await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
  });

  test(`On page load, the parent card should have a neutral border`, async ({ page }) => {
    const borderColor = await page.locator('.card').evaluate((el) => window.getComputedStyle(el).borderLeftColor);
    expect(borderColor).not.toBe('rgb(217, 48, 37)');
  });

  test(`Interacting with the input (focus -> blur empty) MUST trigger the error state on the parent container`, async ({ page }) => {
    const initialColor = await page.locator('.card').evaluate((el) => window.getComputedStyle(el).borderLeftColor);

    const input = page.locator('input[required]').first();
    await input.focus();
    await input.fill('a');
    await input.fill('');
    await input.blur();
    
    await page.waitForTimeout(50);

    const errorColor = await page.locator('.card').evaluate((el) => window.getComputedStyle(el).borderLeftColor);
    expect(errorColor).not.toBe(initialColor);
  });

  test(`The "Status Icon" in the header should appear or change when the input is invalid`, async ({ page }) => {
    const statusIcon = page.locator('.status-icon');
    const initialContent = await statusIcon.evaluate((el) => window.getComputedStyle(el, '::after').content);

    const input = page.locator('input[required]').first();
    await input.focus();
    await input.fill('a');
    await input.fill('');
    await input.blur();
    
    await page.waitForTimeout(50);

    const errorContent = await statusIcon.evaluate((el) => window.getComputedStyle(el, '::after').content);
    expect(errorContent).not.toBe(initialContent);
  });

  test(`Correcting the input MUST revert the parent container to the neutral state`, async ({ page }) => {
    const input = page.locator('input[required]').first();
    
    await input.focus();
    await input.fill('a');
    await input.fill('');
    await input.blur(); // trigger error
    await page.waitForTimeout(50);
    
    const errorColor = await page.locator('.card').evaluate((el) => window.getComputedStyle(el).borderLeftColor);
    
    await input.fill('testuser@example.com');
    await input.blur(); // trigger valid state
    await page.waitForTimeout(50);
    
    const correctedColor = await page.locator('.card').evaluate((el) => window.getComputedStyle(el).borderLeftColor);
    
    expect(correctedColor).not.toBe(errorColor);
  });

  test(`"Force Fallback Mode" must replicate this parent-styling behavior using JS class toggling`, async ({ page }) => {
    const hasErrorClass = await page.evaluate(async () => {
      const checkbox = document.querySelector('#force-fallback') as HTMLInputElement;
      if (!checkbox) return false;
      
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
      
      const input = document.querySelector('input[required]') as HTMLInputElement;
      if (!input) return false;
      
      // Simulate interaction for JS fallback
      input.focus();
      // Emulate typing
      input.value = 'a';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
      
      // Allow time for the fallback setTimeout to execute
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const card = document.querySelector('.card');
      if (!card) return false;
      return card.classList.contains('has-error-fallback');
    });

    expect(hasErrorClass).toBe(true);
  });
});
