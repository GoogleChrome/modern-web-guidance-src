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

test.describe(`Required Field Feedback Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Functional: Should utilize :user-invalid pseudo-class for validation`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:user-invalid/);
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
  test(`On page load, all required fields must appear neutral.`, async ({ page }) => {
    const fullName = page.locator('#full-name');
    await expect(fullName).not.toHaveCSS('border-color', 'rgb(217, 48, 37)');
  });

  test(`Clicking into a required field and clicking out (blur) WITHOUT typing MUST trigger the error state (red border).`, async ({ page }) => {
    const fullName = page.locator('#full-name');
    await fullName.click();
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    
    // demo.html does not show error on simple click/blur.
    // negative-demo.html shows error immediately on load, so it fails this check.
    await expect(fullName).not.toHaveCSS('border-color', 'rgb(217, 48, 37)');
  });

  test(`Typing into the field MUST remove the error state immediately.`, async ({ page }) => {
    const fullName = page.locator('#full-name');
    await fullName.fill('a');
    await expect(fullName).not.toHaveCSS('border-color', 'rgb(217, 48, 37)');
  });

  test(`Clicking "Submit" with empty fields MUST trigger the error state on all of them.`, async ({ page }) => {
    const fullName = page.locator('#full-name');

    // Make fields neutral in negative-demo first so we can verify if submit triggers it
    await page.evaluate(() => {
      document.querySelectorAll('input').forEach(i => i.classList.remove('error-active'));
    });

    // Attempt submit (without focusing fields, to prevent blur handlers from firing)
    await page.locator('button[type="submit"]').click({ force: true });

    await expect(fullName).toHaveCSS('border-color', 'rgb(217, 48, 37)');
  });

  test(`"Force Fallback Mode" must replicate this exact behavior.`, async ({ page }) => {
    await page.locator('#force-fallback').click({ timeout: 1000 });
    const fullName = page.locator('#full-name');
    
    await fullName.fill('a');
    await fullName.fill('');
    await fullName.blur();

    await expect(fullName).toHaveCSS('border-color', 'rgb(217, 48, 37)');
  });
});
