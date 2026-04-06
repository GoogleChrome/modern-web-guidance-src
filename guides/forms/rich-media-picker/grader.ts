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

test.describe(`Rich Media Picker Expectations: ${demoName}`, () => {

  test(`The <select> element MUST have appearance: base-select applied`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/select.*\{[^}]*appearance:\s*base-select/);
  });

  test(`The ::picker(select) pseudo-element MUST have appearance: base-select applied`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/::picker\(select\)[^{]*{[^}]*appearance:\s*base-select/);
  });

  test(`The <select> element MUST contain a <button> tag as a direct child`, async () => {
    // Check that button contains a valid structural selectedcontent element so it fails on negative demo which uses legacy
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/<select[^>]*>[\s\S]*?<button>\s*<selectedcontent>/);
  });

  test(`The <button> tag MUST contain a <selectedcontent> element to mirror selections`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/<selectedcontent>/);
  });

  test(`The <button> tag MUST NOT contain legacy <selectedoption> element`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/<selectedoption>/);
  });

  test(`The <option> tags MUST contain rich HTML formatting (e.g., <svg>, <div>, or <span>) instead of plaintext only`, async ({ page }) => {
    const hasRichFormatting = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('select option'));
      return options.some(opt => opt.children.length > 0);
    });
    expect(hasRichFormatting).toBe(true);
  });

  test(`The ::picker(select) popup MUST use the CSS Anchor Positioning API (e.g., width: anchor-size(width))`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/width:\s*anchor-size\(width\)/);
  });

  test(`The implementation MUST NOT rely on heavy custom JavaScript to replicate keyboard focus`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/addEventListener\(['"]keydown['"]/);
  });

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

  test(`The <select> MUST have a name attribute`, async ({ page }) => {
    await expect(page.locator('select').first()).toHaveAttribute('name', /.+/);
  });

  test(`The <select> MUST have an associated <label>`, async ({ page }) => {
    const hasLabel = await page.evaluate(() => {
      const select = document.querySelector('select');
      return select && select.labels && select.labels.length > 0;
    });
    expect(hasLabel).toBe(true);
  });
});
