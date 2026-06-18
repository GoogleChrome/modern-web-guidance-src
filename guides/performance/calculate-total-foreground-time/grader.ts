import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE || 'demo.html';

test.describe('Total Foreground Time Grader', () => {
  test.beforeEach(async ({ page }) => {
    // We mock performance.getEntriesByType and PerformanceObserver to detect usage
    await page.addInitScript(() => {
      (window as any)._visibilityAPIUsed = false;
      
      const originalGetEntriesByType = performance.getEntriesByType.bind(performance);
      performance.getEntriesByType = function(type: string) {
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
          ];
        }
        return originalGetEntriesByType(type);
      };

      // Also mock PerformanceObserver
      const OriginalPerformanceObserver = window.PerformanceObserver;
      (window as any).PerformanceObserver = function(callback: any) {
        (window as any)._visibilityAPIUsed = true; // Simple detection
        return new (OriginalPerformanceObserver as any)(callback);
      };
      (window as any).PerformanceObserver.supportedEntryTypes = OriginalPerformanceObserver.supportedEntryTypes;
    });

    await page.goto(`file://${targetFile}`);
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
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        if (el.children.length === 0 && el.textContent?.includes('ms')) {
          const match = el.textContent.match(/(\d+)\s*ms/);
          if (match) {
            results.push({
              value: parseInt(match[1]),
              now: performance.now()
            });
          }
        }
      }
      return results;
    });

    expect(values.length).toBeGreaterThan(0);
    
    // At least one of the values should be close to now - 1000
    const foregroundTimeFound = values.some(v => Math.abs(v.value - (v.now - 1000)) < 200);
    expect(foregroundTimeFound).toBe(true);
  });

  test('should check for VisibilityStateEntry support before falling back', async ({ page }) => {
    // This is hard to test without seeing the code, but we can check if it 
    // at least tried to call getEntriesByType or checked supportedEntryTypes.
    
    const checked = await page.evaluate(() => {
      return (window as any)._visibilityAPIUsed;
    });
    expect(checked).toBe(true);
  });
});
