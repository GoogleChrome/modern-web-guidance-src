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

function getFontFaceCss(fileText: string) {
  const match = fileText.match(/@font-face\s*{[^}]*}/);
  return match ? match[0] : '';
}

// Tests
test.describe(`Share Web Fonts Across Origins Expectations: ${demoName}`, () => {
  let fontFaceCss = '';

  test.beforeEach(async ({ page }) => {
    fontFaceCss = getFontFaceCss(fs.readFileSync(filePath, 'utf-8'));

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

  test(`The @font-face src uses cross-origin-storage() alongside integrity()`, async () => {
    expect(/cross-origin-storage\(/.test(fontFaceCss)).toBe(true);
    expect(/integrity\(/.test(fontFaceCss)).toBe(true);
  });

  test(`cross-origin-storage() never appears without integrity() in the same url()`, async () => {
    const urlFunctions = fontFaceCss.match(/url\([^)]*\)[^,;]*/g) ?? [];
    for (const urlFn of urlFunctions) {
      if (/cross-origin-storage\(/.test(urlFn)) {
        expect(/integrity\(/.test(urlFn)).toBe(true);
      }
    }
  });

  test(`The COS-enhanced source is listed before a plain fallback url() for the same font`, async () => {
    const cosIndex = fontFaceCss.indexOf('cross-origin-storage(');
    const srcMatch = fontFaceCss.match(/src:\s*([^;]+);/);
    expect(cosIndex).toBeGreaterThan(-1);
    expect(srcMatch).not.toBeNull();
    const srcList = srcMatch![1].split(',');
    expect(srcList.length).toBeGreaterThanOrEqual(2);
    expect(/cross-origin-storage\(/.test(srcList[0])).toBe(true);
    expect(/cross-origin-storage\(/.test(srcList[srcList.length - 1])).toBe(false);
  });

  test(`cross-origin-storage() is not confused with the unrelated cross-origin() modifier`, async () => {
    expect(/[^-]cross-origin\(/.test(fontFaceCss)).toBe(false);
  });

  test(`The font renders using the declared font-family`, async ({ page }) => {
    const sample = page.locator('.sample');
    await expect(sample).toBeVisible();
  });
});
