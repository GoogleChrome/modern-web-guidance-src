import { test, expect, type Locator } from '@playwright/test';
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

test.describe(`Accessible Error Announcement Expectations: ${demoName}`, () => {
  // Static assertions
  test(`[Static] The aria-invalid attribute must NOT be present on page load in HTML source`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check if any input element has aria-invalid hardcoded in the HTML
    const hasAriaInvalidOnInput = /<input[^>]*aria-invalid/i.test(html);
    expect(hasAriaInvalidOnInput).toBe(false);
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

  const getAriaInvalid = async (locator: Locator) => {
    const val = await locator.getAttribute('aria-invalid');
    return (val === null || val === 'false') ? 'false' : val;
  };

  // Browser assertions
  test(`[Browser] Tabbing through a field without typing should NOT trigger aria-invalid="true"`, async ({ page }) => {
    const usernameInput = page.locator('#username');
    const stateBefore = await getAriaInvalid(usernameInput);
    
    await usernameInput.focus();
    await usernameInput.blur();
    
    const stateAfter = await getAriaInvalid(usernameInput);
    expect(`${stateBefore} -> ${stateAfter}`).toBe('false -> false');
  });

  test(`[Browser] Typing an invalid value and blurring MUST set aria-invalid="true"`, async ({ page }) => {
    const emailInput = page.locator('#email');
    const stateBefore = await getAriaInvalid(emailInput);
    
    await emailInput.fill('bad-email');
    await emailInput.blur();
    
    const stateAfter = await getAriaInvalid(emailInput);
    expect(`${stateBefore} -> ${stateAfter}`).toBe('false -> true');
  });

  test(`[Browser] Correcting the value to a valid format MUST remove the aria-invalid attribute immediately on input`, async ({ page }) => {
    const emailInput = page.locator('#email');
    await emailInput.fill('bad-email');
    await emailInput.blur();
    
    // Now correct the value without blurring
    await emailInput.fill('test@example.com');
    
    const stateAfterCorrection = await getAriaInvalid(emailInput);
    expect(stateAfterCorrection).toBe('false');
  });

  test(`[Browser] The visual error message visibility must match the aria-invalid state`, async ({ page }) => {
    const emailInput = page.locator('#email');
    const errorMessage = page.locator('#email-error');
    
    const getStates = async () => {
      const ariaInvalid = await getAriaInvalid(emailInput);
      const isVisible = await errorMessage.isVisible();
      return `${ariaInvalid === 'true'} === ${isVisible}`;
    };
    
    const states: string[] = [];
    
    // 1. Initial load
    states.push(await getStates());
    
    // 2. Focus and blur empty
    await emailInput.focus();
    await emailInput.blur();
    states.push(await getStates());
    
    // 3. Type invalid and blur
    await emailInput.fill('bad');
    await emailInput.blur();
    states.push(await getStates());
    
    // 4. Correct to valid (no blur)
    await emailInput.fill('test@example.com');
    states.push(await getStates());
    
    const allMatch = states.every(s => {
      const [aria, vis] = s.split(' === ');
      return aria === vis;
    });
    
    expect(allMatch).toBe(true);
  });
});
