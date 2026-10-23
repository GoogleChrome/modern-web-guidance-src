import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
test.describe(`content-based-styling Expectations: ${demoName}`, () => {
  // Static assertions
  test(`Must implement styling primarily using the CSS :has() pseudo-class`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:has\(/);
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
  test(`Must include a container element that may or may not contain a specific child element`, async ({ page }) => {
    const hasValidContainers = await page.evaluate(() => {
      let container = '';
      let child = '';
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && rule.selectorText) {
              const match = rule.selectorText.match(/(?:^|\s|>|\+|~)([a-zA-Z0-9\-_.]+):has\(([^)]+)\)/);
              if (match && !rule.selectorText.includes(':not(:has')) {
                container = match[1];
                child = match[2];
                break;
              }
            }
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
            continue;
          }
          throw e;
        }
        if (container) break;
      }
      
      if (!container || !child) return false;
      
      const withChild = document.querySelector(`${container}:has(${child})`);
      const withoutChild = document.querySelector(`${container}:not(:has(${child}))`);
      return !!withChild && !!withoutChild;
    });
    
    expect(hasValidContainers).toBe(true);
  });

  test(`Container element styling must change based on the presence of the child element`, async ({ page }) => {
    const isStylingDifferent = await page.evaluate(() => {
      let container = '';
      let child = '';
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && rule.selectorText) {
              const match = rule.selectorText.match(/(?:^|\s|>|\+|~)([a-zA-Z0-9\-_.]+):has\(([^)]+)\)/);
              if (match && !rule.selectorText.includes(':not(:has')) {
                container = match[1];
                child = match[2];
                break;
              }
            }
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
            continue;
          }
          throw e;
        }
        if (container) break;
      }
      
      if (!container || !child) return false;
      
      const withChild = document.querySelector(`${container}:has(${child})`);
      const withoutChild = document.querySelector(`${container}:not(:has(${child}))`);
      
      if (!withChild || !withoutChild) return false;
      
      const styleWith = window.getComputedStyle(withChild);
      const styleWithout = window.getComputedStyle(withoutChild);
      
      const properties = ['flex-direction', 'display', 'background-color', 'grid-template-columns', 'padding'];
      for (const prop of properties) {
        if (styleWith.getPropertyValue(prop) !== styleWithout.getPropertyValue(prop)) {
          return true;
        }
      }
      return false;
    });
    
    expect(isStylingDifferent).toBe(true);
  });

  test(`The :has() selector must be scoped to the specific component container rather than broad ancestors like body or html`, async ({ page }) => {
    const isScopedToComponent = await page.evaluate(() => {
      let foundScopedHas = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && rule.selectorText && rule.selectorText.includes(':has(')) {
              const selectors = rule.selectorText.split(',').map((s) => s.trim());
              for (const sel of selectors) {
                if (!sel.includes(':has(')) continue;
                const prefix = sel.split(':has(')[0].trim();
                if (!prefix || /^(html|body|:root|\*)$/i.test(prefix)) {
                  return false;
                }
                foundScopedHas = true;
              }
            }
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'SecurityError') {
            continue;
          }
          throw e;
        }
      }
      return foundScopedHas;
    });

    expect(isScopedToComponent).toBe(true);
  });
});
