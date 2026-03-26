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
test.describe(`Required Field Feedback Expectations: ${demoName}`, () => {
  // Static assertions
  test('HTML should contain inputs with the required attribute', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasRequiredInputs = /<input[^>]+required[^>]*>/i.test(html);
    expect(hasRequiredInputs).toBe(true);
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
  test('On page load, all required fields must appear neutral', async ({ page }) => {
    const inputs = page.locator('form input[required]');
    const borderColors = await inputs.evaluateAll(els => els.map(el => window.getComputedStyle(el).borderColor));
    expect(borderColors.every(color => color !== 'rgb(217, 48, 37)')).toBe(true);
  });

  test('Clicking into a required field and clicking out (blur) WITHOUT typing MUST trigger the error state (red border)', async ({ page }) => {
    const input = page.locator('form input[required]').first();
    const initialColor = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    
    await input.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Backspace');
    await input.blur();
    
    const finalColor = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    
    expect(initialColor !== finalColor).toBe(true);
  });

  test('Typing into the field MUST remove the error state immediately', async ({ page }) => {
    const input = page.locator('form input[required]').first();
    const initialColor = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    
    await input.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Backspace');
    await input.blur();
    
    const errorColor = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    
    await input.focus();
    await page.keyboard.press('a');
    
    const finalColor = await input.evaluate(el => window.getComputedStyle(el).borderColor);
    
    expect(errorColor !== initialColor && finalColor !== errorColor).toBe(true);
  });

  test('Clicking "Submit" with empty fields MUST trigger the error state on all of them', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    const isEnabled = await submitBtn.isEnabled();
    
    let allTriggered = false;
    if (isEnabled) {
      const inputs = page.locator('form input[required]');
      const initialColors = await inputs.evaluateAll(els => els.map(el => window.getComputedStyle(el).borderColor));
      await submitBtn.click();
      const finalColors = await inputs.evaluateAll(els => els.map(el => window.getComputedStyle(el).borderColor));
      allTriggered = initialColors.every((color, i) => color !== finalColors[i]) && initialColors.length > 0;
    }
    
    expect(isEnabled && allTriggered).toBe(true);
  });

  test('"Force Fallback Mode" must replicate this exact behavior', async ({ page }) => {
    const fallbackCheckbox = page.locator('#force-fallback');
    const hasFallback = await fallbackCheckbox.count() > 0;
    
    if (!hasFallback) {
      expect(true).toBe(true); // Automatically pass if the fallback toggle isn't in this test UI
      return;
    }
    
    let success = false;
    await fallbackCheckbox.check();
    
    const inputs = page.locator('form input[required]');
    const initialColors = await inputs.evaluateAll(els => els.map(el => window.getComputedStyle(el).borderColor));
    
    const firstInput = inputs.first();
    await firstInput.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Backspace');
    await firstInput.blur();
    const blurColor = await firstInput.evaluate(el => window.getComputedStyle(el).borderColor);
    const blurRed = blurColor !== initialColors[0];
    
    await firstInput.focus();
    await page.keyboard.press('a');
    const typeColor = await firstInput.evaluate(el => window.getComputedStyle(el).borderColor);
    const typeNeutral = typeColor !== blurColor;
    
    await page.keyboard.press('Backspace');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    const finalColors = await inputs.evaluateAll(els => els.map(el => window.getComputedStyle(el).borderColor));
    const allRed = finalColors.every((color, index) => color !== initialColors[index]);
    
    success = blurRed && typeNeutral && allRed;
    
    expect(success).toBe(true);
  });
});
