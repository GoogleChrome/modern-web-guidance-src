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

  test('the p element should have a computed text-wrap value of pretty', async ({ page }) => {
    const p = page.locator('p').first();
    await expect(p).toBeVisible();
    const textWrap = await p.evaluate(el => window.getComputedStyle(el).textWrap || window.getComputedStyle(el).getPropertyValue('text-wrap'));
    expect(textWrap).toBe('pretty');
  });

  test('the h1 element should NOT have a computed text-wrap value of pretty', async ({ page }) => {
    const h1 = page.locator('h1').first();
    // If no h1 exists, it technically doesn't have 'pretty', but for the sake of this grader 
    // we expect an h1 to be present AND not have the property to pass.
    await expect(h1).toBeVisible();
    const textWrap = await h1.evaluate(el => window.getComputedStyle(el).textWrap || window.getComputedStyle(el).getPropertyValue('text-wrap'));
    expect(textWrap).not.toBe('pretty');
  });

  test('the text-wrap property should not be applied to the * universal selector', async ({ page }) => {
    // We check the <html> element as a proxy for the universal selector's effect on non-p elements
    const html = page.locator('html');
    const textWrap = await html.evaluate(el => window.getComputedStyle(el).textWrap || window.getComputedStyle(el).getPropertyValue('text-wrap'));
    expect(textWrap).not.toBe('pretty');
  });

  test('the text-wrap property should not be applied to the body element', async ({ page }) => {
    const body = page.locator('body');
    const textWrap = await body.evaluate(el => window.getComputedStyle(el).textWrap || window.getComputedStyle(el).getPropertyValue('text-wrap'));
    expect(textWrap).not.toBe('pretty');
  });

  test('the text-wrap: balance property should not be used for this optimization', async ({ page }) => {
    const p = page.locator('p').first();
    const textWrap = await p.evaluate(el => window.getComputedStyle(el).textWrap || window.getComputedStyle(el).getPropertyValue('text-wrap'));
    // The optimization requires 'pretty'. If it's 'wrap' or 'balance', it's incorrect.
    expect(textWrap).toBe('pretty');
  });

  test('semantic elements like <main> or <section> should be used to organize content', async ({ page }) => {
    const semanticContainer = page.locator('main, section').first();
    await expect(semanticContainer).toBeVisible();
  });

  test('the implementation should provide multiple paragraphs of long-form content', async ({ page }) => {
    const paragraphs = page.locator('p');
    const count = await paragraphs.count();
    expect(count).toBeGreaterThan(1);
  });

});
