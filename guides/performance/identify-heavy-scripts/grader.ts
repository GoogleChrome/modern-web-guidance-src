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
const demoUrl = `http://localhost/${demoName}?performance=1&debug=1`;

function getCombinedCode(): string {
  const isDemoTarget = demoName === 'demo.html' || demoName === 'negative-demo.html';
  const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
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
  return [...new Set(files)].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf-8')).join('\n');
}

test.describe(`Identify Heavy Scripts Expectations: ${demoName}`, () => {
  // Static assertions
  test('No polyfill for Long Animation Frames should be included', async () => {
    const code = getCombinedCode();
    // Check for explicit polyfill attempts for PerformanceLongAnimationFrame
    const polyfillPattern = /PerformanceLongAnimationFrame\s*=/;
    expect(code).not.toMatch(polyfillPattern);
  });

  // Browser tests
  test.describe('Performance Monitoring Implementation', () => {
    test.beforeEach(async ({ page }) => {
      // Set up routing to serve local files
      await page.route('http://localhost/**', async (route) => {
        const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
        const relPath = requestPath === '/' ? demoName : requestPath.replace(/^\/+/, '');
        const localFilePath = path.resolve(targetDir, relPath);

        if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
          await route.fulfill({ path: localFilePath });
        } else {
          await route.continue();
        }
      });

      // Inject spy before any other script runs
      await page.addInitScript(() => {
        (window as any)._observeCalls = [];
        
        const originalPerformanceObserver = window.PerformanceObserver;
        
        // Mock PerformanceObserver if not present or to ensure we can spy
        if (typeof originalPerformanceObserver === 'undefined') {
          (window as any).PerformanceObserver = class {
            callback: any;
            constructor(callback: any) { this.callback = callback; }
            observe(options: any) { (window as any)._observeCalls.push(options); }
            disconnect() {}
            takeRecords() { return []; }
            static supportedEntryTypes = ['long-animation-frame', 'resource', 'longtask'];
          };
        } else {
          const originalObserve = originalPerformanceObserver.prototype.observe;
          originalPerformanceObserver.prototype.observe = function(options: any) {
            (window as any)._observeCalls.push(options);
            // We record the call but may catch errors from the real API if the browser 
            // version doesn't support the specific type yet.
            try {
              return originalObserve.apply(this, arguments as any);
            } catch {
              // Swallow errors from the real API to keep the script running for the grader
            }
          };
        }
      });

      await page.goto(demoUrl);
    });

    test('should use the "type" property in PerformanceObserver.observe instead of "entryTypes"', async ({ page }) => {
      const calls = await page.evaluate(() => (window as any)._observeCalls);
      const hasTypeProp = calls.some((opt: any) => opt && typeof opt === 'object' && 'type' in opt);
      expect(hasTypeProp).toBe(true);
    });

    test('should specify "long-animation-frame" as the observation type', async ({ page }) => {
      const calls = await page.evaluate(() => (window as any)._observeCalls);
      const hasLoAF = calls.some((opt: any) => opt && opt.type === 'long-animation-frame');
      expect(hasLoAF).toBe(true);
    });

    test('should enable the "buffered" option to capture past performance entries', async ({ page }) => {
      const calls = await page.evaluate(() => (window as any)._observeCalls);
      const hasBuffered = calls.some((opt: any) => opt && opt.buffered === true);
      expect(hasBuffered).toBe(true);
    });

    test('should not use the legacy "entryTypes" property for this API', async ({ page }) => {
      const calls = await page.evaluate(() => (window as any)._observeCalls);
      const usesEntryTypes = calls.some((opt: any) => opt && 'entryTypes' in opt);
      expect(usesEntryTypes).toBe(false);
    });
  });
});
