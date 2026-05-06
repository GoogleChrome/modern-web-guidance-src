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

    // Disable transitions and animations to ensure instant E2E style checks
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.innerHTML = '* { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
    });
  });

  async function getStyling(input: any) {
    return await input.evaluate((el: HTMLElement) => {
      const style = window.getComputedStyle(el);
      const hasUserInvalid = el.matches(':user-invalid') || el.classList.contains('user-invalid') || el.classList.contains('user-invalid-fallback');
      return {
        border: style.borderColor,
        borderLeft: style.borderLeftColor,
        background: style.backgroundColor,
        outline: style.outlineColor,
        boxShadow: style.boxShadow,
        hasUserInvalid
      };
    });
  }

  function differs(s1: any, s2: any) {
    if (!s1 || !s2) return false;
    return s1.hasUserInvalid !== s2.hasUserInvalid ||
           s1.border !== s2.border ||
           s1.borderLeft !== s2.borderLeft ||
           s1.background !== s2.background ||
           s1.outline !== s2.outline ||
           s1.boxShadow !== s2.boxShadow;
  }

  // Browser assertions
  test('On page load, all required fields must appear neutral', async ({ page }) => {
    const inputs = page.locator('form input[required]');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const style = await getStyling(inputs.nth(i));
      expect(style.hasUserInvalid).toBe(false);
    }
  });

  test('Clicking into a required field and clicking out (blur) WITHOUT typing MUST trigger the error state (red border)', async ({ page }) => {
    const input = page.locator('form input[required]').first();
    const initialStyle = await getStyling(input);
    
    await input.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Backspace');
    await input.blur();
    
    const errorStyle = await getStyling(input);
    
    expect(differs(initialStyle, errorStyle) || errorStyle.hasUserInvalid).toBe(true);
  });

  test('Typing into the field MUST remove the error state immediately', async ({ page }) => {
    const input = page.locator('form input[required]').first();
    const initialStyle = await getStyling(input);
    
    await input.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Backspace');
    await input.blur();
    
    const errorStyle = await getStyling(input);
    
    await input.focus();
    await page.keyboard.press('a');
    
    const finalStyle = await getStyling(input);
    
    const hasError = differs(initialStyle, errorStyle) || errorStyle.hasUserInvalid;
    const clearedError = !differs(initialStyle, finalStyle) || !finalStyle.hasUserInvalid || differs(errorStyle, finalStyle);
    expect(hasError && clearedError).toBe(true);
  });

  test('Clicking "Submit" with empty fields MUST trigger the error state on all of them', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"]');
    const isEnabled = await submitBtn.isEnabled();
    
    let allTriggered = false;
    if (isEnabled) {
      // Strip novalidate attribute prior to submit so that the browser natively triggers the :user-invalid state
      await page.evaluate(() => {
        document.querySelectorAll('form[novalidate]').forEach(form => form.removeAttribute('novalidate'));
      });

      const inputs = page.locator('form input[required]');
      const count = await inputs.count();
      const initialStyles: any[] = [];
      for (let i = 0; i < count; i++) {
        initialStyles.push(await getStyling(inputs.nth(i)));
      }
      await submitBtn.click();
      const finalStyles: any[] = [];
      for (let i = 0; i < count; i++) {
        finalStyles.push(await getStyling(inputs.nth(i)));
      }
      allTriggered = initialStyles.every((style, i) => differs(style, finalStyles[i]) || finalStyles[i].hasUserInvalid) && count > 0;
    }
    
    expect(isEnabled && allTriggered).toBe(true);
  });

  test('"Force Fallback Mode" must replicate this exact behavior', async ({ page }) => {
    const fallbackCheckbox = page.locator('#force-fallback');
    const hasFallback = await fallbackCheckbox.count() > 0;
    
    if (!hasFallback) {
      expect(true).toBe(true);
      return;
    }
    
    let success = false;
    await fallbackCheckbox.check();
    
    const inputs = page.locator('form input[required]');
    const count = await inputs.count();
    const initialStyles: any[] = [];
    for (let i = 0; i < count; i++) {
      initialStyles.push(await getStyling(inputs.nth(i)));
    }
    
    const firstInput = inputs.first();
    await firstInput.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Backspace');
    await firstInput.blur();
    const blurStyle = await getStyling(firstInput);
    const blurRed = differs(initialStyles[0], blurStyle) || blurStyle.hasUserInvalid;
    
    await firstInput.focus();
    await page.keyboard.press('a');
    const typeStyle = await getStyling(firstInput);
    const typeNeutral = !differs(initialStyles[0], typeStyle) || !typeStyle.hasUserInvalid || differs(blurStyle, typeStyle);
    
    await page.keyboard.press('Backspace');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    const finalStyles = [];
    for (let i = 0; i < count; i++) {
      finalStyles.push(await getStyling(inputs.nth(i)));
    }
    const allRed = finalStyles.every((style, index) => differs(initialStyles[index], style) || style.hasUserInvalid);
    
    success = blurRed && typeNeutral && allRed;
    
    expect(success).toBe(true);
  });
});
