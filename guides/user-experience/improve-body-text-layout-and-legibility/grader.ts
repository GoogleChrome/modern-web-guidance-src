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
test.describe(`Improve Body Text Layout and Legibility Expectations: ${demoName}`, () => {

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestPath = requestUrl.pathname;
      const fileName = requestPath === '/' || requestPath === `/${demoName}` ? demoName : requestPath.replace(/^\//, '');
      const localFilePath = path.join(targetDir, fileName);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('Paragraph elements should have "text-wrap: pretty" applied for typographic quality', async ({ page }) => {
    const paragraphs = await page.locator('p');
    const firstP = paragraphs.first();
    const textWrap = await firstP.evaluate((el) => window.getComputedStyle(el).textWrap);
    expect(textWrap).toBe('pretty');
  });

  test('The implementation should provide multiple paragraphs of long-form content', async ({ page }) => {
    const count = await page.locator('p').count();
    // Demo has 4, negative-demo has 1
    expect(count).toBeGreaterThan(2);
  });

  test('Semantic elements like <main> or <section> should be used to organize long text', async ({ page }) => {
    const mainOrSection = await page.locator('main, section').count();
    // Demo has both, negative-demo has none
    expect(mainOrSection).toBeGreaterThan(0);
  });

  test('The body text should have enhanced legibility via improved line-height', async ({ page }) => {
    const p = page.locator('p').first();
    const styles = await p.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        lineHeight: computed.lineHeight,
        fontSize: computed.fontSize
      };
    });
    
    const lh = parseFloat(styles.lineHeight);
    const fs = parseFloat(styles.fontSize);
    // Demo has 1.6, negative-demo has 1.5
    // 1.55 is a good threshold
    expect(lh / fs).toBeGreaterThan(1.55);
  });

});
