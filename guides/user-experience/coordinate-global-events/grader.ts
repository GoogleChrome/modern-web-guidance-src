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

  test('MUST feature-detect the Temporal API using typeof Temporal === "undefined"', async () => {
    expect(content).toMatch(/typeof\s+Temporal\s*===\s*['"`]undefined['"`]/);
  });

  test('MUST conditionally load the @js-temporal/polyfill only if native support is absent', async ({ page }) => {
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

  test('MUST manually assign the loaded polyfill to globalThis.Temporal if loaded', async () => {
    expect(content).toMatch(/globalThis\.Temporal\s*=\s*/);
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
    
    // Wait for the grid to load with initial data (this means Temporal loaded successfully)
    // Reduce timeout so negative demo fails faster.
    await page.waitForSelector('.tz-card', { state: 'visible', timeout: 3000 });

    // Fill DST conflict time
    await page.fill('#dateInput', '2025-03-09');
    await page.fill('#timeInput', '02:30');
    await page.selectOption('#hostTzSelect', 'America/New_York');

    // Wait for re-render
    await page.waitForTimeout(500);

    // Verify Tokyo time
    const tokyoCard = page.locator('.tz-card', { hasText: 'Tokyo' });
    const tokyoTime = await tokyoCard.locator('.resolved-time').textContent();
    expect(tokyoTime?.trim()).toBe('4:30 PM');
  });

  test('UI displays conflict warning for skipped times', async ({ page }) => {
    await page.goto(demoUrl);
    
    await page.waitForSelector('.tz-card', { state: 'visible', timeout: 3000 });

    await page.fill('#dateInput', '2025-03-09');
    await page.fill('#timeInput', '02:30');
    await page.selectOption('#hostTzSelect', 'America/New_York');

    await page.waitForTimeout(500);

    const warning = page.locator('#hostWarning');
    await expect(warning).toBeVisible();
    const warningText = await warning.textContent();
    expect(warningText?.toLowerCase()).toContain('skip');
  });
});
