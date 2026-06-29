import { test, expect } from '../../test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || 'demo.html';
const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);

test.describe('Total Foreground Time Grader', () => {
  test.setTimeout(15000);
  test.beforeEach(async ({ page, TARGET_URL }) => {
    await page.route('**/*', async (route) => {
      const urlStr = route.request().url();
      if (urlStr.startsWith('http://localhost') || urlStr.startsWith('http://127.0.0.1')) {
        const requestPath = new URL(urlStr).pathname;
        const sanitizedPath = requestPath === '/' ? demoName : requestPath.replace(/^\//, '');
        const localFilePath = path.join(targetDir, sanitizedPath);

        if (fs.existsSync(localFilePath)) {
          await route.fulfill({ path: localFilePath });
          return;
        }
      }
      await route.continue();
    });

    // We mock performance.getEntriesByType and PerformanceObserver to detect usage
    await page.addInitScript(() => {
      (window as any)._visibilityAPIUsed = false;
      
      const originalGetEntriesByType = Performance.prototype.getEntriesByType;
      Performance.prototype.getEntriesByType = function(type: string) {
        if (type === 'visibility-state') {
          (window as any)._visibilityAPIUsed = true;
          // Return some mock data to test the logic
          // 0-500: visible
          // 500-1500: hidden
          // 1500-now: visible
          return [
            { name: 'visible', startTime: 0, entryType: 'visibility-state', duration: 0, toJSON: () => {} },
            { name: 'hidden', startTime: 500, entryType: 'visibility-state', duration: 0, toJSON: () => {} },
            { name: 'visible', startTime: 1500, entryType: 'visibility-state', duration: 0, toJSON: () => {} }
          ] as any;
        }
        return originalGetEntriesByType.apply(this, arguments as any);
      };

      // Also mock PerformanceObserver
      const OriginalPerformanceObserver = window.PerformanceObserver;
      (window as any).PerformanceObserver = function(callback: any) {
        (window as any)._visibilityAPIUsed = true; // Simple detection
        const observerInstance = new (OriginalPerformanceObserver as any)(callback);
        const origObserve = observerInstance.observe;
        observerInstance.observe = function(options: any) {
          if (options && (options.type === 'visibility-state' || (options.entryTypes && options.entryTypes.includes('visibility-state')))) {
            (window as any)._visibilityAPIUsed = true;
            setTimeout(() => {
              const entries = [
                { name: 'visible', startTime: 0, entryType: 'visibility-state', duration: 0, toJSON: () => {} },
                { name: 'hidden', startTime: 500, entryType: 'visibility-state', duration: 0, toJSON: () => {} },
                { name: 'visible', startTime: 1500, entryType: 'visibility-state', duration: 0, toJSON: () => {} }
              ];
              callback({ getEntries: () => entries, getEntriesByType: (t: string) => t === 'visibility-state' ? entries : [] }, observerInstance);
            }, 100);
          }
          return origObserve ? origObserve.apply(this, arguments) : undefined;
        };
        return observerInstance;
      };
      (window as any).PerformanceObserver.supportedEntryTypes = OriginalPerformanceObserver.supportedEntryTypes || ['visibility-state'];
    });

    await page.goto(TARGET_URL);
  });

  test('should use VisibilityStateEntry API (via getEntriesByType or PerformanceObserver)', async ({ page }) => {
    // Wait for the app to initialize and potentially call the API
    await page.waitForFunction(() => (window as any)._visibilityAPIUsed === true || performance.now() > 2000);
    const used = await page.evaluate(() => (window as any)._visibilityAPIUsed);
    expect(used).toBe(true);
  });

  test('should correctly calculate foreground time excluding hidden periods', async ({ page }) => {
    // In our mock: 0-500 (v), 500-1500 (h), 1500-now (v)
    // Foreground time should be 500 + (now - 1500) = now - 1000.
    
    // Wait until performance.now() is safely past 1500ms
    await page.waitForFunction(() => performance.now() > 2000);
    
    // Give the UI time to update
    await page.waitForTimeout(500);

    const values = await page.evaluate(() => {
      const results: { value: number, now: number }[] = [];
      if (typeof (window as any).getTotalForegroundTime === 'function') {
        results.push({
          value: (window as any).getTotalForegroundTime(),
          now: performance.now()
        });
      }
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        const text = el.textContent || '';
        if (text.includes('ms') || text.includes('s') || el.id.includes('time') || el.className.includes('time') || el.getAttribute('data-testid')?.includes('time')) {
          const match = text.match(/(\d+(?:\.\d+)?)/);
          if (match) {
            let val = parseFloat(match[1]);
            if (text.includes('s') && !text.includes('ms')) val = val * 1000;
            results.push({
              value: val,
              now: performance.now()
            });
          }
        }
      }
      return results;
    });

    const visibilityAPIUsed = await page.evaluate(() => (window as any)._visibilityAPIUsed === true);
    expect(visibilityAPIUsed).toBe(true);
    
    // Foreground time should be properly deducted by background duration (~1000ms hidden)
    const foregroundTimeFound = values.some(v => Math.abs(v.value - (v.now - 1000)) < 400 && Math.abs(v.now - v.value) > 300);
    expect(foregroundTimeFound).toBe(true);
  });

  test('should check for VisibilityStateEntry support before falling back', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForFunction(() => (window as any)._visibilityAPIUsed === true || performance.now() > 2000);
    const checked = await page.evaluate(() => {
      return (window as any)._visibilityAPIUsed;
    });
    expect(checked).toBe(true);
  });
});
