import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is not defined.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const targetFileName = path.basename(filePath);
const targetUrl = `http://localhost/${targetFileName}`;

function getScriptContent(): string {
  const isDemoTarget = targetFileName === 'demo.html' || targetFileName === 'negative-demo.html';
  const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const files: string[] = [filePath];
  if (isDemoTarget) {
    const srcMatches = html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi);
    for (const match of srcMatches) {
      const src = match[1];
      if (!/^https?:\/\//i.test(src) && !src.startsWith('//')) {
        const resolved = path.resolve(targetDir, src.replace(/^\/+/, ''));
        if (resolved.startsWith(targetDir + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          files.push(resolved);
        }
      }
    }
  } else {
    const excludedDirs = new Set(['node_modules', 'vendor', 'test', 'tests', 'grade-report', 'test-results', 'dist', '.git']);
    const walk = (dir: string) => {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!excludedDirs.has(entry.name)) walk(fullPath);
          } else if (
            entry.isFile() &&
            (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) &&
            !entry.name.includes('.test.') &&
            !entry.name.includes('.spec.') &&
            !entry.name.includes('.config.') &&
            entry.name !== 'grade.mjs' &&
            entry.name !== 'run.mjs'
          ) {
            files.push(fullPath);
          }
        }
      } catch {}
    };
    walk(targetDir);
  }
  return [...new Set(files)].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
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
    await page.route('http://localhost/**', async (route) => {
      const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relPath = requestPath === '/' ? targetFileName : requestPath.replace(/^\/+/, '');
      const localFilePath = path.resolve(targetDir, relPath);
      if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
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

    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(b => b.click());
    });

    const calls = await page.evaluate(() => (window as any).__postTaskCalls || []);
    const code = getScriptContent();
    if (calls.length > 0) {
      expect(calls.length).toBeGreaterThan(0);
      return;
    }
    expect(code.includes('postTask') || code.includes('scheduler.postTask')).toBe(true);
  });

  test('The application demonstrates the use of different priorities (e.g., user-blocking, user-visible, background)', async ({ page }) => {
    await injectSpy(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      document.querySelectorAll('button').forEach(b => b.click());
    });

    const calls = await page.evaluate(() => (window as any).__postTaskCalls || []);
    // At least two distinct priorities must actually be passed to scheduler.postTask()
    const priorities = new Set(calls.map((c: any) => c.priority));
    expect(priorities.size).toBeGreaterThanOrEqual(2);
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
    await page.goto(targetUrl, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');

    expect(polyfillRequested).toBe(false);
  });

  test('The application ensures that tasks are executed in priority order (higher priority tasks before lower priority ones)', async ({ page }) => {
    await injectSpy(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Click only the batch button and capture the priorities it queues synchronously
    const queued: string[] = await page.evaluate(() => {
      const w = window as any;
      w.__postTaskCalls.length = 0;
      w.__executionOrder.length = 0;
      const batch = Array.from(document.querySelectorAll('button')).find((b) => /batch|mixed/i.test(b.textContent || ''));
      batch?.click();
      return w.__postTaskCalls.map((c: any) => c.priority);
    });
    expect(new Set(queued).size).toBeGreaterThanOrEqual(2);

    await expect
      .poll(() => page.evaluate(() => (window as any).__executionOrder.length))
      .toBeGreaterThanOrEqual(queued.length);
    const order: string[] = await page.evaluate(() => (window as any).__executionOrder);
    const rank: Record<string, number> = { 'user-blocking': 0, 'user-visible': 1, background: 2 };
    // Tasks queued together must run highest priority first, whatever order they were queued in
    const ran = order.slice(0, queued.length).map((p) => rank[p]);
    expect(ran).toEqual([...ran].sort((a, b) => a - b));
  });

});
