import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Setup fixture for TARGET_URL
const test = base.extend<{ TARGET_URL: string }>({
  TARGET_URL: async ({}, use) => {
    const targetFile = process.env.TARGET_FILE;
    if (!targetFile) {
      throw new Error('TARGET_FILE environment variable not set.');
    }
    const filePath = path.resolve(targetFile);
    await use(`file://${filePath}`);
  },
});

// Setup target file info
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

test.describe(`calculate-total-foreground-time Expectations: ${demoName}`, () => {

  // Setup browser testing
  test.beforeEach(async ({ page, TARGET_URL }) => {
    // Only mock local routes if it's a file-based demo, else let the dev server handle it
    if (TARGET_URL.startsWith('http://localhost/')) {
      await page.route('http://localhost/*', async (route) => {
        const requestPath = new URL(route.request().url()).pathname;
        const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });
    }

    await page.goto(TARGET_URL);
  });

  test('should use VisibilityStateEntry API (getEntriesByType) to measure foreground time', async ({ page }) => {
    const apiCalled = await page.evaluate(async () => {
      let called = false;
      const original = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = (type: string) => {
        if (type === 'visibility-state') {
          called = true;
        }
        return original(type);
      };
      
      // Wait for the UI update interval (100ms in both demos)
      await new Promise(resolve => setTimeout(resolve, 300));
      return called;
    });
    
    expect(apiCalled).toBe(true);
  });

  test('should correctly calculate foreground time by excluding background periods', async ({ page }) => {
    // Inject mocks before the calculation loop runs again
    const foregroundTimeText = await page.evaluate(async () => {
      // Mock entries: 
      // 0-1000: visible
      // 1000-2000: hidden
      // 2000-3000: visible
      // Current time: 3500
      // Total foreground should be: (1000 - 0) + (3500 - 2000) = 2500ms
      const mockEntries = [
        { name: 'visible', startTime: 0, entryType: 'visibility-state', duration: 0, toJSON: () => ({}) },
        { name: 'hidden', startTime: 1000, entryType: 'visibility-state', duration: 0, toJSON: () => ({}) },
        { name: 'visible', startTime: 2000, entryType: 'visibility-state', duration: 0, toJSON: () => ({}) }
      ];
      
      performance.getEntriesByType = (type: string) => {
        if (type === 'visibility-state') return mockEntries as any;
        return [];
      };
      performance.now = () => 3500;

      // Trigger/wait for UI update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const el = document.getElementById('foreground-time');
      return el ? el.textContent : null;
    });
    
    // demo.html: Math.round(2500) -> "2500ms"
    // negative-demo.html: Math.round(3500) -> "3500ms"
    expect(foregroundTimeText).toBe('2500ms');
  });

  test('should fallback to performance.now() only after checking API availability', async ({ page }) => {
    const result = await page.evaluate(async () => {
      let apiChecked = false;
      performance.getEntriesByType = (type: string) => {
        if (type === 'visibility-state') {
          apiChecked = true;
          return []; // Simulate unsupported/no entries
        }
        return [];
      };
      
      const mockNow = 1234;
      performance.now = () => mockNow;
      
      // Wait for UI update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const el = document.getElementById('foreground-time');
      const value = el ? el.textContent : '';
      
      return { apiChecked, value };
    });
    
    // demo.html: { apiChecked: true, value: "1234ms" }
    // negative-demo.html: { apiChecked: false, value: "1234ms" }
    expect(result).toEqual({ apiChecked: true, value: '1234ms' });
  });

});
