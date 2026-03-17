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

test.describe(`Validate Input After Interaction Expectations: ${demoName}`, () => {

  // Static assertions
  test(`HTML MUST NOT use generic :invalid pseudo-class for validation styling`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Ensure we don't accidentally match user-invalid if we only search for invalid, 
    // so we search for input:invalid specifically
    const hasInvalid = html.includes('input:invalid');
    expect(hasInvalid).toBe(false);
  });

  test(`HTML MUST use :user-invalid pseudo-class for validation styling`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasUserInvalid = html.includes(':user-invalid');
    expect(hasUserInvalid).toBe(true);
  });

  test(`HTML MUST use aria-errormessage for email field`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasAriaErrormessage = html.includes('aria-errormessage="email-error"');
    expect(hasAriaErrormessage).toBe(true);
  });

  test(`HTML MUST use aria-describedby for password field`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasAriaDescribedby = html.includes('aria-describedby="password-rules"');
    expect(hasAriaDescribedby).toBe(true);
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

  // Browser assertions: Email
  test(`Email input MUST have a neutral border on page load`, async ({ page }) => {
    const email = page.locator('#email');
    const color = await email.evaluate(el => getComputedStyle(el).borderColor);
    expect(color).not.toBe('rgb(217, 48, 37)');
  });

  test(`Typing incomplete email and blurring MUST trigger a red border for email`, async ({ page }) => {
    const email = page.locator('#email');
    const states = [];
    states.push(await email.evaluate(el => getComputedStyle(el).borderColor));
    await email.fill('incomplete@');
    states.push(await email.evaluate(el => getComputedStyle(el).borderColor));
    await email.blur(); await page.waitForTimeout(250);
    states.push(await email.evaluate(el => getComputedStyle(el).borderColor));
    
    const isRed = (c: string) => c === 'rgb(217, 48, 37)';
    const result = states.map(isRed);
    expect(result).toEqual([false, false, true]);
  });

  test(`Typing incomplete email and blurring MUST make the email error message visible`, async ({ page }) => {
    const errorMsg = page.locator('#email-error');
    const email = page.locator('#email');
    const states = [];
    
    states.push(await errorMsg.evaluate(el => getComputedStyle(el).display));
    await email.fill('incomplete@');
    states.push(await errorMsg.evaluate(el => getComputedStyle(el).display));
    await email.blur(); await page.waitForTimeout(250);
    states.push(await errorMsg.evaluate(el => getComputedStyle(el).display));
    
    const isVisible = (d: string) => d !== 'none';
    const result = states.map(isVisible);
    expect(result).toEqual([false, false, true]);
  });

  test(`Typing a valid email MUST remove the error state immediately or after blur`, async ({ page }) => {
    const email = page.locator('#email');
    
    const initialColor = await email.evaluate(el => getComputedStyle(el).borderColor);
    await email.fill('incomplete@');
    await email.blur(); await page.waitForTimeout(250);
    const invalidColor = await email.evaluate(el => getComputedStyle(el).borderColor);
    await email.fill('valid@email.com');
    const validTypingColor = await email.evaluate(el => getComputedStyle(el).borderColor);
    await email.blur(); await page.waitForTimeout(250);
    const validBlurColor = await email.evaluate(el => getComputedStyle(el).borderColor);
    
    const isRed = (c: string) => c === 'rgb(217, 48, 37)';
    
    const result = {
      initialRed: isRed(initialColor),
      invalidRed: isRed(invalidColor),
      validRemoved: !isRed(validTypingColor) || !isRed(validBlurColor)
    };
    
    expect(result).toEqual({
      initialRed: false,
      invalidRed: true,
      validRemoved: true
    });
  });

  test(`Submitting the form with an empty email field MUST trigger the email error state`, async ({ page }) => {
    const email = page.locator('#email');
    const submit = page.locator('button[type="submit"]');
    
    const initialColor = await email.evaluate(el => getComputedStyle(el).borderColor);
    await submit.click(); await page.waitForTimeout(250);
    const finalColor = await email.evaluate(el => getComputedStyle(el).borderColor);
    
    const isRed = (c: string) => c === 'rgb(217, 48, 37)';
    const result = {
      wasRed: isRed(initialColor),
      becameRed: isRed(finalColor)
    };
    
    expect(result).toEqual({ wasRed: false, becameRed: true });
  });

  // Browser assertions: Password
  test(`Password field MUST appear neutral on page load`, async ({ page }) => {
    const password = page.locator('#password');
    const color = await password.evaluate(el => getComputedStyle(el).borderColor);
    expect(color).not.toBe('rgb(217, 48, 37)');
  });

  test(`Password requirements list MUST be visible and neutral color on page load`, async ({ page }) => {
    const rules = page.locator('#password-rules');
    const display = await rules.evaluate(el => getComputedStyle(el).display);
    const color = await rules.evaluate(el => getComputedStyle(el).color);
    
    const result = {
      isVisible: display !== 'none',
      isRed: color === 'rgb(217, 48, 37)'
    };
    
    expect(result).toEqual({ isVisible: true, isRed: false });
  });

  test(`Clicking into the empty password field and blurring MUST NOT trigger red border`, async ({ page }) => {
    const password = page.locator('#password');
    
    const initialColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    await password.focus();
    const focusColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    await password.blur(); await page.waitForTimeout(250);
    const blurColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    
    const isRed = (c: string) => c === 'rgb(217, 48, 37)';
    const result = [isRed(initialColor), isRed(focusColor), isRed(blurColor)];
    
    expect(result).toEqual([false, false, false]);
  });

  test(`Typing a partial password and blurring MUST trigger a red border`, async ({ page }) => {
    const password = page.locator('#password');
    
    const initialColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    await password.fill('Pass');
    const typingColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    await password.blur(); await page.waitForTimeout(250);
    const blurColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    
    const isRed = (c: string) => c === 'rgb(217, 48, 37)';
    const result = [isRed(initialColor), isRed(typingColor), isRed(blurColor)];
    
    expect(result).toEqual([false, false, true]);
  });

  test(`Typing a partial password and blurring MUST change requirements list text color to red`, async ({ page }) => {
    const password = page.locator('#password');
    const rules = page.locator('#password-rules');
    
    const initialColor = await rules.evaluate(el => getComputedStyle(el).color);
    await password.fill('Pass');
    const typingColor = await rules.evaluate(el => getComputedStyle(el).color);
    await password.blur(); await page.waitForTimeout(250);
    const blurColor = await rules.evaluate(el => getComputedStyle(el).color);
    
    const isRed = (c: string) => c === 'rgb(217, 48, 37)';
    const result = [isRed(initialColor), isRed(typingColor), isRed(blurColor)];
    
    expect(result).toEqual([false, false, true]);
  });

  test(`Typing a valid password MUST remove the error state immediately or after blur`, async ({ page }) => {
    const password = page.locator('#password');
    
    const initialColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    await password.fill('Pass');
    await password.blur(); await page.waitForTimeout(250);
    const invalidColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    
    await password.fill('Password123!');
    const validTypingColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    await password.blur(); await page.waitForTimeout(250);
    const validBlurColor = await password.evaluate(el => getComputedStyle(el).borderColor);
    
    const isRed = (c: string) => c === 'rgb(217, 48, 37)';
    const result = {
      initialRed: isRed(initialColor),
      invalidRed: isRed(invalidColor),
      validRemoved: !isRed(validTypingColor) || !isRed(validBlurColor)
    };
    
    expect(result).toEqual({ initialRed: false, invalidRed: true, validRemoved: true });
  });

  // Fallback mode assertions
  test(`Fallback mode: Email MUST trigger error state only after blurring incomplete input`, async ({ page }) => {
    const fallback = page.locator('#force-fallback');
    const count = await fallback.count();
    
    const states = [];
    if (count > 0) {
      await fallback.check();
      const email = page.locator('#email');
      states.push(await email.evaluate(el => getComputedStyle(el).borderColor));
      await email.fill('incomplete@');
      states.push(await email.evaluate(el => getComputedStyle(el).borderColor));
      await email.blur(); await page.waitForTimeout(250);
      states.push(await email.evaluate(el => getComputedStyle(el).borderColor));
    }
    
    const isRed = (c: string) => c === 'rgb(217, 48, 37)';
    const result = count > 0 ? states.map(isRed) : 'missing_checkbox';
    
    expect(result).toEqual([false, false, true]);
  });

  test(`Fallback mode: Password MUST trigger error state only after blurring partial input`, async ({ page }) => {
    const fallback = page.locator('#force-fallback');
    const count = await fallback.count();
    
    const states = [];
    if (count > 0) {
      await fallback.check();
      const password = page.locator('#password');
      states.push(await password.evaluate(el => getComputedStyle(el).borderColor));
      await password.fill('Pass');
      states.push(await password.evaluate(el => getComputedStyle(el).borderColor));
      await password.blur(); await page.waitForTimeout(250);
      states.push(await password.evaluate(el => getComputedStyle(el).borderColor));
    }
    
    const isRed = (c: string) => c === 'rgb(217, 48, 37)';
    const result = count > 0 ? states.map(isRed) : 'missing_checkbox';
    
    expect(result).toEqual([false, false, true]);
  });
});
