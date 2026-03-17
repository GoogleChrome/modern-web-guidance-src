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

test.describe(`Select Menu Interaction Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Select element must have the required attribute`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const selectTagMatch = html.match(/<select[^>]*>/i);
    const hasRequired = selectTagMatch ? /\brequired\b/i.test(selectTagMatch[0]) : false;
    expect(hasRequired).toBe(true);
  });

  test(`The first option element must be disabled with empty value`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const firstOptionMatch = html.match(/<option[^>]*>/i);
    const hasDisabledAndEmptyValue = firstOptionMatch 
      ? /\bdisabled\b/i.test(firstOptionMatch[0]) && /value=""/i.test(firstOptionMatch[0])
      : false;
    expect(hasDisabledAndEmptyValue).toBe(true);
  });

  test(`CSS must use the :user-invalid pseudo-class`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(/:user-invalid/.test(html)).toBe(true);
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
  test(`On page load, the select menu should look neutral (no red border)`, async ({ page }) => {
    const borderColor = await page.locator('select').first().evaluate(el => window.getComputedStyle(el).borderColor);
    expect(borderColor).toBe('rgb(204, 204, 204)');
  });

  test(`Focusing and blurring without changing the value must NOT trigger the error state`, async ({ page }) => {
    const select = page.locator('select').first();
    const initialColor = await select.evaluate(el => window.getComputedStyle(el).borderColor);
    
    await select.focus();
    await select.blur();
    
    const finalColor = await select.evaluate(el => window.getComputedStyle(el).borderColor);
    expect(`${initialColor} -> ${finalColor}`).toBe('rgb(204, 204, 204) -> rgb(204, 204, 204)');
  });

  test(`Selecting a valid option MUST remove the error state`, async ({ page }) => {
    const select = page.locator('select').first();
    
    const initialColor = await select.evaluate(el => window.getComputedStyle(el).borderColor);
    
    await select.focus();
    await select.selectOption('us');
    await select.blur();
    await page.waitForTimeout(100);
    
    const finalColor = await select.evaluate(el => window.getComputedStyle(el).borderColor);
    expect(`${initialColor} -> ${finalColor}`).toBe('rgb(204, 204, 204) -> rgb(204, 204, 204)');
  });

  test(`Submitting while empty MUST trigger the error state`, async ({ page }) => {
    const select = page.locator('select').first();
    const initialColor = await select.evaluate(el => window.getComputedStyle(el).borderColor);
    
    try {
      await page.locator('button[type="submit"]').first().click({ timeout: 2000 });
      await page.waitForTimeout(100);
    } catch (e) {
      if (!(e instanceof Error) || (!e.message.includes('Target closed') && !e.message.includes('Execution context was destroyed') && !e.message.includes('Timeout'))) {
        throw e;
      }
    }
    
    const finalColor = await select.evaluate(el => window.getComputedStyle(el).borderColor);
    expect(`${initialColor} -> ${finalColor}`).toBe('rgb(204, 204, 204) -> rgb(217, 48, 37)');
  });

  test(`"Force Fallback Mode" must replicate this behavior`, async ({ page }) => {
    const isFallbackWorking = await page.locator('#force-fallback').isVisible().then(async (visible) => {
      if (!visible) return false;
      await page.locator('#force-fallback').check();
      
      const select = page.locator('select').first();
      await select.focus();
      await select.selectOption('us');
      await select.blur();
      await page.waitForTimeout(100);
      const validColor = await select.evaluate(el => window.getComputedStyle(el).borderColor);
      
      await select.evaluate(el => { (el as HTMLSelectElement).value = ''; });
      await select.dispatchEvent('change');
      await select.blur();
      await page.waitForTimeout(100);
      const invalidColor = await select.evaluate(el => window.getComputedStyle(el).borderColor);
      
      return validColor === 'rgb(24, 128, 56)' && invalidColor === 'rgb(217, 48, 37)';
    });
    expect(isFallbackWorking).toBe(true);
  });
});
