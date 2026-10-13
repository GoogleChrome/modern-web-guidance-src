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
test.describe(`Custom Select Picker Layouts Expectations: ${demoName}`, () => {
  const getCombinedCss = () => {
    let content = fs.readFileSync(filePath, 'utf-8');
    try {
      for (const entry of fs.readdirSync(targetDir)) {
        if (entry.endsWith('.css')) {
          content += '\n' + fs.readFileSync(path.join(targetDir, entry), 'utf-8');
        }
      }
    } catch {}
    return content;
  };

  // Static assertions
  test(`MUST include appearance: base-select on select and select::picker(select)`, async () => {
    const css = getCombinedCss();
    const hasBaseSelect = /appearance\s*:\s*base-select/i.test(css);
    const hasPicker = /::picker\(\s*select\s*\)/i.test(css);
    expect(hasBaseSelect && hasPicker).toBe(true);
  });

  test(`MUST use a non-traditional layout (such as display: grid or flex) on picker container`, async () => {
    const css = getCombinedCss();
    const usesGridOrFlex = /::picker\(\s*select\s*\)\s*\{[^}]*display\s*:\s*(?:grid|flex|inline-grid|inline-flex)/is.test(css);
    expect(usesGridOrFlex).toBe(true);
  });

  test(`MUST style option elements to fit the chosen layout`, async () => {
    const css = getCombinedCss();
    const hasOptionStyles = /option[^{]*\{[^}]*(?:display\s*:\s*(?:flex|grid|inline-flex|inline-grid)|padding|flex-direction|align-items|gap)/is.test(css);
    expect(hasOptionStyles).toBe(true);
  });

  test(`MUST communicate checked state of options using multiple visual cues`, async () => {
    const css = getCombinedCss();
    const hasCheckedStyles = /(?:option[^{]*:checked|&\s*:checked|::checkmark)\s*\{[^}]*(?:font-weight|border|outline|box-shadow|background|inset|display)/is.test(css);
    expect(hasCheckedStyles).toBe(true);
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
  test(`MUST contain a button tag directly inside the select element`, async ({ page }) => {
    const count = await page.locator('select > button').count();
    expect(count).toBeGreaterThan(0);
  });

  test(`MUST contain selectedcontent and NOT legacy selectedoption in the custom trigger button`, async ({ page }) => {
    const count = await page.locator('select > button:has(selectedcontent):not(:has(selectedoption))').count();
    expect(count).toBeGreaterThan(0);
  });

  test(`MUST NOT rely on JS to position options (should not have display: none on native select)`, async ({ page }) => {
    await expect(page.locator('select').first()).not.toHaveCSS('display', 'none');
  });

  test(`MUST have a name attribute on the select element`, async ({ page }) => {
    const count = await page.locator('select[name]').count();
    expect(count).toBeGreaterThan(0);
  });

  test(`MUST have an associated label for the select element`, async ({ page }) => {
    const selectId = await page.evaluate(() => document.querySelector('select')?.getAttribute('id') || 'no-id');
    const labelCount = await page.locator(`label[for="${selectId}"], label:has(select)`).count();
    expect(labelCount).toBeGreaterThan(0);
  });
});
