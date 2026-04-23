/// <reference types="node" />
import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const test = base.extend<{ TARGET_URL: string }>({
  TARGET_URL: async ({}, use) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable not set.');
    }
    await use('http://localhost/');
  },
});

const targetFile = process.env.TARGET_FILE;
const filePath = path.resolve(targetFile!);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

test.describe(`Conditional Async Dependencies: ${demoName}`, () => {

  test.beforeEach(async ({ page, TARGET_URL }) => {
    if (TARGET_URL.startsWith('http://localhost/')) {
      await page.route('http://localhost/*', async (route) => {
        const url = new URL(route.request().url());
        const requestPath = url.pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath) && fs.lstatSync(localFilePath).isFile()) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });
    }

    await page.goto(TARGET_URL);
  });

  test('Script checks popover in HTMLElement.prototype', async ({ page }) => {
    const scripts = await page.$$('script[type="module"]');
    let found = false;
    for (const script of scripts) {
      const src = await script.getAttribute('src');
      let content = '';
      if (src) {
        try {
          const response = await page.request.get(new URL(src, page.url()).href);
          content = await response.text();
        } catch (e) {}
      } else {
        content = await script.textContent() || '';
      }
      if (content.match(/['"]popover['"]\s+in\s+HTMLElement\.prototype/)) {
        found = true;
        break;
      }
    }
    expect(found, 'Should check for "popover" in HTMLElement.prototype').toBe(true);
  });

  test('Conditional loading uses top-level await', async ({ page }) => {
    const scripts = await page.$$('script[type="module"]');
    let found = false;
    for (const script of scripts) {
      const src = await script.getAttribute('src');
      let content = '';
      if (src) {
        try {
          const response = await page.request.get(new URL(src, page.url()).href);
          content = await response.text();
        } catch (e) {}
      } else {
        content = await script.textContent() || '';
      }
      if (content.match(/await\s+import/)) {
        found = true;
        break;
      }
    }
    expect(found, 'Should use top-level await for dynamic import').toBe(true);
  });

  test('Implementation uses a single module entry point', async ({ page }) => {
    const modules = await page.$$('script[type="module"]');
    expect(modules.length).toBe(1);
  });

  test('Document contains functional popover and popovertarget button', async ({ page }) => {
    const popover = page.locator('[popover]');
    const button = page.locator('button[popovertarget]');
    
    await expect(popover).toBeAttached();
    await expect(button).toBeAttached();
    
    const popoverId = await popover.getAttribute('id');
    const targetId = await button.getAttribute('popovertarget');
    expect(targetId, 'popovertarget should match popover id').toBe(popoverId);

    // Verify it can be shown
    await button.click();
    await expect(popover).toBeVisible();
  });
});
