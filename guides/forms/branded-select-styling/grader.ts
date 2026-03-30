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
test.describe(`Branded Select Styling Expectations: ${demoName}`, () => {
  // Static assertions
  test(`MUST apply appearance: base-select to <select>`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/select[\s\S]*?\{[^}]*appearance:\s*base-select/);
  });

  test(`MUST apply appearance: base-select to ::picker(select)`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/::picker\(select\)[\s\S]*?\{[^}]*appearance:\s*base-select/);
  });

  test(`MUST use ::picker(select) to define visual container`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/::picker\(select\)\s*\{[^}]*(?:background|border|padding|color)[^}]*\}/);
  });

  test(`MUST use select::picker-icon`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/select::picker-icon\s*\{/);
  });

  test(`MUST use option::checkmark`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/option::checkmark\s*\{/);
  });

  test(`MUST NOT use JS to toggle dropdown`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasJsToggle = html.includes('addEventListener(\'click\'') && html.includes('classList.toggle');
    expect(hasJsToggle).toBe(false);
  });

  test(`MUST use CSS.supports for progressive enhancement fallback`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasScript = /<script>[\s\S]*?<\/script>/.test(html);
    if (hasScript) {
      const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
      const hasStyleAdjustment = scriptContent.includes('.style.') || scriptContent.includes('classList');
      if (hasStyleAdjustment) {
        expect(scriptContent).toContain('CSS.supports');
      } else {
        expect(true).toBe(true);
      }
    } else {
      expect(true).toBe(true);
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
  test(`MUST include <button> inside <select>`, async ({ page }) => {
    const selectHasButton = await page.evaluate(() => {
      const select = document.querySelector('select');
      return select ? select.querySelector('button') !== null : false;
    });
    expect(selectHasButton).toBe(true);
  });

  test(`MUST include <selectedcontent> in trigger button`, async ({ page }) => {
    const hasSelectedContent = await page.evaluate(() => {
      const btn = document.querySelector('select button');
      return btn ? btn.querySelector('selectedcontent') !== null : false;
    });
    expect(hasSelectedContent).toBe(true);
  });

  test(`MUST NOT contain legacy <selectedoption>`, async ({ page }) => {
    const hasLegacy = await page.evaluate(() => {
      return document.querySelector('selectedoption') !== null;
    });
    expect(hasLegacy).toBe(false);
  });

  test(`<select> MUST have a name attribute`, async ({ page }) => {
    const hasName = await page.evaluate(() => {
      const select = document.querySelector('select');
      return select ? select.hasAttribute('name') : false;
    });
    expect(hasName).toBe(true);
  });

  test(`<select> MUST have an associated <label>`, async ({ page }) => {
    const hasLabel = await page.evaluate(() => {
      const select = document.querySelector('select');
      if (!select) return false;
      const id = select.getAttribute('id');
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return true;
      }
      const parentLabel = select.closest('label');
      return parentLabel !== null;
    });
    expect(hasLabel).toBe(true);
  });
});
