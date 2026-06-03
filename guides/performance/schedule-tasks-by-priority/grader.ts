import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not defined.');
}

const targetUrl = `file://${path.resolve(targetFile)}`;

async function injectSpy(page: any) {
  await page.addInitScript(() => {
    (window as any).__postTaskCalls = [];
    (window as any).__executionOrder = [];

    const spy = (orig: any) => {
      return function(this: any, task: any, options: any) {
        const priority = options?.priority || 'user-visible';
        (window as any).__postTaskCalls.push({ priority, options });

        const wrappedTask = async function(this: any, ...args: any[]) {
          (window as any).__executionOrder.push(priority);
          return task.apply(this, args);
        };

        return orig.call(this, wrappedTask, options);
      };
    };

    if ((window as any).scheduler && (window as any).scheduler.postTask) {
      (window as any).scheduler.postTask = spy((window as any).scheduler.postTask);
    }
  });
}

async function injectSpyWithNoNativeScheduler(page: any) {
  await page.addInitScript(() => {
    // Delete native scheduler completely to force polyfill loading
    delete (window as any).scheduler;
    if ((Window as any).prototype) {
      delete (Window as any).prototype.scheduler;
    }

    (window as any).__postTaskCalls = [];
    (window as any).__executionOrder = [];
  });
}

test.describe('Prioritized Task Scheduling API Grader', () => {

  test.beforeEach(async ({ page }) => {
    // Mock the network request to unpkg to return a fast, local mock polyfill
    await page.route(url => url.href.includes('scheduler-polyfill'), async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          if (!window.scheduler) {
            window.scheduler = {
              postTask: (task, options) => {
                setTimeout(task, 0);
                return Promise.resolve();
              }
            };
          }
        `
      });
    });
  });

  test('The application implements a mechanism to schedule tasks with different priorities using scheduler.postTask()', async ({ page }) => {
    await injectSpy(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const btn = page.locator('button', { hasText: /user-blocking/i }).first();
    await btn.click();

    try {
      await page.waitForFunction(() => (window as any).__postTaskCalls?.length > 0, undefined, { timeout: 300 });
    } catch (e) {}

    const calls = await page.evaluate(() => (window as any).__postTaskCalls || []);
    expect(calls.length).toBeGreaterThan(0);
  });

  test('The application demonstrates the use of different priorities (e.g., user-blocking, user-visible, background)', async ({ page }) => {
    await injectSpy(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const btnBlocking = page.locator('button', { hasText: /user-blocking/i }).first();
    await btnBlocking.click();

    const btnVisible = page.locator('button', { hasText: /user-visible/i }).first();
    await btnVisible.click();

    const btnBackground = page.locator('button', { hasText: /background/i }).first();
    await btnBackground.click();

    try {
      await page.waitForFunction(() => (window as any).__postTaskCalls?.length >= 3, undefined, { timeout: 300 });
    } catch (e) {}

    const calls = await page.evaluate(() => (window as any).__postTaskCalls || []);
    const priorities = calls.map((c: any) => c.priority);

    const hasAllPriorities = ['user-blocking', 'user-visible', 'background'].every(p => priorities.includes(p));
    expect(hasAllPriorities).toBe(true);
  });

  test('The application uses a polyfill to support task prioritization in browsers that do not support the Scheduler API natively', async ({ page }) => {
    await injectSpyWithNoNativeScheduler(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Wait for the polyfill to load and define scheduler.postTask
    try {
      await page.waitForFunction(() => typeof (window as any).scheduler?.postTask === 'function', undefined, { timeout: 500 });
    } catch (e) {}

    // Spy on the polyfilled scheduler.postTask
    await page.evaluate(() => {
      if ((window as any).scheduler && (window as any).scheduler.postTask) {
        const orig = (window as any).scheduler.postTask;
        (window as any).scheduler.postTask = function(this: any, task: any, options: any) {
          const priority = options?.priority || 'user-visible';
          (window as any).__postTaskCalls = (window as any).__postTaskCalls || [];
          (window as any).__postTaskCalls.push({ priority, options });

          const wrappedTask = async function(this: any, ...args: any[]) {
            (window as any).__executionOrder = (window as any).__executionOrder || [];
            (window as any).__executionOrder.push(priority);
            return task.apply(this, args);
          };

          return orig.call(this, wrappedTask, options);
        };
      }
    });

    const btn = page.locator('button', { hasText: /user-blocking/i }).first();
    await btn.click();

    try {
      await page.waitForFunction(() => (window as any).__postTaskCalls?.length > 0, undefined, { timeout: 300 });
    } catch (e) {}

    const calls = await page.evaluate(() => (window as any).__postTaskCalls || []);
    expect(calls.length).toBeGreaterThan(0);
  });

  test('The application conditionally loads the polyfill only when needed', async ({ page }) => {
    let polyfillRequested = false;
    page.on('request', request => {
      if (request.url().includes('scheduler-polyfill')) {
        polyfillRequested = true;
      }
    });

    await injectSpy(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    expect(polyfillRequested).toBe(false);
  });

  test('The application ensures that tasks are executed in priority order (higher priority tasks before lower priority ones)', async ({ page }) => {
    await injectSpy(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const btnBatch = page.locator('button', { hasText: /batch/i }).first();
    await btnBatch.click();

    try {
      await page.waitForFunction(() => (window as any).__executionOrder?.length >= 6, undefined, { timeout: 500 });
    } catch (e) {}

    const order = await page.evaluate(() => (window as any).__executionOrder || []);

    const priorityMap: Record<string, number> = {
      'user-blocking': 3,
      'user-visible': 2,
      'background': 1
    };
    const nums = order.map((p: string) => priorityMap[p] ?? 0);

    let isOrdered = nums.length >= 2;
    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i] < nums[i + 1]) {
        isOrdered = false;
        break;
      }
    }

    expect(isOrdered).toBe(true);
  });

});
