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
test.describe(`conditional-async-dependencies Expectations: ${demoName}`, () => {
  // Static assertions
  test(`checks if popover is in HTMLElement.prototype to determine if a polyfill is needed`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/['"]popover['"]\s+in\s+HTMLElement\.prototype/);
  });

  test(`dynamic import is executed using top-level await`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/await\s+import\s*\(/);
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
  test(`conditionally loaded logic is implemented within a single module entry point`, async ({ page }) => {
    const moduleScripts = await page.locator('script[type="module"]').count();
    expect(moduleScripts).toBe(1);
  });

  test(`functional popover element and a button with a popovertarget attribute are present`, async ({ page }) => {
    const button = page.locator('button[popovertarget]').first();
    await expect(button).toBeAttached();
    
    const targetId = await button.getAttribute('popovertarget');
    expect(targetId).toBeTruthy();

    if (targetId) {
      const popover = page.locator(`#${targetId}[popover]`);
      await expect(popover).toBeAttached();
    }
  });
});
