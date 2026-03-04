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
test.describe(`search-hidden-content Expectations: ${demoName}`, () => {
  // Static assertions
  test(`MUST include an explicit JavaScript feature detection check for native support`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasFeatureDetection = html.includes("!('onbeforematch' in HTMLElement.prototype)");
    expect(hasFeatureDetection).toBe(true);
  });

  test(`MUST synchronize UI state using a beforematch event listener`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasBeforematchListener = /addEventListener\(['"`]beforematch['"`]/.test(html);
    expect(hasBeforematchListener).toBe(true);
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
  test(`Elements utilizing the hidden="until-found" attribute MUST NOT have display: none or visibility: hidden applied to them directly`, async ({ page }) => {
    const hasInvalidStyles = await page.evaluate(() => {
      const elements = document.querySelectorAll('[hidden="until-found"]');
      for (let i = 0; i < elements.length; i++) {
        const style = window.getComputedStyle(elements[i]);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return true;
        }
      }
      return false;
    });
    expect(hasInvalidStyles).toBe(false);
  });

  test(`MUST NOT use hidden="until-found" for screen reader only text`, async ({ page }) => {
    const hasSrOnly = await page.evaluate(() => {
      const elements = document.querySelectorAll('[hidden="until-found"]');
      for (let i = 0; i < elements.length; i++) {
        const style = window.getComputedStyle(elements[i]);
        if (elements[i].classList.contains('sr-only') || style.clip === 'rect(0px, 0px, 0px, 0px)') {
          return true;
        }
      }
      return false;
    });
    expect(hasSrOnly).toBe(false);
  });

  test(`MUST NOT use hidden="until-found" for sensitive information or internal data tokens`, async ({ page }) => {
    const hasSensitiveInfo = await page.evaluate(() => {
      const elements = document.querySelectorAll('[hidden="until-found"]');
      for (let i = 0; i < elements.length; i++) {
        const text = elements[i].textContent || '';
        if (/TOKEN=|SECRET=/i.test(text)) {
          return true;
        }
      }
      return false;
    });
    expect(hasSensitiveInfo).toBe(false);
  });
});
