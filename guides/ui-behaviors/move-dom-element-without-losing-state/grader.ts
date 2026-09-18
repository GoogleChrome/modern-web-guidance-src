import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`move-before Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.slice(1));

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('Document contains a stateful element (iframe, input, video, or audio)', async ({ page }) => {
    const statefulElements = await page.locator('iframe, input, video, audio').count();
    expect(statefulElements).toBeGreaterThan(0);
  });

  test('Script contains a feature detection check for moveBefore', async ({ page }) => {
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.innerText);
    });
    const content = scripts.join('\n');
    
    const hasFeatureDetection = /['"`]moveBefore['"`]\s*in\s+(?:Element\.prototype|document|window)/.test(content) ||
                                /typeof\s+[\w.]+\.moveBefore\s*===?\s*['"`]function['"`]/.test(content) ||
                                /if\s*\(\s*[\w.]+\.moveBefore\s*\)/.test(content);
                                
    expect(hasFeatureDetection).toBeTruthy();
  });

  test('Script uses moveBefore to move an element', async ({ page }) => {
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.innerText);
    });
    const content = scripts.join('\n');
    
    const usesMoveBefore = /\.moveBefore\s*\(/.test(content);
    expect(usesMoveBefore).toBeTruthy();
  });

  test('Script falls back to using insertBefore or appendChild', async ({ page }) => {
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent || s.innerText);
    });
    const content = scripts.join('\n');
    
    const usesFallback = /\.insertBefore\s*\(|\.appendChild\s*\(/.test(content);
    expect(usesFallback).toBeTruthy();
  });

});
