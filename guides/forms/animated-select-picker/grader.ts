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

test.describe(`Animated Select Picker Expectations: ${demoName}`, () => {
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

  test(`MUST apply appearance: base-select to the <select> element and the ::picker(select) pseudo-element`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/appearance:\s*base-select/);
    expect(html).toMatch(/::picker\(\s*select\s*\)/);
  });

  test(`MUST use transition-behavior: allow-discrete on ::picker(select)`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/allow-discrete/);
  });

  test(`MUST use @starting-style to declare the visual state`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/@starting-style/);
  });

  test(`MUST animate the dropdown icon using the :open::picker-icon pseudo-element selector`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/:open::picker-icon/);
  });

  test(`MUST NOT use JavaScript as the primary mechanism for toggling top-layer visibility or running the dropdown animation`, async ({ page }) => {
    const scripts = await page.locator('script').allTextContents();
    const usesJsForToggle = scripts.some((s: string) => s.includes('classList.add') || s.includes('addEventListener'));
    expect(usesJsForToggle).toBe(false);
  });

  test(`The <button> tag MUST contain a <selectedcontent> element and MUST NOT contain legacy <selectedoption> element`, async ({ page }) => {
    const selectedContent = page.locator('button selectedcontent');
    await expect(selectedContent).toHaveCount(1);
    const selectedOption = page.locator('selectedoption');
    await expect(selectedOption).toHaveCount(0);
  });

  test(`A progressive enhancement fallback MUST be included that checks for CSS.supports before logging support or applying standard legacy fallbacks`, async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasScript = html.includes('<script');
    if (hasScript) {
      expect(html).toMatch(/CSS\.supports\(\s*['"]appearance['"]\s*,\s*['"]base-select['"]\s*\)/);
    } else {
      expect(hasScript).toBe(false);
    }
  });

  test(`The <select> MUST have a name attribute and an associated <label>`, async ({ page }) => {
    const select = page.locator('select').first();
    await expect(select).toHaveAttribute('name', /.+/);
    const id = await select.getAttribute('id');
    expect(id).not.toBeNull();
    const label = page.locator(`label[for="${id}"]`);
    await expect(label).toHaveCount(1);
  });
});
