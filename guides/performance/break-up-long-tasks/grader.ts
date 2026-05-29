import { test, expect } from '@playwright/test';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE || path.join(import.meta.dirname, 'demo.html');

test.describe('Scheduler Yield Tests', () => {
  test('should process heavy computation asynchronously', async ({ page }) => {
    await page.goto(`file://${targetFile}`);

    // Set up browser-side recorder using MutationObserver to detect async frame rendering
    await page.evaluate(() => {
      (window as any).rafTicksWhileRunning = 0;
      (window as any).hasFinished = false;

      const output = document.getElementById('output')!;
      const observer = new MutationObserver(() => {
        if (output.textContent && output.textContent.includes('Done')) {
          (window as any).hasFinished = true;
          observer.disconnect();
        }
      });
      observer.observe(output, { childList: true, characterData: true, subtree: true });

      const tick = () => {
        if (!(window as any).hasFinished) {
          (window as any).rafTicksWhileRunning++;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      document.getElementById('start-btn')!.click();
    });

    const output = page.locator('#output');
    await expect(output).toHaveText(/Done/, { timeout: 5000 });

    const rafTicksWhileRunning = await page.evaluate(() => (window as any).rafTicksWhileRunning);
    expect(rafTicksWhileRunning).toBeGreaterThan(0);
  });

  test('should yield control back to the main thread periodically', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    
    // Set up browser-side recorder to count frames rendered during active execution
    await page.evaluate(() => {
      (window as any).yieldTicksWhileRunning = 0;
      (window as any).hasFinished = false;

      const output = document.getElementById('output')!;
      const observer = new MutationObserver(() => {
        if (output.textContent && output.textContent.includes('Done')) {
          (window as any).hasFinished = true;
          observer.disconnect();
        }
      });
      observer.observe(output, { childList: true, characterData: true, subtree: true });

      const tick = () => {
        if (!(window as any).hasFinished) {
          (window as any).yieldTicksWhileRunning++;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      document.getElementById('start-btn')!.click();
    });
    
    const output = page.locator('#output');
    await expect(output).toHaveText(/Done/, { timeout: 5000 });
    
    const ticks = await page.evaluate(() => {
      return (window as any).yieldTicksWhileRunning;
    });
    
    // In demo.html, because it yields periodically, yieldTicksWhileRunning should be > 0.
    // In negative-demo.html, it will be 0.
    expect(ticks).toBeGreaterThan(0);
  });

  test('should use a time-based deadline of around 50ms', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).yieldTimestamps = [];
      const recordYield = () => {
        const now = performance.now();
        const last = (window as any).yieldTimestamps[(window as any).yieldTimestamps.length - 1];
        if (last === undefined || now - last > 5) {
          (window as any).yieldTimestamps.push(now);
        }
      };

      if (!window.scheduler) {
        window.scheduler = {} as any;
      }
      const originalYield = window.scheduler.yield;
      window.scheduler.yield = async function() {
        recordYield();
        if (originalYield) {
          return originalYield.apply(this);
        }
        return new Promise(resolve => setTimeout(resolve, 0));
      };

      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function(cb: any, delay: any, ...args: any[]) {
        if (delay === 0 || delay === undefined) {
          recordYield();
        }
        return originalSetTimeout(cb, delay, ...args);
      } as any;
    });

    await page.goto(`file://${targetFile}`);

    // Trigger click atomically via evaluate
    await page.evaluate(() => {
      document.getElementById('start-btn')!.click();
    });

    const output = page.locator('#output');
    await expect(output).toHaveText(/Done/, { timeout: 5000 });
    
    const timestamps: number[] = await page.evaluate(() => (window as any).yieldTimestamps);
    
    expect(timestamps.length).toBeGreaterThan(1);
    
    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    // Expected average interval between yields should be around 50ms.
    // Allow a reasonable range (35ms to 95ms) for varying CPU speeds.
    expect(avgInterval).toBeGreaterThanOrEqual(35);
    expect(avgInterval).toBeLessThanOrEqual(95);
  });

  test('should use scheduler.yield if available', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).schedulerYieldCalled = false;
      if (!window.scheduler) {
        window.scheduler = {} as any;
      }
      const originalYield = window.scheduler.yield;
      window.scheduler.yield = async function() {
        (window as any).schedulerYieldCalled = true;
        if (originalYield) {
          return originalYield.apply(this);
        }
        return new Promise(resolve => setTimeout(resolve, 0));
      };
    });

    await page.goto(`file://${targetFile}`);

    await page.evaluate(() => {
      document.getElementById('start-btn')!.click();
    });

    const output = page.locator('#output');
    await expect(output).toHaveText(/Done/, { timeout: 5000 });
    
    const schedulerYieldCalled = await page.evaluate(() => (window as any).schedulerYieldCalled);
    expect(schedulerYieldCalled).toBe(true);
  });

  test('should fallback to setTimeout when scheduler.yield is not supported', async ({ page }) => {
    await page.addInitScript(() => {
      if ((window as any).scheduler) {
        delete (window as any).scheduler;
      }
      
      (window as any).setTimeoutFallbackCalled = false;
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function(cb: any, delay: any, ...args: any[]) {
        if (delay === 0 || delay === undefined) {
          (window as any).setTimeoutFallbackCalled = true;
        }
        return originalSetTimeout(cb, delay, ...args);
      } as any;
    });

    await page.goto(`file://${targetFile}`);

    await page.evaluate(() => {
      document.getElementById('start-btn')!.click();
    });

    const output = page.locator('#output');
    await expect(output).toHaveText(/Done/, { timeout: 5000 });
    
    const setTimeoutFallbackCalled = await page.evaluate(() => (window as any).setTimeoutFallbackCalled);
    expect(setTimeoutFallbackCalled).toBe(true);
  });

  test('should remain responsive to user interaction while processing', async ({ page }) => {
    await page.goto(`file://${targetFile}`);
    
    // Set up browser-side click listener on document and trigger start click
    await page.evaluate(() => {
      (window as any).clickedWhileRunning = false;
      const output = document.getElementById('output')!;
      document.addEventListener('click', () => {
        const text = output.textContent || '';
        if (!text.includes('Done')) {
          (window as any).clickedWhileRunning = true;
        }
      });

      document.getElementById('start-btn')!.click();
    });
    
    // Inject a mouse click at coordinates (1, 1) during the run
    await page.mouse.click(1, 1);
    
    const output = page.locator('#output');
    // Wait for the task to finish completely
    await expect(output).toHaveText(/Done/, { timeout: 5000 });
    
    const clickedWhileRunning = await page.evaluate(() => (window as any).clickedWhileRunning);
    expect(clickedWhileRunning).toBe(true);
  });
});
