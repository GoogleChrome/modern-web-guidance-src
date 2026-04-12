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
test.describe(`Temporal API Expectations: ${demoName}`, () => {

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
    await page.waitForLoadState('networkidle');
  });

  test('MUST feature-detect the Temporal API using typeof Temporal === "undefined" before usage', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\\n');
    });
    expect(scriptContent).toMatch(/typeof\s+Temporal/);
  });

  test('MUST conditionally load a Temporal polyfill only if native support is absent', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\\n');
    });
    const usesStaticImport = /import\s+[^(']*from\s+['"][^'"]*@js-temporal\/polyfill[^'"]*['"]/.test(scriptContent);
    expect(usesStaticImport).toBe(false);
  });

  test('MUST manually assign the loaded polyfill to globalThis.Temporal to ensure it is globally accessible', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\\n');
    });
    expect(scriptContent).toMatch(/globalThis\.Temporal\s*=/);
  });

  test('MUST use Temporal.PlainYearMonth for modeling concepts that only have a year and a month', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\\n');
    });
    expect(scriptContent).toMatch(/Temporal\.PlainYearMonth/);
  });

  test('MUST include explicit calendar properties when creating instances from objects', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\\n');
    });
    const hasExplicitCalendar = /\{[^}]*calendar\s*:\s*['"][^'"]+['"][^}]*\}/.test(scriptContent);
    expect(hasExplicitCalendar).toBe(true);
  });

  test('MUST NOT attempt to perform arithmetic directly on PlainMonthDay without converting it to a PlainDate first', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\\n');
    });
    if (scriptContent.includes('PlainMonthDay')) {
      expect(scriptContent).toMatch(/toPlainDate\(/);
    } else {
      expect(true).toBe(true);
    }
  });

  test('MUST NOT use the legacy Date object for representing partial time concepts', async ({ page }) => {
    const scriptContent = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\\n');
    });
    expect(scriptContent).not.toMatch(/new\s+Date\(/);
  });
});