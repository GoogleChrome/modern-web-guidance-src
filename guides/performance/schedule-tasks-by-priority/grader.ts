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
    const validPriorities = new Set(
      calls
        .map((c: any) => c.priority)
        .filter((p: string) => ['user-blocking', 'user-visible', 'background'].includes(p))
    );
    expect(validPriorities.size).toBeGreaterThanOrEqual(2);
  });

  test('The application uses a polyfill to support task prioritization in browsers that do not support the Scheduler API natively', async ({ page }) => {
    let polyfillRequested = false;
    page.on('request', request => {
      if (request.url().includes('scheduler-polyfill')) {
        polyfillRequested = true;
      }
    });

    await page.addInitScript(() => {
      delete (window as any).scheduler;
      delete (Window.prototype as any).scheduler;
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    const code = getScriptContent();
    expect(polyfillRequested || code.includes('scheduler-polyfill')).toBe(true);
  });

  test('The application conditionally loads the polyfill only when needed', async ({ page, context }) => {
    let polyfillRequestedWhenSupported = false;
    page.on('request', request => {
      if (request.url().includes('scheduler-polyfill')) {
        polyfillRequestedWhenSupported = true;
      }
    });

    await injectSpy(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    expect(polyfillRequestedWhenSupported).toBe(false);

    const unsupportedPage = await context.newPage();
    await unsupportedPage.route('http://localhost/**', async (route) => {
      const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const relPath = requestPath === '/' ? targetFileName : requestPath.replace(/^\/+/, '');
      const localFilePath = path.resolve(targetDir, relPath);
      if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
    await unsupportedPage.route(url => url.href.includes('scheduler-polyfill'), async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'window.scheduler = { postTask: (cb) => Promise.resolve().then(cb) };'
      });
    });
    let polyfillRequestedWhenUnsupported = false;
    unsupportedPage.on('request', request => {
      if (request.url().includes('scheduler-polyfill')) {
        polyfillRequestedWhenUnsupported = true;
      }
    });
    await unsupportedPage.addInitScript(() => {
      delete (window as any).scheduler;
      delete (Window.prototype as any).scheduler;
    });
    await unsupportedPage.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await unsupportedPage.waitForTimeout(300);
    await unsupportedPage.close();

    expect(polyfillRequestedWhenUnsupported).toBe(true);
  });

  test('The application ensures that tasks are executed in priority order (higher priority tasks before lower priority ones)', async ({ page }) => {
    await injectSpy(page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const batchBtn = page.locator('button', { hasText: /batch|mixed|all|queue/i }).first();
    if (await batchBtn.count() > 0) {
      await page.evaluate(() => {
        (window as any).__executionOrder = [];
        (window as any).__postTaskCalls = [];
      });
      await batchBtn.click().catch(() => {});
    } else {
      const buttons = await page.locator('button').all();
      for (const btn of buttons) {
        await btn.click().catch(() => {});
      }
    }
    await page.waitForTimeout(500);

    const order: string[] = await page.evaluate(() => (window as any).__executionOrder || []);
    expect(order.length).toBeGreaterThanOrEqual(2);
    const blockingIdx = order.indexOf('user-blocking');
    const visibleIdx = order.indexOf('user-visible');
    const backgroundIdx = order.lastIndexOf('background');
    expect(blockingIdx).toBeGreaterThanOrEqual(0);
    expect(backgroundIdx).toBeGreaterThan(blockingIdx);
    if (visibleIdx !== -1) {
      expect(blockingIdx).toBeLessThan(visibleIdx);
      expect(visibleIdx).toBeLessThan(backgroundIdx);
    }
  });

});
