import { test, expect } from '@playwright/test';
import * as path from 'path';

// Use TARGET_FILE environment variable or default to demo.html
const targetFile = process.env.TARGET_FILE 
  ? (path.isAbsolute(process.env.TARGET_FILE) ? process.env.TARGET_FILE : path.join(process.cwd(), process.env.TARGET_FILE))
  : path.join(process.cwd(), 'demo.html');

test.describe('CSS if() Grader', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the target file
    await page.goto(`file://${targetFile}`);
    
    // Inject conflicting styles to the body.
    // If the .card doesn't explicitly set its own background-color and color,
    // it will either be transparent (failing the white bg test)
    // or inherit these conflicting values (failing the black color test).
    await page.addStyleTag({
      content: `
        body {
          color: rgb(123, 123, 123) !important;
          background-color: rgb(234, 234, 234) !important;
        }
      `
    });
  });

  test('The .card element MUST have a background-color of rgb(255, 255, 255) by default', async ({ page }) => {
    const card = page.locator('.card').first();
    const bgColor = await card.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toBe('rgb(255, 255, 255)');
  });

  test('The .card element MUST have a color of rgb(0, 0, 0) by default', async ({ page }) => {
    const card = page.locator('.card').first();
    const color = await card.evaluate((el) => window.getComputedStyle(el).color);
    expect(color).toBe('rgb(0, 0, 0)');
  });

  test('When document.body has the class "dark", the .card element MUST have a background-color of rgb(0, 0, 0)', async ({ page }) => {
    await page.evaluate(() => document.body.classList.add('dark'));
    const card = page.locator('.card').first();
    const bgColor = await card.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toBe('rgb(0, 0, 0)');
  });

  test('When document.body has the class "dark", the .card element MUST have a color of rgb(255, 255, 255)', async ({ page }) => {
    await page.evaluate(() => document.body.classList.add('dark'));
    const card = page.locator('.card').first();
    const color = await card.evaluate((el) => window.getComputedStyle(el).color);
    expect(color).toBe('rgb(255, 255, 255)');
  });

  test('When the viewport width is less than 600px, the .card element MUST have a padding of 16px', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 800 });
    const card = page.locator('.card').first();
    const paddingTop = await card.evaluate((el) => window.getComputedStyle(el).paddingTop);
    expect(paddingTop).toBe('16px');
  });

  test('When the viewport width is 600px or greater, the .card element MUST have a padding of 32px', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 });
    const card = page.locator('.card').first();
    const paddingTop = await card.evaluate((el) => window.getComputedStyle(el).paddingTop);
    expect(paddingTop).toBe('32px');
  });
});
