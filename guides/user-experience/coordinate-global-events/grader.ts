import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(process.cwd(), 'demo.html');
const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Temporal Event Planner Expectations: ${demoName}`, () => {
  let content = '';

  test.beforeAll(() => {
    content = fs.readFileSync(filePath, 'utf-8');
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
  });

  test('MUST feature-detect the Temporal API before usage to ensure compatibility', async () => {
    const hasFeatureDetection = /(typeof\s+Temporal|'Temporal'\s+in|globalThis\.Temporal)/i.test(content);
    expect(hasFeatureDetection, "Expected to find some form of feature detection for Temporal").toBe(true);
  });

  test('MUST conditionally load the Temporal polyfill only if native support is absent', async ({ page }) => {
    let polyfillRequested = false;
    
    // Instead of overriding routing, we just observe requests.
    page.on('request', (request) => {
      if (request.url().includes('@js-temporal/polyfill')) {
        polyfillRequested = true;
      }
    });

    // Mock native Temporal before scripts execute
    await page.addInitScript(() => {
      (window as any).Temporal = { ZonedDateTime: { from: () => ({}) } };
    });

    await page.goto(demoUrl);
    
    await page.waitForTimeout(500);

    expect(polyfillRequested).toBe(false);
  });

  test('MUST ensure the Temporal API is available globally if the application logic relies on the global Temporal object', async () => {
    const assignsToGlobal = /(globalThis|window)?\.?Temporal\s*=/.test(content);
    expect(assignsToGlobal, "Expected polyfill to be assigned to global scope or Temporal object initialized").toBe(true);
  });

  test('MUST use the disambiguation option in Temporal.ZonedDateTime.from()', async () => {
    expect(content).toMatch(/disambiguation\s*:/);
  });

  test('MUST use disambiguation: "reject" for conflict detection', async () => {
    expect(content).toMatch(/disambiguation\s*:\s*['"`]reject['"`]/);
  });

  test('MUST use .withTimeZone() method for timezone conversion', async () => {
    expect(content).toContain('.withTimeZone(');
  });

  test('MUST NOT use Temporal.PlainDateTime', async () => {
    expect(content).not.toContain('Temporal.PlainDateTime');
  });

  test('MUST NOT attempt to modify Temporal instances directly', async () => {
    const hasDirectModification = /(?:\w+)\.(?:year|month|day|hour|minute|second)\s*=/.test(content);
    expect(hasDirectModification).toBe(false);
  });

  test('UI calculates correct timezones and resolves DST conflicts safely', async ({ page }) => {
    await page.goto(demoUrl);
    
    // Find inputs non-prescriptively
    const dateInput = page.locator('input[type="date"], input[aria-label*="date" i]').first();
    const timeInput = page.locator('input[type="time"], input[aria-label*="time" i]').first();
    const tzSelect = page.locator('select, select[aria-label*="timezone" i]').first();

    // Fill DST conflict time (March 9, 2025 is DST start in US)
    await dateInput.fill('2025-03-09');
    await timeInput.fill('02:30');
    await tzSelect.selectOption('America/New_York');

    // Wait for re-render
    await page.waitForTimeout(1000);

    // Verify Tokyo time (4:30 PM) is displayed on the page
    await expect(page.getByText('4:30 PM')).toBeVisible();
  });

  test('UI displays conflict warning for skipped times', async ({ page }) => {
    await page.goto(demoUrl);
    
    const dateInput = page.locator('input[type="date"], input[aria-label*="date" i]').first();
    const timeInput = page.locator('input[type="time"], input[aria-label*="time" i]').first();
    const tzSelect = page.locator('select, select[aria-label*="timezone" i]').first();

    await dateInput.fill('2025-03-09');
    await timeInput.fill('02:30');
    await tzSelect.selectOption('America/New_York');

    await page.waitForTimeout(1000);

    // Verify warning containing 'skip' is displayed
    await expect(page.getByText(/skip/i)).toBeVisible();
  });


});
