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

test.describe(`Sequencing Distributed Events Expectations: ${demoName}`, () => {
  
  // 1. Capture high-frequency timestamps using Temporal.Now.instant()
  test('Implementation MUST capture high-frequency timestamps using Temporal.Now.instant()', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('Temporal.Now.instant()');
  });

  // 2. Sort events using Temporal.Instant.compare(a, b)
  test('Implementation MUST sort events using the native Temporal.Instant.compare(a, b) method', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toContain('Temporal.Instant.compare');
  });

  // 3. MUST NOT use standard Date.now() as the primary mechanism for event sorting
  test('Implementation MUST use Temporal.Instant.compare for sorting to ensure nanosecond-level ordering', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // We check if Temporal.Instant.compare is used in a sort() call or similar
    expect(html).toMatch(/\.sort\(.*Temporal\.Instant\.compare.*\)/s);
  });

  // 4. Feature detection for Temporal support
  test('Implementation MUST include explicit feature detection for Temporal support', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    expect(html).toMatch(/typeof\s+Temporal/);
  });

  // 5. Fallback strategy
  test('A fallback strategy MUST be provided for environments lacking native support', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    const hasPolyfill = html.includes('@js-temporal/polyfill') || html.includes('cdn.jsdelivr.net/npm/@js-temporal/polyfill');
    const hasGracefulDegradation = html.includes('unsupported') || html.includes('not supported') || html.includes("Temporal === 'undefined'") || html.includes("typeof Temporal === 'undefined'");
    expect(hasPolyfill || hasGracefulDegradation).toBe(true);
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
    // Ensure Temporal is missing
    await page.addInitScript(() => {
      delete (window as any).Temporal;
    });
    await page.reload();

    const isHandled = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      const hasWarning = bodyText.includes('temporal') && (bodyText.includes('support') || bodyText.includes('available'));
      const btn = document.querySelector('button');
      const isBtnDisabled = btn && (btn as HTMLButtonElement).disabled;
      return !!(hasWarning || isBtnDisabled);
    });
    expect(isHandled).toBe(true);
  });

  test('Browser: Application should call Temporal.Now.instant() when generating events', async ({ page }) => {
    // Provide mock Temporal
    await page.addInitScript(() => {
      (window as any).Temporal = {
        Now: {
          instant: () => ({
            toString: () => '2026-04-01T12:00:00.000000000Z',
            since: () => ({ 
              total: () => 0,
              toString: () => 'PT0S'
            })
          })
        },
        Instant: {
          compare: () => 0
        }
      };
    });
    await page.reload();

    const wasCalled = await page.evaluate(async () => {
      let called = false;
      const original = (window as any).Temporal.Now.instant;
      (window as any).Temporal.Now.instant = () => {
        called = true;
        return original();
      };
      
      const btn = document.querySelector('button') as HTMLButtonElement;
      if (btn) {
        btn.click();
        // Small delay for any processing
        await new Promise(r => setTimeout(r, 200));
      }
      return called;
    });
    
    expect(wasCalled).toBe(true);
  });

});
