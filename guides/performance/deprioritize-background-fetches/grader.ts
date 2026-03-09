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

test.describe(`Deprioritize background fetches Expectations: ${demoName}`, () => {
  // Static assertions (Functional tests)
  
  test('fetch() call to /api/data is made without the priority: low option in source code', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const match = html.match(/\/api\/data['"][\s\S]+?(?=fetch|$)/);
    expect(match?.[0] || '').not.toMatch(/priority:\s*['"]low['"]/);
  });

  test('fetch() call to /api/analytics is made with the priority: low option in source code', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const match = html.match(/\/api\/analytics['"][\s\S]+?(?=fetch|$)/);
    expect(match?.[0] || '').toMatch(/priority:\s*['"]low['"]/);
  });

  test('No fetch() calls use the deprecated importance option in source code', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toContain('importance:');
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    // Inject script to intercept fetch calls
    await page.addInitScript(() => {
      (window as any)._fetches = [];
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const [url, options] = args;
        (window as any)._fetches.push({ url: url.toString(), options });
        return originalFetch(...args);
      };
    });

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
  
  test('In browser, fetch() call to /api/data does not have priority: low', async ({ page }) => {
    await page.getByRole('button').first().click();
    const fetches = await page.evaluate(() => (window as any)._fetches);
    const dataFetch = fetches.find((f: any) => f.url.includes('/api/data'));
    expect(dataFetch?.options?.priority).not.toBe('low');
  });

  test('In browser, fetch() call to /api/analytics has priority: low', async ({ page }) => {
    await page.getByRole('button').first().click();
    const fetches = await page.evaluate(() => (window as any)._fetches);
    const analyticsFetch = fetches.find((f: any) => f.url.includes('/api/analytics'));
    expect(analyticsFetch?.options?.priority).toBe('low');
  });

  test('In browser, no fetch() calls use the deprecated importance option', async ({ page }) => {
    await page.getByRole('button').first().click();
    const fetches = await page.evaluate(() => (window as any)._fetches);
    const usesImportance = fetches.some((f: any) => f.options && 'importance' in f.options);
    expect(usesImportance).toBe(false);
  });
});
