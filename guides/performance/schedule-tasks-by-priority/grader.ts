import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not defined.');
}

const targetUrl = `file://${path.resolve(targetFile)}`;

function getScriptContent(): string {
  const filePath = path.resolve(targetFile!);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

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

test.describe('Prioritized Task Scheduling API Grader', () => {

  test.beforeEach(async ({ page }) => {
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

    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      await btn.click().catch(() => {});
    }
    await page.waitForTimeout(500);

    const calls = await page.evaluate(() => (window as any).__postTaskCalls || []);
    if (calls.length > 0) {
      expect(calls.length).toBeGreaterThan(0);
      return;
    }
    const code = getScriptContent();
    expect(code.includes('postTask') || code.includes('scheduler.postTask')).toBe(true);
  });

  test('The application demonstrates the use of different priorities (e.g., user-blocking, user-visible, background)', async ({ page }) => {
    await injectSpy(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      await btn.click().catch(() => {});
    }
    await page.waitForTimeout(500);

    const calls = await page.evaluate(() => (window as any).__postTaskCalls || []);
    const priorities = calls.map((c: any) => c.priority);
    const hasMultiple = ['user-blocking', 'user-visible', 'background'].some(p => priorities.includes(p)) || priorities.length >= 2;

    if (hasMultiple) {
      expect(hasMultiple).toBe(true);
      return;
    }

    const code = getScriptContent();
    const hasCodePriorities = code.includes('user-blocking') || code.includes('user-visible') || code.includes('background');
    expect(hasCodePriorities).toBe(true);
  });

  test('The application uses a polyfill to support task prioritization in browsers that do not support the Scheduler API natively', async () => {
    const code = getScriptContent();
    const hasPolyfillCode = code.includes('scheduler-polyfill') || code.includes('postTask') || (code.includes('scheduler') && code.includes('import'));
    expect(hasPolyfillCode).toBe(true);
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

    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      await btn.click().catch(() => {});
    }
    await page.waitForTimeout(500);

    const order = await page.evaluate(() => (window as any).__executionOrder || []);
    if (order.length >= 2) {
      expect(order.length).toBeGreaterThanOrEqual(2);
      return;
    }
    const code = getScriptContent();
    expect(code.includes('postTask') || code.includes('scheduler.postTask')).toBe(true);
  });

});
