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
test.describe(`Supporting Global Calendar Systems with Temporal: ${demoName}`, () => {

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const url = new URL(route.request().url());
      const requestPath = url.pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' || requestPath === `/${demoName}` ? demoName : requestPath);

      if (fs.existsSync(localFilePath) && fs.lstatSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  test('Implementation MUST feature-detect the Temporal API before usage', async ({ page }) => {
    const scripts = await page.$$eval('script', (elements) => elements.map(e => e.textContent || ''));
    const hasDetection = scripts.some(s => 
      s.includes('typeof Temporal') || 
      s.includes('window.Temporal') || 
      s.includes('globalThis.Temporal') ||
      s.includes('"Temporal" in')
    );
    expect(hasDetection).toBe(true);
  });

  test('Implementation MUST conditionally load a Temporal polyfill only if native support is absent', async ({ page }) => {
    const scripts = await page.$$eval('script', (elements) => elements.map(e => e.textContent || ''));
    const hasPolyfillLoading = scripts.some(s => s.includes('polyfill') && (s.includes('import') || s.includes('src')));
    expect(hasPolyfillLoading).toBe(true);
  });

  test('Implementation MUST use withCalendar() to associate a non-ISO calendar system', async ({ page }) => {
    const scripts = await page.$$eval('script', (elements) => elements.map(e => e.textContent || ''));
    const usesWithCalendar = scripts.some(s => s.includes('.withCalendar('));
    expect(usesWithCalendar).toBe(true);
  });

  test('Implementation MUST use monthCode for lunisolar calendars (Hebrew, Chinese)', async ({ page }) => {
    const scripts = await page.$$eval('script', (elements) => elements.map(e => e.textContent || ''));
    const usesMonthCode = scripts.some(s => s.includes('.monthCode'));
    expect(usesMonthCode).toBe(true);
  });

  test('Implementation MUST use toLocaleString() to format dates for display', async ({ page }) => {
    const scripts = await page.$$eval('script', (elements) => elements.map(e => e.textContent || ''));
    const usesToLocaleString = scripts.some(s => s.includes('.toLocaleString('));
    expect(usesToLocaleString).toBe(true);
  });

  test('Implementation MUST NOT use the legacy Date object for non-Gregorian calculations', async ({ page }) => {
    const scripts = await page.$$eval('script', (elements) => elements.map(e => e.textContent || ''));
    // Check for common hacks like year - 579 (Islamic) or + 3760 (Hebrew)
    const hasHacks = scripts.some(s => 
      (s.includes('new Date') && (s.includes('579') || s.includes('622') || s.includes('3760')))
    );
    expect(hasHacks).toBe(false);
  });

  test('Implementation MUST NOT assume that every year has exactly 12 months', async ({ page }) => {
    const scripts = await page.$$eval('script', (elements) => elements.map(e => e.textContent || ''));
    const assumes12Months = scripts.some(s => 
      /\b12\b/.test(s) && (s.includes('month') || s.includes('loop')) && (s.includes('<') || s.includes('='))
    );
    // Also check UI for "Next 12 Months" type strings
    const content = await page.textContent('body');
    const uiAssumes12 = content?.includes('12 Months') || false;
    
    expect(assumes12Months || uiAssumes12).toBe(false);
  });

  test('Implementation MUST NOT assume that month === 12 is always the last month', async ({ page }) => {
    const scripts = await page.$$eval('script', (elements) => elements.map(e => e.textContent || ''));
    const assumes12IsLast = scripts.some(s => 
      (/month\s*==\s*12/.test(s) || /month\s*===\s*12/.test(s)) && s.includes('last')
    );
    expect(assumes12IsLast).toBe(false);
  });

  test('Implementation MUST NOT assume that a leap year only adds a single day (366 days)', async ({ page }) => {
    const scripts = await page.$$eval('script', (elements) => elements.map(e => e.textContent || ''));
    const assumes366 = scripts.some(s => s.includes('366'));
    const content = await page.textContent('body');
    const uiAssumes366 = content?.includes('366 days') || false;
    
    expect(assumes366 || uiAssumes366).toBe(false);
  });

});
