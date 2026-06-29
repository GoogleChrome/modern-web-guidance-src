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

function getCombinedCode(): string {
  let code = fs.readFileSync(filePath, 'utf-8');
  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.mjs'))) {
        code += '\n' + fs.readFileSync(fullPath, 'utf-8');
      }
    }
  }
  scanDir(targetDir);
  return code;
}

test.describe(`Full-Session Analytics Expectations: ${demoName}`, () => {
  
  test('The fetchLater() API is invoked with a URL string and optionally a DeferredRequestInit object', () => {
    const code = getCombinedCode();
    const fetchLaterCalls = code.match(/fetchLater\s*\(/g) || [];
    // Expect at least two matches: one for the polyfill definition and one for the actual invocation.
    expect(fetchLaterCalls.length).toBeGreaterThan(1);
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
    const tryCatchRegex = /try\s*\{[\s\S]*?fetchLater\s*\([\s\S]*?\}[\s\S]*?catch\s*\(/;
    expect(tryCatchRegex.test(code)).toBeTruthy();
  });

  test('The fetchLater() polyfill should be included in the bundle', () => {
    const code = getCombinedCode();
    const hasPolyfill = code.includes('globalThis.fetchLater ??=');
    expect(hasPolyfill).toBeTruthy();
  });

});

test.describe(`Browser tests for Full-Session Analytics: ${demoName}`, () => {
  test.beforeEach(async ({ page }) => {
    // Route for serving the HTML file
    await page.route('http://localhost/*', async (route) => {
      const requestPath = new URL(route.request().url()).pathname;
      const sanitizedPath = requestPath === '/' ? demoName : requestPath.replace(/^\//, '');
      const localFilePath = path.join(targetDir, sanitizedPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    // Mock analytics endpoint to return 200 OK (matched first since it's registered last)
    await page.route(/.*\/path\/to\/analytics\/endpoint.*/, async (route) => {
      await route.fulfill({ status: 200, body: 'ok' });
    });
  });

  test('Only a single beacon should be sent, after the user leaves the page', async ({ page }) => {
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
    });

    await page.goto(demoUrl);
    
    // Wait a brief moment to allow any immediate incorrect beacons to fire
    await page.waitForTimeout(1000);
    
    const requestsBeforeLeave = analyticsRequests;
    
    // Simulate user leaving the page (visibility hidden)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'hidden',
        configurable: true
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Wait a bit for the polyfill to send the beacon
    await page.waitForTimeout(500);

    // Validate that EXACTLY 0 requests fired before leaving, and EXACTLY 1 fired in total after leaving.
    const isDeferredAndSingle = (requestsBeforeLeave === 0 && analyticsRequests === 1);
    
    expect(isDeferredAndSingle).toBe(true);
  });
});
