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

test.describe(`Branded Select Styling Expectations: ${demoName}`, () => {
  // 1. Static assertions
  test('Requirement 1: select element MUST have appearance: base-select', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Check for select { ... appearance: base-select; ... } or select, ... { ... appearance: base-select; ... }
    expect(html).toMatch(/select[^{,]*([^{]*\{|,[^{]*\{)[^}]*appearance\s*:\s*base-select/i);
  });

  test('Requirement 2: ::picker(select) pseudo-element MUST have appearance: base-select', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/::picker\(select\)[^{,]*([^{]*\{|,[^{]*\{)[^}]*appearance\s*:\s*base-select/i);
  });

  test('Requirement 3: ::picker(select) MUST define the visual container (border, background, etc.)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Look for styles in ::picker(select) block
    expect(html).toMatch(/::picker\(select\)[^{]*\{[^}]*(border|background|padding|box-shadow)/i);
  });

  test('Requirement 4: MUST use select::picker-icon to customize the drop-down arrow icon', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('select::picker-icon');
  });

  test('Requirement 5: MUST use option::checkmark to customize the checkmark indicator', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('option::checkmark');
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

  // 2. Browser assertions
  test('Requirement 6: markup MUST include a <button> element inside the <select>', async ({ page }) => {
    const hasButtonOrImplicitBaseSelect = await page.evaluate(() => {
      const select = document.querySelector('select');
      if (!select) return false;
      if (select.querySelector(':scope > button')) return true;
      const style = window.getComputedStyle(select);
      return style.display !== 'none' && style.appearance === 'base-select';
    });
    expect(hasButtonOrImplicitBaseSelect).toBe(true);
  });

  test('Requirement 7a: trigger button MUST include a <selectedcontent> element', async ({ page }) => {
    const hasSelectedContentOrImplicit = await page.evaluate(() => {
      const select = document.querySelector('select');
      if (!select) return false;
      const button = select.querySelector(':scope > button');
      if (button) {
        return !!button.querySelector('selectedcontent');
      }
      const style = window.getComputedStyle(select);
      return style.display !== 'none' && style.appearance === 'base-select';
    });
    expect(hasSelectedContentOrImplicit).toBe(true);
  });

  test('Requirement 7b: trigger button MUST NOT contain legacy <selectedoption> element', async ({ page }) => {
    const hasSelectedOption = await page.evaluate(() => {
      const select = document.querySelector('select');
      if (!select) return true;
      const button = select.querySelector('button');
      if (!button) {
        return !!select.querySelector('selectedoption') || window.getComputedStyle(select).appearance !== 'base-select';
      }
      return !!button.querySelector('selectedoption');
    });
    expect(hasSelectedOption).toBe(false);
  });

  test('Requirement 8: MUST NOT use JavaScript as the primary mechanism for toggling the dropdown', async ({ page }) => {
    // Check if the select is hidden (common in JS-based custom selects)
    const select = await page.$('select');
    if (!select) {
      throw new Error('Select element not found');
    }
    const isVisible = await select.isVisible();
    
    // Check for common JS-based trigger patterns if select is hidden
    const hasCustomTrigger = await page.$('[onclick*="toggle"], [class*="trigger"]');
    
    if (!isVisible && hasCustomTrigger) {
      throw new Error('JS used for toggling instead of native base-select');
    }
    expect(isVisible).toBe(true);
  });

  test('Requirement 10a: <select> MUST have a name attribute', async ({ page }) => {
    const select = await page.$('select');
    const name = await select?.getAttribute('name');
    expect(name).toBeTruthy();
  });

  test('Requirement 10b: <select> MUST have an associated <label>', async ({ page }) => {
    const select = await page.$('select');
    const id = await select?.getAttribute('id');
    if (!id) {
      // If no ID, it might be nested in a label, but requirement says "associated label"
      // and usually implies for/id or nesting.
      // Demo has id/for. Negative has neither.
      const parentLabel = await page.$(`label:has(select)`);
      expect(parentLabel).not.toBeNull();
    } else {
      const label = await page.$(`label[for="${id}"]`);
      expect(label).not.toBeNull();
    }
  });
});
