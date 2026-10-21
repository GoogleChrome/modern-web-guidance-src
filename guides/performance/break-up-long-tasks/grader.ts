import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = path.resolve(process.env.TARGET_FILE || path.join(import.meta.dirname, 'demo.html'));
const targetDir = path.dirname(targetFile);
const targetFileName = path.basename(targetFile);
const targetUrl = `http://localhost/${targetFileName}`;

async function waitForSimulationDone(page: Page) {
  const hasExplicitOutput = (await page.locator('#output').count()) > 0;
  if (hasExplicitOutput) {
    await expect(page.locator('#output')).toHaveText(/Done|complete|finished|processed/i, { timeout: 6000 });
    return;
  }
  await page.waitForFunction(
    () => {
      const w = window as any;
      if (w.__hasFinished) return true;
      if (w.__yieldCount > 0 && w.__lastYieldTime && performance.now() - w.__lastYieldTime > 250) {
        w.__hasFinished = true;
        return true;
      }
      return false;
    },
    { timeout: 6000 },
  );
}

test.describe('Scheduler Yield Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const reqPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const resolved = path.join(targetDir, reqPath === '/' ? targetFileName : reqPath.replace(/^\//, ''));
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        const ext = path.extname(resolved).toLowerCase();
        const contentType =
          ext === '.html'
            ? 'text/html'
            : ext === '.css'
              ? 'text/css'
              : ext === '.js' || ext === '.mjs'
                ? 'application/javascript'
                : undefined;
        await route.fulfill({ path: resolved, contentType });
      } else {
        await route.continue();
      }
    });
  });

  test('should process heavy computation asynchronously', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any;
      w.__yieldCount = 0;
      w.__lastYieldTime = 0;
      const trackYield = () => {
        w.__yieldCount++;
        w.__lastYieldTime = performance.now();
      };
      if (!w.scheduler) w.scheduler = {};
      const origYield = w.scheduler.yield;
      w.scheduler.yield = async function () {
        trackYield();
        return origYield ? origYield.apply(this) : new Promise((r) => setTimeout(r, 0));
      };
      const origSetTimeout = window.setTimeout;
      window.setTimeout = function (cb: any, delay: any, ...args: any[]) {
        if (delay === 0 || delay === undefined) trackYield();
        return origSetTimeout(cb, delay, ...args);
      } as any;
    });

    await page.goto(targetUrl);

    await page.evaluate(() => {
      const w = window as any;
      w.rafTicksWhileRunning = 0;
      w.__hasFinished = false;

      const findStartBtn = (): HTMLButtonElement | null => {
        const byId = document.getElementById('start-btn') as HTMLButtonElement | null;
        if (byId) return byId;
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
        return (
          buttons.find(
            (b) =>
              !b.classList.contains('nav-cta') &&
              !b.classList.contains('btn-primary') &&
              !b.classList.contains('btn-ghost') &&
              !b.classList.contains('card-btn') &&
              !b.closest('dialog') &&
              /start|simulat|run|process|calculat|analyz|blend|batch|recipe|heavy/i.test(
                `${b.id} ${b.className} ${b.textContent || ''}`,
              ),
          ) || null
        );
      };

      const targetContainer = document.getElementById('output') || document.body;
      const observer = new MutationObserver(() => {
        const outEl = document.getElementById('output');
        if (outEl) {
          if (outEl.textContent && /Done/i.test(outEl.textContent)) {
            w.__hasFinished = true;
            observer.disconnect();
          }
        } else if (
          w.__yieldCount > 0 &&
          /done|complete|finished|all\s+.*processed|100%/i.test(document.body.textContent || '')
        ) {
          w.__hasFinished = true;
          observer.disconnect();
        }
      });
      observer.observe(targetContainer, { childList: true, characterData: true, subtree: true });

      const tick = () => {
        if (!w.__hasFinished) {
          w.rafTicksWhileRunning++;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      findStartBtn()?.click();
    });

    await waitForSimulationDone(page);

    const rafTicksWhileRunning = await page.evaluate(() => (window as any).rafTicksWhileRunning);
    expect(rafTicksWhileRunning).toBeGreaterThan(0);
  });

  test('should yield control back to the main thread periodically', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any;
      w.__yieldCount = 0;
      w.__lastYieldTime = 0;
      const trackYield = () => {
        w.__yieldCount++;
        w.__lastYieldTime = performance.now();
      };
      if (!w.scheduler) w.scheduler = {};
      const origYield = w.scheduler.yield;
      w.scheduler.yield = async function () {
        trackYield();
        return origYield ? origYield.apply(this) : new Promise((r) => setTimeout(r, 0));
      };
      const origSetTimeout = window.setTimeout;
      window.setTimeout = function (cb: any, delay: any, ...args: any[]) {
        if (delay === 0 || delay === undefined) trackYield();
        return origSetTimeout(cb, delay, ...args);
      } as any;
    });

    await page.goto(targetUrl);

    await page.evaluate(() => {
      const w = window as any;
      w.yieldTicksWhileRunning = 0;
      w.__hasFinished = false;

      const findStartBtn = (): HTMLButtonElement | null => {
        const byId = document.getElementById('start-btn') as HTMLButtonElement | null;
        if (byId) return byId;
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
        return (
          buttons.find(
            (b) =>
              !b.classList.contains('nav-cta') &&
              !b.classList.contains('btn-primary') &&
              !b.classList.contains('btn-ghost') &&
              !b.classList.contains('card-btn') &&
              !b.closest('dialog') &&
              /start|simulat|run|process|calculat|analyz|blend|batch|recipe|heavy/i.test(
                `${b.id} ${b.className} ${b.textContent || ''}`,
              ),
          ) || null
        );
      };

      const targetContainer = document.getElementById('output') || document.body;
      const observer = new MutationObserver(() => {
        const outEl = document.getElementById('output');
        if (outEl) {
          if (outEl.textContent && /Done/i.test(outEl.textContent)) {
            w.__hasFinished = true;
            observer.disconnect();
          }
        } else if (
          w.__yieldCount > 0 &&
          /done|complete|finished|all\s+.*processed|100%/i.test(document.body.textContent || '')
        ) {
          w.__hasFinished = true;
          observer.disconnect();
        }
      });
      observer.observe(targetContainer, { childList: true, characterData: true, subtree: true });

      const tick = () => {
        if (!w.__hasFinished) {
          w.yieldTicksWhileRunning++;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      findStartBtn()?.click();
    });

    await waitForSimulationDone(page);

    const ticks = await page.evaluate(() => (window as any).yieldTicksWhileRunning);
    expect(ticks).toBeGreaterThan(0);
  });

  test('should use a time-based deadline of around 50ms', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any;
      w.yieldTimestamps = [];
      w.__yieldCount = 0;
      w.__lastYieldTime = 0;
      const recordYield = () => {
        const now = performance.now();
        w.__yieldCount++;
        w.__lastYieldTime = now;
        const last = w.yieldTimestamps[w.yieldTimestamps.length - 1];
        if (last === undefined || now - last > 5) {
          w.yieldTimestamps.push(now);
        }
      };

      if (!w.scheduler) {
        w.scheduler = {} as any;
      }
      const originalYield = w.scheduler.yield;
      w.scheduler.yield = async function () {
        recordYield();
        if (originalYield) {
          return originalYield.apply(this);
        }
        return new Promise((resolve) => setTimeout(resolve, 0));
      };

      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function (cb: any, delay: any, ...args: any[]) {
        if (delay === 0 || delay === undefined) {
          recordYield();
        }
        return originalSetTimeout(cb, delay, ...args);
      } as any;
    });

    await page.goto(targetUrl);

    await page.evaluate(() => {
      const byId = document.getElementById('start-btn') as HTMLButtonElement | null;
      const btn =
        byId ||
        Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (b) =>
            !b.classList.contains('nav-cta') &&
            !b.classList.contains('btn-primary') &&
            !b.classList.contains('btn-ghost') &&
            !b.classList.contains('card-btn') &&
            !b.closest('dialog') &&
            /start|simulat|run|process|calculat|analyz|blend|batch|recipe|heavy/i.test(
              `${b.id} ${b.className} ${b.textContent || ''}`,
            ),
        );
      btn?.click();
    });

    await waitForSimulationDone(page);

    const timestamps: number[] = await page.evaluate(() => (window as any).yieldTimestamps);

    expect(timestamps.length).toBeGreaterThan(1);

    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    expect(avgInterval).toBeGreaterThanOrEqual(25);
    expect(avgInterval).toBeLessThanOrEqual(110);
  });

  test('should use scheduler.yield if available', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any;
      w.schedulerYieldCalled = false;
      w.__yieldCount = 0;
      w.__lastYieldTime = 0;
      if (!w.scheduler) {
        w.scheduler = {} as any;
      }
      const originalYield = w.scheduler.yield;
      w.scheduler.yield = async function () {
        w.schedulerYieldCalled = true;
        w.__yieldCount++;
        w.__lastYieldTime = performance.now();
        if (originalYield) {
          return originalYield.apply(this);
        }
        return new Promise((resolve) => setTimeout(resolve, 0));
      };
    });

    await page.goto(targetUrl);

    await page.evaluate(() => {
      const byId = document.getElementById('start-btn') as HTMLButtonElement | null;
      const btn =
        byId ||
        Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (b) =>
            !b.classList.contains('nav-cta') &&
            !b.classList.contains('btn-primary') &&
            !b.classList.contains('btn-ghost') &&
            !b.classList.contains('card-btn') &&
            !b.closest('dialog') &&
            /start|simulat|run|process|calculat|analyz|blend|batch|recipe|heavy/i.test(
              `${b.id} ${b.className} ${b.textContent || ''}`,
            ),
        );
      btn?.click();
    });

    await waitForSimulationDone(page);

    const schedulerYieldCalled = await page.evaluate(() => (window as any).schedulerYieldCalled);
    expect(schedulerYieldCalled).toBe(true);
  });

  test('should fallback to setTimeout when scheduler.yield is not supported', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any;
      if (w.scheduler) {
        delete w.scheduler;
      }

      w.setTimeoutFallbackCalled = false;
      w.__yieldCount = 0;
      w.__lastYieldTime = 0;
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function (cb: any, delay: any, ...args: any[]) {
        if (delay === 0 || delay === undefined) {
          w.setTimeoutFallbackCalled = true;
          w.__yieldCount++;
          w.__lastYieldTime = performance.now();
        }
        return originalSetTimeout(cb, delay, ...args);
      } as any;
    });

    await page.goto(targetUrl);

    await page.evaluate(() => {
      const byId = document.getElementById('start-btn') as HTMLButtonElement | null;
      const btn =
        byId ||
        Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (b) =>
            !b.classList.contains('nav-cta') &&
            !b.classList.contains('btn-primary') &&
            !b.classList.contains('btn-ghost') &&
            !b.classList.contains('card-btn') &&
            !b.closest('dialog') &&
            /start|simulat|run|process|calculat|analyz|blend|batch|recipe|heavy/i.test(
              `${b.id} ${b.className} ${b.textContent || ''}`,
            ),
        );
      btn?.click();
    });

    await waitForSimulationDone(page);

    const setTimeoutFallbackCalled = await page.evaluate(() => (window as any).setTimeoutFallbackCalled);
    expect(setTimeoutFallbackCalled).toBe(true);
  });

  test('should remain responsive to user interaction while processing', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as any;
      w.__yieldCount = 0;
      w.__lastYieldTime = 0;
      w.__isRunning = false;
      const trackYield = () => {
        w.__yieldCount++;
        w.__lastYieldTime = performance.now();
        w.__isRunning = true;
      };
      if (!w.scheduler) w.scheduler = {};
      const origYield = w.scheduler.yield;
      w.scheduler.yield = async function () {
        trackYield();
        return origYield ? origYield.apply(this) : new Promise((r) => setTimeout(r, 0));
      };
      const origSetTimeout = window.setTimeout;
      window.setTimeout = function (cb: any, delay: any, ...args: any[]) {
        if (delay === 0 || delay === undefined) trackYield();
        return origSetTimeout(cb, delay, ...args);
      } as any;
    });

    await page.goto(targetUrl);

    await page.evaluate(() => {
      const w = window as any;
      w.clickedWhileRunning = false;
      const output = document.getElementById('output');
      document.addEventListener('click', () => {
        if (output) {
          const text = output.textContent || '';
          if (!text.includes('Done')) {
            w.clickedWhileRunning = true;
          }
        } else if (w.__isRunning && !w.__hasFinished) {
          w.clickedWhileRunning = true;
        }
      });

      const byId = document.getElementById('start-btn') as HTMLButtonElement | null;
      const btn =
        byId ||
        Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
          (b) =>
            !b.classList.contains('nav-cta') &&
            !b.classList.contains('btn-primary') &&
            !b.classList.contains('btn-ghost') &&
            !b.classList.contains('card-btn') &&
            !b.closest('dialog') &&
            /start|simulat|run|process|calculat|analyz|blend|batch|recipe|heavy/i.test(
              `${b.id} ${b.className} ${b.textContent || ''}`,
            ),
        );
      btn?.click();
    });

    await page.mouse.click(1, 1);

    await waitForSimulationDone(page);

    const clickedWhileRunning = await page.evaluate(() => (window as any).clickedWhileRunning);
    expect(clickedWhileRunning).toBe(true);
  });
});
