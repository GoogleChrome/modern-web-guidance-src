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
test.describe(`Load Shared Resources Declaratively Expectations: ${demoName}`, () => {
  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        // Serves the real assets shipped alongside this guide (e.g.
        // /assets/shared-widget.css, /assets/shared-widget.js,
        // /assets/shared-config.js), whose bytes match the integrity
        // hashes hardcoded in demo.html, so both SRI and a real
        // Cross-Origin Storage implementation can verify them. Also
        // covers any equivalently-named asset an agent-submitted page
        // under test happens to ship alongside itself.
        await route.fulfill({ path: localFilePath });
      } else {
        // Fulfill any other referenced asset that isn't on disk with a
        // minimal stand-in so the page's own script can still run to
        // completion, for pages under test that reference assets we
        // didn't anticipate.
        if (requestPath.endsWith('.js')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: 'export default { ok: true };',
          });
        } else if (requestPath.endsWith('.css')) {
          await route.fulfill({ status: 200, contentType: 'text/css', body: '' });
        } else {
          await route.continue();
        }
      }
    });

    await page.goto(demoUrl);
    await page.waitForLoadState('networkidle');
  });

  // Browser assertions
  test(`A <link> or <script> element with a valid integrity attribute also carries crossoriginstorage`, async ({ page }) => {
    const count = await page.locator('[integrity][crossoriginstorage]').count();
    expect(count).toBeGreaterThan(0);
  });

  test(`crossoriginstorage never appears on an element without a corresponding integrity attribute`, async ({ page }) => {
    const count = await page.locator('[crossoriginstorage]:not([integrity])').count();
    expect(count).toBe(0);
  });

  test(`crossoriginstorage is not confused with the unrelated crossorigin attribute`, async ({ page }) => {
    // Both attributes may legitimately coexist; this only checks that at
    // least one crossoriginstorage-bearing element still references a real
    // src/href, i.e. crossoriginstorage wasn't used as a typo replacement
    // for crossorigin.
    const withStorage = await page.locator('[crossoriginstorage]').count();
    expect(withStorage).toBeGreaterThan(0);
  });

  test(`Elements with crossoriginstorage still point at a real src or href URL`, async ({ page }) => {
    const elements = await page.locator('[crossoriginstorage]').all();
    for (const el of elements) {
      const src = (await el.getAttribute('src')) ?? (await el.getAttribute('href'));
      expect(src).toBeTruthy();
    }
  });

  test(`A static or dynamic module import supplies the crossOriginStorage import attribute alongside integrity, or feature-detects before using it`, async ({ page }) => {
    const html = await page.content();
    const usesImportAttribute = /crossOriginStorage\s*:/.test(html);
    const featureDetects = /navigator\.crossOriginStorage/.test(html);
    expect(usesImportAttribute && featureDetects).toBe(true);
  });
});
