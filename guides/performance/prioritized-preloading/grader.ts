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
    return (window as any).__stats || { 
      backgroundTaskCount: 0, 
      backgroundTimeoutCount: 0,
      jumpedQueue: false
    };
  });
}

// Tests
test.describe(`Prioritized Preloading Expectations: ${demoName}`, () => {
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
      (window as any).__stats = {
        backgroundTaskCount: 0,
        backgroundTimeoutCount: 0,
        urgentTaskExecuted: false,
        jumpedQueue: false,
        executionLog: []
      };

      if ('scheduler' in window) {
        const originalPostTask = (window.scheduler as any).postTask;
        if (originalPostTask) {
          (window.scheduler as any).postTask = function (callback: any, options: any) {
            const isBackground = options && options.priority === 'background';
            const taskId = isBackground ? 'BG' : 'URGENT';
            if (isBackground) {
              (window as any).__stats.backgroundTaskCount++;
            }
            
            const wrappedCallback = async function(this: any) {
                (window as any).__stats.executionLog.push(taskId + ' started');
                if (!isBackground) {
                     (window as any).__stats.urgentTaskExecuted = true;
                } else if ((window as any).__stats.urgentTaskExecuted) {
                     (window as any).__stats.jumpedQueue = true;
                }
                const result = await callback.apply(this || window, arguments);
                (window as any).__stats.executionLog.push(taskId + ' finished');
                return result;
            };
            return originalPostTask.apply(this, [wrappedCallback, options]);
          };
        }
      }

      const originalSetTimeout = window.setTimeout;
      window.setTimeout = (function (this: Window, handler: TimerHandler, timeout?: number, ...args: any[]) {
        if (timeout && timeout >= 10) { 
          (window as any).__stats.backgroundTimeoutCount++;
        }
        return originalSetTimeout.apply(this || window, [handler, timeout, ...args] as any);
      }) as any;
    });

    await page.goto(demoUrl);
  });

  test(`The application implements a mechanism to schedule low-priority background tasks`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const bgButton = page.locator('button', { hasText: /background/i }).first();
    if (await bgButton.count() > 0) {
      await bgButton.click();
    } else {
        // Fallback: click all buttons
        for (const btn of await page.locator('button').all()) {
            await btn.click();
        }
    }
    await page.waitForTimeout(100);

    const stats = await getYieldCounts(page);
    expect(stats.backgroundTaskCount > 0 || stats.backgroundTimeoutCount > 0).toBe(true);
  });

  test(`The application uses scheduler.postTask() with the priority: 'background' option`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const bgButton = page.locator('button', { hasText: /background/i }).first();
    if (await bgButton.count() > 0) {
      await bgButton.click();
    } else {
        for (const btn of await page.locator('button').all()) {
            await btn.click();
        }
    }
    await page.waitForTimeout(100);

    const stats = await getYieldCounts(page);
    expect(stats.backgroundTaskCount).toBeGreaterThan(0);
  });

  test(`The application uses a fallback mechanism (e.g., a delayed setTimeout) for browsers that do not support the Scheduler API`, async ({ page }) => {
    // Delete scheduler to simulate an older browser, forcing the fallback path
    await page.addInitScript(() => {
      delete (window as any).scheduler;
    });

    // Reload the page to apply the simulated older browser state
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const bgButton = page.locator('button', { hasText: /background/i }).first();
    if (await bgButton.count() > 0) {
      await bgButton.click();
    } else {
        for (const btn of await page.locator('button').all()) {
            await btn.click();
        }
    }
    await page.waitForTimeout(100);

    const stats = await getYieldCounts(page);
    expect(stats.backgroundTimeoutCount).toBeGreaterThan(0);
  });

  test(`The application ensures that urgent tasks or user interactions are prioritized and jump the queue ahead of scheduled background work`, async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    
    // Trigger the background tasks and then the urgent task from within the page
    // This avoids Playwright IPC delays causing the evaluate to be processed after all background tasks finish.
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const bgButton = buttons.find(b => /background/i.test(b.textContent || '')) || buttons[0];
        const urgentButton = buttons.find(b => /urgent/i.test(b.textContent || '')) || buttons[1];
        
        if (bgButton && urgentButton) {
            bgButton.click();
            // Schedule the urgent click to happen after the background tasks are queued.
            // Using a short timeout ensures the event loop has started processing postTasks,
            // but the urgent click will be queued before they all finish.
            setTimeout(() => {
                urgentButton.click();
            }, 50);
        }
    });
    
    // Wait for tasks to complete
    await page.waitForTimeout(4000); 

    const stats = await getYieldCounts(page);
    
    // The urgent task should execute before all background tasks finish.
    // If it did, jumpedQueue will be true (since a background task executed AFTER the urgent task).
    expect(stats.jumpedQueue).toBe(true);
  });
});
