import { test, expect, type Page } from '@playwright/test';
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

function getYieldCounts(page: Page) {
  return page.evaluate(() => {
    return (window as any).__yieldStats || { 
      schedulerYieldCount: 0, 
      setTimeoutCount: 0,
      schedulerPostTaskCount: 0,
      backgroundTimeoutCount: 0
    };
  });
}

// Tests
test.describe(`Complex Computations and Loops Expectations: ${demoName}`, () => {
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

    // Inject a spy into the browser's scheduling APIs
    await page.addInitScript(() => {
      (window as any).__yieldStats = {
        schedulerYieldCount: 0,
        setTimeoutCount: 0,
        schedulerPostTaskCount: 0,
        backgroundTimeoutCount: 0
      };

      if ('scheduler' in window) {
        const originalYield = (window.scheduler as any).yield;
        if (originalYield) {
          (window.scheduler as any).yield = async function () {
            (window as any).__yieldStats.schedulerYieldCount++;
            return originalYield.apply(this);
          };
        }

        const originalPostTask = (window.scheduler as any).postTask;
        if (originalPostTask) {
          (window.scheduler as any).postTask = function (callback: any, options: any) {
            if (options && options.priority === 'background') {
              (window as any).__yieldStats.schedulerPostTaskCount++;
            }
            return originalPostTask.apply(this, [callback, options]);
          };
        }
      }

      const originalSetTimeout = window.setTimeout;
      window.setTimeout = (function (this: Window, handler: TimerHandler, timeout?: number, ...args: any[]) {
        if (timeout === 0 || timeout === undefined) {
          (window as any).__yieldStats.setTimeoutCount++;
        } else if (timeout >= 200) {
          (window as any).__yieldStats.backgroundTimeoutCount++;
        }
        return originalSetTimeout.apply(this || window, [handler, timeout, ...args] as any);
      }) as any;
    });

    await page.goto(demoUrl);
  });

  test(`The application processes a heavy computation or large loop asynchronously`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const button = page.locator('button').first();
    if (await button.count() > 0) {
      // Execute click and measure time. 
      // If it's a blocking synchronous computation, evaluate will hang.
      // If it's asynchronous, the click dispatch will return quickly.
      const startTime = Date.now();
      await page.evaluate(() => {
        const btn = document.querySelector('button') as HTMLElement;
        if (btn) btn.click();
      });
      const elapsedTime = Date.now() - startTime;
      
      // We expect it to return quickly while the work continues in the background.
      expect(elapsedTime).toBeLessThan(200);
    }
  });

  test(`The application yields control back to the main thread periodically during the processing`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    // Find a button and click it to start the process
    const button = page.locator('button').first();
    if (await button.count() > 0) {
      await button.click();
      // Wait for some processing to happen
      await page.waitForTimeout(100); 
    }

    const stats = await getYieldCounts(page);
    const totalYields = stats.schedulerYieldCount + stats.setTimeoutCount;

    expect(totalYields).toBeGreaterThan(0);
  });

  test(`The application uses scheduler.yield() if available to yield back to the main thread`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const button = page.locator('button').first();
    if (await button.count() > 0) {
      await button.click();
      await page.waitForTimeout(100); 
    }

    // Since modern browsers support scheduler.yield, this should be the API used
    const stats = await getYieldCounts(page);
    expect(stats.schedulerYieldCount).toBeGreaterThan(0);
  });

  test(`The application uses setTimeout as a fallback mechanism for browsers that do not support the Scheduler API`, async ({ page }) => {
    // Delete scheduler to simulate an older browser, forcing the fallback path
    await page.addInitScript(() => {
      delete (window as any).scheduler;
    });

    // Reload the page to apply the simulated older browser state
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const button = page.locator('button').first();
    if (await button.count() > 0) {
      await button.click();
      await page.waitForTimeout(100); 
    }

    const stats = await getYieldCounts(page);
    expect(stats.setTimeoutCount).toBeGreaterThan(0);
  });

  test(`The application uses scheduler.postTask with priority background or falls back to a delayed setTimeout`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const button = page.locator('button').first();
    if (await button.count() > 0) {
      await button.click();
      await page.waitForTimeout(100); 
    }

    const stats = await getYieldCounts(page);
    const hasPostTaskOrFallback = stats.schedulerPostTaskCount > 0 || stats.backgroundTimeoutCount > 0;

    expect(hasPostTaskOrFallback).toBe(true);
  });

  test(`The application remains responsive to user interaction (e.g., hover states or clicks) while the task is processing`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const button = page.locator('button').first();
    if (await button.count() > 0) {
      // Setup a continuous rAF loop to monitor the maximum time between frames
      await page.evaluate(() => {
        (window as any).maxRafDelay = 0;
        let lastTime = performance.now();
        
        function measure() {
          const now = performance.now();
          const delay = now - lastTime;
          if (delay > (window as any).maxRafDelay) {
            (window as any).maxRafDelay = delay;
          }
          lastTime = now;
          requestAnimationFrame(measure);
        }
        requestAnimationFrame(measure);
      });

      // Wait a moment for the rAF loop to stabilize
      await page.waitForTimeout(100);

      // Reset the max delay right before clicking
      await page.evaluate(() => {
        (window as any).maxRafDelay = 0;
      });

      // Trigger the computation
      await page.evaluate(() => {
        (document.querySelector('button') as HTMLElement)?.click();
      });

      // Wait briefly for some computation to occur
      await page.waitForTimeout(500);

      const maxRafDelay = await page.evaluate(() => (window as any).maxRafDelay);

      // If yielding correctly, frames should fire frequently (e.g. max delay < 250ms).
      // If blocking, the delay will be > 2000ms.
      expect(maxRafDelay).toBeLessThan(250);
    }
  });
});
