/// <reference types="node" />
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

test.describe(`Prevent Text Wrapping Expectations: ${demoName}`, () => {
  // Static assertions
  test('The `text-wrap` property is used with the value `nowrap` on the target element', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/text-wrap:\s*nowrap/);
  });

  test('A fallback using `white-space: nowrap` is provided for older browsers', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/white-space:\s*nowrap/);
  });

  test('If `text-overflow: ellipsis` is used, the element also has `overflow: hidden` applied', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    
    const isAttemptingNowrap = /nowrap/.test(html);
    if (!isAttemptingNowrap) {
      expect(html).toContain('nowrap'); // Force failure on negative demo
      return;
    }

    const hasEllipsis = /text-overflow:\s*ellipsis/.test(html);
    if (hasEllipsis) {
      expect(html).toMatch(/overflow:\s*hidden/);
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
  test('The text inside the target element does not wrap to a new line even if it exceeds the container width', async ({ page }) => {
    const target = page.locator('[class*="nowrap"], [id*="target"], .announcement, #target').first();
    const horizontallyOverflows = await target.evaluate((el) => {
      const origWidth = (el as HTMLElement).style.width;
      (el as HTMLElement).style.width = '50px';
      const overflows = el.scrollWidth > el.clientWidth;
      (el as HTMLElement).style.width = origWidth;
      return overflows;
    });
    expect(horizontallyOverflows).toBe(true);
  });
});
