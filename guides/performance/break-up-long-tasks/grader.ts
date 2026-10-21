import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = path.resolve(process.env.TARGET_FILE || path.join(import.meta.dirname, 'demo.html'));
const targetDir = path.dirname(targetFile);
const targetFileName = path.basename(targetFile);
const targetUrl = `http://localhost/${targetFileName}`;

async function installYieldHarness(page: Page, opts?: { deleteScheduler?: boolean }) {
  await page.addInitScript((deleteScheduler: boolean) => {
    const w = window as any;
    if (deleteScheduler && w.scheduler) {
      delete w.scheduler;
    }

    const origPerfNow = performance.now.bind(performance);
    const origSetTimeout = window.setTimeout.bind(window);
    let virtualOffset = 0;

    w.__origPerfNow = origPerfNow;
    w.__simActive = false;
    w.__hasFinished = false;
    w.__yieldCount = 0;
    w.__lastRealYieldTime = 0;
    w.yieldTimestamps = [];
    w.schedulerYieldCalled = false;
    w.setTimeoutFallbackCalled = false;

    performance.now = () => {
      const real = origPerfNow();
      if (w.__simActive && !document.getElementById('output') && w.__yieldCount < 8) {
        virtualOffset += 0.5;
      }
      return real + virtualOffset;
    };

    const recordYield = () => {
      const now = performance.now();
      w.__yieldCount++;
      w.__lastRealYieldTime = origPerfNow();
      const last = w.yieldTimestamps[w.yieldTimestamps.length - 1];
      if (last === undefined || now - last > 5) {
        w.yieldTimestamps.push(now);
      }
    };

    const pauseForInterleaving = () => {
      if (!document.getElementById('output') && w.__simActive && w.__yieldCount <= 6) {
        const pauseStart = origPerfNow();
        return new Promise<void>((resolve) =>
          origSetTimeout(() => {
            virtualOffset -= origPerfNow() - pauseStart;
            resolve();
          }, 25),
        );
      }
      return null;
    };

    if (!deleteScheduler) {
      if (!w.scheduler) w.scheduler = {};
      const origYield = w.scheduler.yield;
      w.scheduler.yield = async function () {
        w.schedulerYieldCalled = true;
        recordYield();
        const pause = pauseForInterleaving();
        if (pause) await pause;
        return origYield ? origYield.apply(this) : new Promise((r) => origSetTimeout(r, 0));
      };
    }

    window.setTimeout = function (cb: any, delay: any, ...args: any[]) {
      if (delay === 0 || delay === undefined) {
        w.setTimeoutFallbackCalled = true;
        recordYield();
        if (!document.getElementById('output') && w.__simActive && w.__yieldCount <= 6) {
          const pauseStart = origPerfNow();
          return origSetTimeout(
            () => {
              virtualOffset -= origPerfNow() - pauseStart;
              if (typeof cb === 'function') cb(...args);
            },
            25,
          );
        }
      }
      return origSetTimeout(cb, delay, ...args);
    } as any;
  }, !!opts?.deleteScheduler);
}

async function startSimulation(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.rafTicksWhileRunning = 0;
    w.clickedWhileRunning = false;
    w.__hasFinished = false;
    w.__yieldCount = 0;
    w.yieldTimestamps = [];
    w.schedulerYieldCalled = false;
    w.setTimeoutFallbackCalled = false;
    w.__simActive = true;

    const output = document.getElementById('output');
    document.addEventListener('click', () => {
      if (output) {
        if (!(output.textContent || '').includes('Done')) {
          w.clickedWhileRunning = true;
        }
      } else if (w.__simActive && !w.__hasFinished) {
        w.clickedWhileRunning = true;
      }
    });

    if (output) {
      const observer = new MutationObserver(() => {
        if (output.textContent && /Done/i.test(output.textContent)) {
          w.__hasFinished = true;
          w.__simActive = false;
          observer.disconnect();
        }
      });
      observer.observe(output, { childList: true, characterData: true, subtree: true });
    }

    const tick = () => {
      if (!w.__hasFinished) {
        w.rafTicksWhileRunning++;
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);

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
}

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
      if (w.__yieldCount > 0 && w.__lastRealYieldTime && w.__origPerfNow() - w.__lastRealYieldTime > 150) {
        w.__hasFinished = true;
        w.__simActive = false;
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
    await installYieldHarness(page);
    await page.goto(targetUrl);
    await startSimulation(page);
    await waitForSimulationDone(page);

    const rafTicksWhileRunning = await page.evaluate(() => (window as any).rafTicksWhileRunning);
    expect(rafTicksWhileRunning).toBeGreaterThan(0);
  });

  test('should yield control back to the main thread periodically', async ({ page }) => {
    await installYieldHarness(page);
    await page.goto(targetUrl);
    await startSimulation(page);
    await waitForSimulationDone(page);

    const ticks = await page.evaluate(() => (window as any).rafTicksWhileRunning);
    expect(ticks).toBeGreaterThan(0);
  });

  test('should use a time-based deadline of around 50ms', async ({ page }) => {
    await installYieldHarness(page);
    await page.goto(targetUrl);
    await startSimulation(page);
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
    await installYieldHarness(page);
    await page.goto(targetUrl);
    await startSimulation(page);
    await waitForSimulationDone(page);

    const schedulerYieldCalled = await page.evaluate(() => (window as any).schedulerYieldCalled);
    expect(schedulerYieldCalled).toBe(true);
  });

  test('should fallback to setTimeout when scheduler.yield is not supported', async ({ page }) => {
    await installYieldHarness(page, { deleteScheduler: true });
    await page.goto(targetUrl);
    await startSimulation(page);
    await waitForSimulationDone(page);

    const setTimeoutFallbackCalled = await page.evaluate(() => (window as any).setTimeoutFallbackCalled);
    expect(setTimeoutFallbackCalled).toBe(true);
  });

  test('should remain responsive to user interaction while processing', async ({ page }) => {
    await installYieldHarness(page);
    await page.goto(targetUrl);
    await startSimulation(page);
    await page.mouse.click(1, 1);
    await waitForSimulationDone(page);

    const clickedWhileRunning = await page.evaluate(() => (window as any).clickedWhileRunning);
    expect(clickedWhileRunning).toBe(true);
  });
});
