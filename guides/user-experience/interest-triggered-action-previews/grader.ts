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
test.describe(`Interest-Triggered Action Previews Expectations: ${demoName}`, () => {

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestPath = requestUrl.pathname;
      const relativePath = requestPath === '/' ? demoName : requestPath.substring(1);
      const localFilePath = path.join(targetDir, relativePath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
    // Wait for the polyfill to potentially load and the page to be ready
    await page.waitForLoadState('networkidle');
  });

  test('Invoker element should have "interestfor" attribute pointing to a target ID', async ({ page }) => {
    const invoker = page.locator('[interestfor]');
    await expect(invoker.first()).toBeVisible();
  });

  test('Target element should exist with ID matching the "interestfor" attribute', async ({ page }) => {
    const invoker = page.locator('[interestfor]').first();
    const targetId = await invoker.getAttribute('interestfor');
    const target = page.locator(`#${targetId}`);
    await expect(target).toBeVisible();
  });

  test('Target element should receive "interest" event when an invoker is interacted with', async ({ page }) => {
    const invoker = page.locator('[interestfor]').first();
    const targetId = await invoker.getAttribute('interestfor');

    await page.evaluate((id) => {
      const target = document.getElementById(id!);
      if (!target) return;
      (window as any).__interestFired = false;
      target.addEventListener('interest', () => {
        (window as any).__interestFired = true;
      });
    }, targetId);

    // Hover to trigger interest
    await invoker.hover();
    
    // Interest invokers may have a delay (default or CSS). 
    // We wait a reasonable amount of time for the event to fire.
    await page.waitForTimeout(600);

    const fired = await page.evaluate(() => (window as any).__interestFired);
    expect(fired).toBe(true);
  });

  test('Target element should receive "loseinterest" event when interaction ends', async ({ page }) => {
    const invoker = page.locator('[interestfor]').first();
    const targetId = await invoker.getAttribute('interestfor');

    await page.evaluate((id) => {
      const target = document.getElementById(id!);
      if (!target) return;
      (window as any).__loseInterestFired = false;
      target.addEventListener('loseinterest', () => {
        (window as any).__loseInterestFired = true;
      });
    }, targetId);

    // Trigger interest then lose it
    await invoker.hover();
    await page.waitForTimeout(600);
    await page.mouse.move(0, 0); // Move away from the invoker
    await page.waitForTimeout(600);

    const fired = await page.evaluate(() => (window as any).__loseInterestFired);
    expect(fired).toBe(true);
  });

  test('Target element should display a preview state when interest is triggered', async ({ page }) => {
    const invoker = page.locator('[interestfor]').first();
    const targetId = await invoker.getAttribute('interestfor');
    const target = page.locator(`#${targetId}`);

    // Get initial state
    const initialState = await target.evaluate(el => ({
      color: window.getComputedStyle(el).backgroundColor,
      text: el.textContent?.trim()
    }));

    // Trigger interest
    await invoker.hover();
    await page.waitForTimeout(600);

    const previewState = await target.evaluate(el => ({
      color: window.getComputedStyle(el).backgroundColor,
      text: el.textContent?.trim()
    }));

    // Expect either style or content to have changed
    const hasChanged = previewState.color !== initialState.color || previewState.text !== initialState.text;
    expect(hasChanged).toBe(true);
  });

  test('Interest invoker polyfill should be conditionally loaded', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.map(s => s.textContent || s.src).join('\n');
    });

    // Check for conditional loading pattern: check for property then import/load
    const isConditional = (scriptContent.includes('interestForElement') || scriptContent.includes('interestfor')) &&
                          (scriptContent.includes('hasOwnProperty') || scriptContent.includes('if (!'));
    
    expect(isConditional).toBe(true);
  });

});
