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

test.describe(`content-based-styling Expectations: ${demoName}`, () => {
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

  test('The implementation includes container elements where some contain a specific descendant element and others do not', async ({ page }) => {
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
        } catch {}
        if (container) break;
      }

      if (!container || !child) return false;

      const withChild = document.querySelector(`${container}:has(${child})`);
      const withoutChild = document.querySelector(`${container}:not(:has(${child}))`);
      return Boolean(withChild && withoutChild);
    });

    expect(hasValidContainers).toBe(true);
  });

  test('The content-based styling is implemented with CSS using the :has() selector on the container', async ({ page }) => {
    const hasRuleWithHas = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSStyleRule && rule.selectorText && rule.selectorText.includes(':has(')) {
              return true;
            }
          }
        } catch {}
      }
      return false;
    });

    expect(hasRuleWithHas).toBe(true);
  });

  test('The visual styling or layout of the container element changes based on the presence of that specific descendant element', async ({ page }) => {
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
        } catch {}
        if (container) break;
      }

      if (!container || !child) return false;

      const withChild = document.querySelector(`${container}:has(${child})`);
      const withoutChild = document.querySelector(`${container}:not(:has(${child}))`);

      if (!withChild || !withoutChild) return false;

      const styleWith = window.getComputedStyle(withChild);
      const styleWithout = window.getComputedStyle(withoutChild);

      const properties = ['flex-direction', 'display', 'background-color', 'grid-template-columns', 'padding', 'gap', 'align-items'];
      for (const prop of properties) {
        if (styleWith.getPropertyValue(prop) !== styleWithout.getPropertyValue(prop)) {
          return true;
        }
      }
      return false;
    });

    expect(isStylingDifferent).toBe(true);
  });
});
