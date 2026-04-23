import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

test.describe(`Page Visibility Detection: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    // Route all localhost requests to the target directory to simulate a real web environment
    await page.route('http://localhost/*', async (route) => {
      const url = new URL(route.request().url());
      const requestPath = url.pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
  });

  test('Page accurately detects initial background state using VisibilityStateEntry', async ({ page }) => {
    await page.addInitScript(() => {
      const mockEntry = {
        name: 'hidden',
        entryType: 'visibility-state',
        startTime: 100,
        duration: 0,
        toJSON: () => {}
      };
      (window as any).VisibilityStateEntry = class {};
      const original = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = (type: string) => {
        if (type === 'visibility-state') return [mockEntry] as any;
        return original(type);
      };
      // Ensure document.visibilityState is different to test API preference
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true
      });
    });

    await page.goto('http://localhost/');
    const bodyText = await page.innerText('body');
    // Should be true because mock VisibilityStateEntry says 'hidden'
    expect(bodyText.toLowerCase()).toContain('true');
  });

  test('Page reports the precise high-resolution timestamp from the VisibilityStateEntry', async ({ page }) => {
    const MOCK_TIME = 123.456;
    await page.addInitScript((time) => {
      const mockEntry = {
        name: 'hidden',
        entryType: 'visibility-state',
        startTime: time,
        duration: 0,
        toJSON: () => {}
      };
      (window as any).VisibilityStateEntry = class {};
      const original = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = (type: string) => {
        if (type === 'visibility-state') return [mockEntry] as any;
        return original(type);
      };
    }, MOCK_TIME);

    await page.goto('http://localhost/');
    const bodyText = await page.innerText('body');
    expect(bodyText).toContain('123.456');
  });

  test('Implementation prefers VisibilityStateEntry over document.visibilityState', async ({ page }) => {
    await page.addInitScript(() => {
      const mockEntry = {
        name: 'hidden',
        entryType: 'visibility-state',
        startTime: 0,
        duration: 0,
        toJSON: () => {}
      };
      (window as any).VisibilityStateEntry = class {};
      performance.getEntriesByType = (type: string) => {
        if (type === 'visibility-state') return [mockEntry] as any;
        return [];
      };
      // document.visibilityState says 'visible', but mock entry says 'hidden'
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true
      });
    });

    await page.goto('http://localhost/');
    const bodyText = await page.innerText('body');
    // Result should be 'true' based on VisibilityStateEntry
    expect(bodyText.toLowerCase()).toContain('true');
  });

  test('Implementation provides a reliability warning when falling back to document.visibilityState', async ({ page }) => {
    await page.addInitScript(() => {
      // Remove VisibilityStateEntry support
      delete (window as any).VisibilityStateEntry;
      performance.getEntriesByType = (type: string) => {
        if (type === 'visibility-state') return [];
        return [];
      };
    });

    await page.goto('http://localhost/');
    const bodyText = await page.innerText('body');
    // Expect keywords related to unreliability
    expect(bodyText.toLowerCase()).toMatch(/unreliable|warning|caution|reliable/);
  });

  test('Reliability warning is highlighted with a distinct style (orange color)', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as any).VisibilityStateEntry;
      performance.getEntriesByType = () => [];
    });

    await page.goto('http://localhost/');
    // Find the element containing the warning and check its style
    const warningElement = page.locator('text=/unreliable|warning|caution/i');
    const color = await warningElement.evaluate(el => window.getComputedStyle(el).color);
    // demo.html uses orange (rgb(255, 165, 0))
    expect(color).toBe('rgb(255, 165, 0)');
  });

});
