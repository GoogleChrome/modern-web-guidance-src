import { test, expect } from '@playwright/test';
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

// Tests
test.describe(`identify-scripts-delaying-rendering Expectations: ${demoName}`, () => {
  // Functional/Static assertions
  test('should specify type "long-animation-frame" in PerformanceObserver.observe', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('long-animation-frame');
  });

  test('should specify buffered: true in PerformanceObserver.observe', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('buffered: true');
  });

  test('should not include any performance polyfill scripts in the HTML source', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toMatch(/polyfill/i);
  });

  test('should not use the legacy "longtask" entry type in the HTML source', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toContain('longtask');
  });

  test('should not use the JS Self-Profiling API (Profiler) in the HTML source', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).not.toContain('Profiler');
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    // Mocking to capture calls to PerformanceObserver.observe and Profiler
    await page.addInitScript(() => {
      (window as any)._observeCalls = [];
      const OriginalObserver = window.PerformanceObserver;
      if (OriginalObserver) {
        const originalObserve = OriginalObserver.prototype.observe;
        OriginalObserver.prototype.observe = function(this: any, options: any) {
          (window as any)._observeCalls.push(options);
          return originalObserve.call(this, options);
        };
      }

      (window as any)._profilerConstructed = false;
      const trackProfiler = () => {
        (window as any)._profilerConstructed = true;
      };

      if ('Profiler' in window) {
        const OriginalProfiler = (window as any).Profiler;
        const MockProfiler = function(this: any, ...args: any[]) {
          trackProfiler();
          return new (OriginalProfiler as any)(...args);
        };
        MockProfiler.prototype = OriginalProfiler.prototype;
        (window as any).Profiler = MockProfiler;
      } else {
        (window as any).Profiler = class {
          constructor() { trackProfiler(); }
          stop() { return Promise.resolve({}); }
        };
      }
    });

    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  // Browser assertions
  test('browser: PerformanceObserver.observe should be called with type "long-animation-frame"', async ({ page }) => {
    const observeCalls = await page.evaluate(() => (window as any)._observeCalls);
    const hasLoAF = observeCalls.some((c: any) => c.type === 'long-animation-frame');
    expect(hasLoAF).toBe(true);
  });

  test('browser: PerformanceObserver.observe should be called with buffered: true', async ({ page }) => {
    const observeCalls = await page.evaluate(() => (window as any)._observeCalls);
    const hasBuffered = observeCalls.some((c: any) => c.buffered === true);
    expect(hasBuffered).toBe(true);
  });

  test('browser: PerformanceObserver.observe should use the "type" property instead of "entryTypes"', async ({ page }) => {
    const observeCalls = await page.evaluate(() => (window as any)._observeCalls);
    const usesType = observeCalls.some((c: any) => 'type' in c);
    expect(usesType).toBe(true);
  });

  test('browser: JS Self-Profiling API (Profiler) should not be used', async ({ page }) => {
    const profilerUsed = await page.evaluate(() => (window as any)._profilerConstructed);
    expect(profilerUsed).toBe(false);
  });

  test('browser: no script tags containing "polyfill" in their source should exist', async ({ page }) => {
    const polyfillCount = await page.evaluate(() => document.querySelectorAll('script[src*="polyfill"]').length);
    expect(polyfillCount).toBe(0);
  });
});
