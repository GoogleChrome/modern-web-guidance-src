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

test.describe(`Defer rendering heavy content Expectations: ${demoName}`, () => {
  // Static assertions
  test('Elements with content-visibility: auto must declare contain-intrinsic-size', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const autoBlocks = html.match(/\{[^}]*content-visibility:\s*auto[^}]*\}/g) || [];
    const allHaveSize = autoBlocks.length > 0 && autoBlocks.every(block => /contain-intrinsic-size:/.test(block));
    expect(allHaveSize).toBe(true);
  });

  test('Toggled off-screen content must use content-visibility: hidden', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasHidden = /content-visibility:\s*hidden/.test(html);
    expect(hasHidden).toBe(true);
  });

  // Setup browser testing
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

  // Browser assertions
  test('content-visibility: auto elements must be applied to off-screen content and not in the initial viewport', async ({ page }) => {
    const isValid = await page.evaluate(() => {
      const autoElements = Array.from(document.querySelectorAll('*'))
        .filter(el => window.getComputedStyle(el).contentVisibility === 'auto');
      
      if (autoElements.length === 0) return false;
      
      const anyInViewport = autoElements.some(el => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      });
      
      return !anyInViewport;
    });
    
    expect(isValid).toBe(true);
  });

  test('hidden="until-found" elements must not have display or visibility CSS properties applied', async ({ page }) => {
    const isValid = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('[hidden="until-found"]'));
      if (elements.length === 0) return false;
      
      return elements.every(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    });
    
    expect(isValid).toBe(true);
  });

  test('hidden="until-found" elements must synchronize UI state via beforematch event', async ({ page }) => {
    const isSynchronized = await page.evaluate(() => {
      const hiddenEl = document.querySelector('[hidden="until-found"]');
      if (!hiddenEl) return false;
      
      const buttons = Array.from(document.querySelectorAll('button[aria-expanded="false"]'));
      if (buttons.length === 0) return false;
      
      hiddenEl.dispatchEvent(new Event('beforematch'));
      
      return buttons.some(btn => btn.getAttribute('aria-expanded') === 'true');
    });
    
    expect(isSynchronized).toBe(true);
  });
});
