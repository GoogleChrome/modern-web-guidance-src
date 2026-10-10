/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@playwright/test';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

const htmlContent = fs.readFileSync(filePath, 'utf-8');
const scriptContent = htmlContent.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/g)?.join('\n') || '';

test.describe(`Sequencing Distributed Events Expectations: ${demoName}`, () => {

  // 1. Parse source-recorded timestamps with Temporal.Instant.from()
  test('Implementation MUST parse recorded timestamps using Temporal.Instant.from()', async () => {
    expect(scriptContent, 'Must parse the timestamps recorded by the source with Temporal.Instant.from()').toMatch(/\bInstant\.from\(/);
  });

  // 2. Sort events using Temporal.Instant.compare(a, b)
  test('Implementation MUST sort events using the native Temporal.Instant.compare(a, b) method', async () => {
    // Checked independently so comparators defined before the sort call (or toSorted()) still pass;
    // the browser test below verifies compare() is actually invoked at runtime.
    expect(scriptContent, 'Must sort the events').toMatch(/\.(?:sort|toSorted)\(/);
    expect(scriptContent, 'Must use Temporal.Instant.compare as the comparator').toMatch(/\bInstant\.compare\(/);
  });

  // 3. MUST NOT rely on Date parsing as the primary sort key
  test('Implementation MUST NOT sort events solely by Date-parsed timestamps', async () => {
    const usesTemporalCompare = /\bInstant\.compare\(/.test(scriptContent);
    const onlyDateSort = !usesTemporalCompare && /\.(?:sort|toSorted)\([\s\S]*?(getTime\(\)|Date\.parse\(|\.valueOf\(\))[\s\S]*?\)/.test(scriptContent);
    expect(onlyDateSort, 'Must not use Date-parsed millisecond values as the only sort key').toBe(false);
  });

  // 4. Calculate intervals with since()/until() and keep them as Durations
  test('Implementation MUST calculate intervals with Temporal.Instant.prototype.since() or .until()', async () => {
    expect(scriptContent, 'Must use .since() or .until() to compute the interval between events').toMatch(/\.(since|until)\(/);
  });

  // 5. Format intervals with toLocaleString(); no total('nanoseconds') / epochNanoseconds math
  test('Implementation MUST format intervals with toLocaleString() and MUST NOT use total(\'nanoseconds\') or epochNanoseconds arithmetic', async () => {
    expect(scriptContent, 'Must format Temporal.Duration values with toLocaleString()').toMatch(/\.toLocaleString\(/);
    expect(scriptContent, "Must not use duration.total('nanoseconds')").not.toMatch(/\.total\(\s*['"]nanoseconds?['"]/);
    expect(scriptContent, 'Must not do arithmetic on epochNanoseconds').not.toMatch(/epochNanoseconds\s*[-+*/<>]/);
  });

  // 6. Feature detection for Temporal support
  test('Implementation MUST include explicit feature detection for Temporal support', async () => {
    expect(scriptContent).toMatch(/typeof\s+Temporal/);
  });

  // 7. Fallback strategy
  test('A fallback strategy MUST be provided for environments lacking native support', async () => {
    const hasPolyfill = htmlContent.includes('@js-temporal/polyfill');
    const hasGlobalAssignment = /(globalThis|window)\.Temporal\s*=/.test(scriptContent);
    const hasGracefulDegradation = htmlContent.includes('unsupported') || htmlContent.includes('not supported');
    expect((hasPolyfill && hasGlobalAssignment) || hasGracefulDegradation).toBe(true);
  });

  // 8. Use equals() for instant equivalence rather than compare() === 0
  test('Implementation MUST NOT use Temporal.Instant.compare(a, b) === 0 for equality checks', async () => {
    expect(scriptContent).not.toMatch(/Temporal\.Instant\.compare\([^)]*\)\s*===?\s*0/);
  });

  // Browser tests
  test.beforeEach(async ({ page }) => {
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

  test('Browser: Application should detect and handle missing Temporal support', async ({ page }) => {
    // Ensure Temporal is missing initially
    await page.addInitScript(() => {
      delete (window as any).Temporal;
    });
    await page.reload();

    // Wait a short time for any dynamic polyfill imports to complete
    await page.waitForTimeout(1000);

    const isHandled = await page.evaluate(() => {
      const hasPolyfill = typeof (window as any).Temporal !== 'undefined';
      if (hasPolyfill) return true;

      const bodyText = document.body.innerText.toLowerCase();
      const hasWarning = bodyText.includes('temporal') && (bodyText.includes('support') || bodyText.includes('available') || bodyText.includes('not supported'));
      const btn = document.querySelector('button');
      const isBtnDisabled = btn && (btn as HTMLButtonElement).disabled;
      return !!(hasWarning || isBtnDisabled);
    });
    expect(isHandled).toBe(true);
  });

  test('Browser: Application should parse timestamps with Temporal.Instant.from() and sort with Temporal.Instant.compare()', async ({ page }) => {
    // Install the spies before any page script runs so implementations that parse/sort on
    // load (no button) are counted too. A getter/setter on globalThis.Temporal also wraps
    // a polyfill that is assigned later.
    await page.addInitScript(() => {
      const w = window as any;
      w.__temporalCalls = { from: 0, compare: 0 };
      const wrap = (T: any) => {
        if (!T || !T.Instant || T.Instant.__wrapped) return T;
        const originalFrom = T.Instant.from;
        const originalCompare = T.Instant.compare;
        T.Instant.from = function (...args: unknown[]) { w.__temporalCalls.from++; return originalFrom.apply(this, args); };
        T.Instant.compare = function (...args: unknown[]) { w.__temporalCalls.compare++; return originalCompare.apply(this, args); };
        T.Instant.__wrapped = true;
        return T;
      };
      let current = wrap(w.Temporal);
      Object.defineProperty(w, 'Temporal', {
        configurable: true,
        get() { return current; },
        set(v) { current = wrap(v); },
      });
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Click every button in case the implementation loads/sorts on demand.
    for (const btn of await page.$$('button')) {
      try { await btn.click({ timeout: 1000 }); } catch { /* disabled or hidden buttons are fine */ }
    }
    await page.waitForTimeout(300);

    const calls = await page.evaluate(() => (window as any).__temporalCalls);
    expect(calls.from, 'Must call Temporal.Instant.from() when loading events').toBeGreaterThan(0);
    expect(calls.compare, 'Must call Temporal.Instant.compare() when sorting events').toBeGreaterThan(0);
  });

});
