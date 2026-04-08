/// <reference types="node" />
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Improve Body Text Layout and Legibility Expectations: ${demoName}`, () => {

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

  test('Paragraph elements should have "text-wrap: pretty" applied', async ({ page }) => {
    const p = page.locator('p').first();
    await expect(p).toBeVisible();
    const textWrap = await p.evaluate((el) => window.getComputedStyle(el).getPropertyValue('text-wrap'));
    expect(textWrap).toBe('pretty');
  });

  test('The h1 element does NOT have a computed text-wrap value of pretty', async ({ page }) => {
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    const textWrap = await h1.evaluate((el) => window.getComputedStyle(el).getPropertyValue('text-wrap'));
    expect(textWrap).not.toBe('pretty');
  });

  test('The text-wrap property is not applied to the body element', async ({ page }) => {
    const body = page.locator('body');
    const textWrap = await body.evaluate((el) => window.getComputedStyle(el).getPropertyValue('text-wrap'));
    expect(textWrap).not.toBe('pretty');
  });

  test('The text-wrap property is not applied to the * universal selector', async ({ page }) => {
    const html = page.locator('html');
    const textWrap = await html.evaluate((el) => window.getComputedStyle(el).getPropertyValue('text-wrap'));
    expect(textWrap).not.toBe('pretty');
  });

  test('The implementation should provide multiple paragraphs of long-form content', async ({ page }) => {
    const count = await page.locator('p').count();
    expect(count).toBeGreaterThan(2);
  });

  test('Semantic elements like <main> or <section> should be used to organize long text', async ({ page }) => {
    const mainOrSection = await page.locator('main, section').count();
    expect(mainOrSection).toBeGreaterThan(0);
  });

});
