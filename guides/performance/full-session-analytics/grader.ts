import { test, expect, expectNever } from '../../test-fixture.ts';
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
            (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.mjs')) &&
            entry.name !== 'grader.ts' &&
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

test.describe(`Full-Session Analytics Expectations: ${demoName}`, () => {
  
  test('The fetchLater() API is invoked with a URL string and a DeferredRequestInit object', () => {
    const code = getCombinedCode();
    const hasFetchLaterInvocation = /(?:globalThis\.|window\.)?\bfetchLater\s*\(\s*[^)]+/.test(code);
    expect(hasFetchLaterInvocation).toBe(true);
  });

  test('The fetchLater() API is the only API used for beacons (no direct fetch, sendBeacon, XMLHttpRequest, or new Image)', () => {
    const code = getCombinedCode();
    const usesXhr = code.includes('XMLHttpRequest');
    const usesImage = code.includes('new Image');
    const directFetch = code.includes('fetch(ANALYTICS_ENDPOINT');
    const directSendBeacon = code.includes('sendBeacon(ANALYTICS_ENDPOINT');
    
    const hasForbiddenUsage = usesXhr || usesImage || directFetch || directSendBeacon;
    expect(hasForbiddenUsage).toBeFalsy();
  });

  test('If a fetchLater() call throws a QuotaExceededError, it is properly handled with a try/catch', () => {
    const code = getCombinedCode();
    const tryCatchRegex = /try\s*\{[\s\S]*?fetchLater\s*\([\s\S]*?\}[\s\S]*?catch\s*(?:\(|\{)/;
    expect(tryCatchRegex.test(code)).toBeTruthy();
  });

  test('The fetchLater() polyfill is included in the bundle', () => {
    const code = getCombinedCode();
    const hasPolyfill =
      code.includes('globalThis.fetchLater ??=') ||
      /(?:globalThis|window)\.fetchLater\s*(?:\?\?=|\|\|=|=)/.test(code);
    expect(hasPolyfill).toBeTruthy();
  });

});

test.describe(`Browser tests for Full-Session Analytics: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/*', async (route) => {
      const urlStr = route.request().url();
      if (urlStr.includes('/analytics/endpoint')) {
        await route.fulfill({ status: 200, body: 'ok' });
        return;
      }
      if (urlStr.startsWith('http://localhost') || urlStr.startsWith('http://127.0.0.1')) {
        const requestPath = decodeURIComponent(new URL(urlStr).pathname);
        const sanitizedPath = requestPath === '/' ? demoName : requestPath.replace(/^\/+/, '');
        const localFilePath = path.resolve(targetDir, sanitizedPath);

        if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
          await route.fulfill({ path: localFilePath });
          return;
        }
      }
      await route.continue();
    });
  });

  test('Only a single beacon is sent, after the user leaves the page', async ({ page }) => {
    let analyticsRequests = 0;
    page.on('request', request => {
      if (request.url().includes('/analytics/endpoint')) {
        analyticsRequests++;
      }
    });

    // Force the usage of the polyfill for deterministic testing of the deferred logic
    await page.addInitScript(() => {
      delete (window as any).fetchLater;
      delete (globalThis as any).fetchLater;
      (window as any).__prematureFlush = false;
      const origSendBeacon = navigator.sendBeacon;
      if (origSendBeacon) {
        navigator.sendBeacon = function(...args) {
          (window as any).__prematureFlush = true;
          return origSendBeacon.apply(this, args);
        };
      }
      const origFetch = window.fetch;
      window.fetch = function(...args: any[]) {
        const url = String(args[0] || '');
        if (url.includes('/analytics/endpoint')) {
          (window as any).__prematureFlush = true;
        }
        return origFetch.apply(this, args as any);
      };
    });

    await page.goto(demoUrl);
    
    // Assert no immediate incorrect beacons fire before leaving
    await expectNever(page, () => Boolean((window as any).__prematureFlush), { forMs: 300 });
    expect(analyticsRequests).toBe(0);
    
    // Simulate user leaving the page (visibility hidden)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'hidden',
        configurable: true
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait for the polyfill to send the beacon
    await expect.poll(() => analyticsRequests).toBe(1);
  });
});
