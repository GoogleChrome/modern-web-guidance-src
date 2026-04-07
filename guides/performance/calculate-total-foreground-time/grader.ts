import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(__dirname, 'demo.html');
const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

declare global {
  interface Window {
    __getEntriesByTypeCalls: string[];
    __visibilityStateMockReturn?: any[];
  }
}

test.describe(`Foreground Time Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__getEntriesByTypeCalls = [];
      const original = performance.getEntriesByType;
      performance.getEntriesByType = function(type) {
        window.__getEntriesByTypeCalls.push(type);
        if (type === 'visibility-state' && window.__visibilityStateMockReturn !== undefined) {
          return window.__visibilityStateMockReturn;
        }
        return original.apply(this, arguments as any);
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
  });

  test(`queries the performance timeline for visibility-state entries`, async ({ page }) => {
    await page.goto(demoUrl);
    await page.waitForTimeout(200);
    const calls = await page.evaluate(() => window.__getEntriesByTypeCalls);
    expect(calls).toContain('visibility-state');
  });

  test(`calculates foreground time from visibility-state entries`, async ({ page }) => {
    await page.addInitScript(() => {
      window.__visibilityStateMockReturn = [
        { name: 'visible', startTime: 0, duration: 0, entryType: 'visibility-state' },
        { name: 'hidden', startTime: 10000, duration: 0, entryType: 'visibility-state' },
        { name: 'visible', startTime: 20000, duration: 0, entryType: 'visibility-state' },
        { name: 'hidden', startTime: 30000, duration: 0, entryType: 'visibility-state' }
      ];
    });
    
    await page.goto(demoUrl);
    await page.waitForTimeout(300);

    const text = await page.locator('#foreground-time').textContent();
    const timeValue = parseFloat(text || '0');
    expect(Math.round(timeValue)).toBe(20);
  });

  test(`gracefully falls back to total time if visibility-state is unsupported`, async ({ page }) => {
    await page.addInitScript(() => {
      window.__visibilityStateMockReturn = [];
      performance.now = function() {
        return 50000; // Force it to return a high static value
      };
    });
    await page.goto(demoUrl);
    await page.waitForTimeout(300);

    const text = await page.locator('#foreground-time').textContent();
    const timeValue = parseFloat(text || '0');
    expect(Math.round(timeValue)).toBe(50);
  });
});
