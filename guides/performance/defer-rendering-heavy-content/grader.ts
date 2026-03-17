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
test.describe(`defer-rendering-heavy-content Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Elements with hidden="until-found" must synchronize state using a beforematch event listener`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    if (html.includes('hidden="until-found"')) {
      expect(html).toMatch(/beforematch/);
    }
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
  test(`Elements using content-visibility: auto must be outside the initial viewport`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    const elements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .filter(el => window.getComputedStyle(el).contentVisibility === 'auto')
        .map(el => {
          const rect = el.getBoundingClientRect();
          return { top: rect.top, viewportHeight: window.innerHeight };
        });
    });

    for (const el of elements) {
      expect(el.top).toBeGreaterThanOrEqual(el.viewportHeight);
    }
  });

  test(`Elements using content-visibility: auto must define a contain-intrinsic-size`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    const sizes = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .filter(el => window.getComputedStyle(el).contentVisibility === 'auto')
        .map(el => window.getComputedStyle(el).containIntrinsicSize);
    });

    for (const size of sizes) {
      // The initial value or un-set value might compute to 'none', 'none none', or 'auto none'
      // A valid explicitly provided size will contain a dimension (like 'px')
      expect(size).toMatch(/\d/);
    }
  });

  test(`Elements with hidden="until-found" must not have display: none or visibility: hidden`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    const hiddenElements = await page.locator('[hidden="until-found"]').all();
    
    for (const locator of hiddenElements) {
      const styles = await locator.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return { display: computed.display, visibility: computed.visibility };
      });
      
      expect(styles.display).not.toBe('none');
      expect(styles.visibility).not.toBe('hidden');
    }
  });

});
