import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;

test.describe(`Temporal API Event Differentials: ${demoName}`, () => {
  
  // 1. Feature Detection
  test('MUST check if typeof Temporal === "undefined" before using the API', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Expect a check for Temporal being undefined before initializing logic
    expect(html).toMatch(/typeof\s+Temporal\s*===\s*['"]undefined['"]/);
  });

  // 2. ZonedDateTime Selection
  test('MUST use Temporal.ZonedDateTime for event differentials', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Calculations for event differentials require ZonedDateTime
    expect(html).toContain('Temporal.ZonedDateTime');
  });

  // 3. Since Method
  test('MUST use the .since() method to calculate elapsed time', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Using .since() is mandatory for calculating active time
    expect(html).toContain('.since(');
  });

  // 4. Until Method
  test('MUST use the .until() method to calculate remaining time', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Using .until() is mandatory for calculating remaining time
    expect(html).toContain('.until(');
  });

  // 5. Largest Unit
  test('MUST use largestUnit when calculating differences', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Controlling precision with largestUnit ensures balanced durations
    expect(html).toContain('largestUnit');
  });

  // 6. Temporal Comparison
  test('MUST use Temporal.ZonedDateTime.compare for date comparison', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Comparison of time points should be done via .compare()
    expect(html).toContain('Temporal.ZonedDateTime.compare');
  });

  // 7. Immutability
  test('MUST NOT mutate existing Temporal instances', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Temporal objects are immutable. Assignments like .day = 1 are errors in logic.
    const propertyMutation = /\.(year|month|day|hour|minute|second)\s*=\s*/;
    expect(html).not.toMatch(propertyMutation);
  });

  // 8. Conditional Polyfill Loading
  test('MUST load the polyfill conditionally (no unconditional script tags)', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Unconditional script tags for polyfills are forbidden
    const unconditionalScript = /<script\s+[^>]*src=[^>]*@js-temporal\/polyfill[^>]*>/i;
    expect(html).not.toMatch(unconditionalScript);
  });

  // Browser Tests
  test.beforeEach(async ({ page }) => {
    // Inject polyfill for browsers that do not natively support it (like standard Chromium).
    // This allows the demo code to run functionally if it handles Temporal support correctly.
    await page.addInitScript(async () => {
      if (typeof (globalThis as any).Temporal === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@js-temporal/polyfill@0.4.4/dist/index.umd.js';
        script.async = false;
        document.head.appendChild(script);
        await new Promise(resolve => script.onload = resolve);
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

  // 9. Functional Test: Accurate Duration Calculation
  test('Should accurately calculate elapsed time across month boundaries', async ({ page }) => {
    // Fill in dates that cross a month boundary to expose manual subtraction flaws
    const startInput = await page.$('#startDate, #startInput');
    const endInput = await page.$('#endDate, #endInput');
    
    if (startInput && endInput) {
      // 2025-01-25
      await startInput.fill('2025-01-25');
      // 2025-02-05
      await endInput.fill('2025-02-05');
      
      const calcBtn = await page.$('#calcBtn');
      if (calcBtn) await calcBtn.click();
      
      await page.waitForTimeout(100);
      
      const activeText = await page.innerText('#activeValue, #activeResult');
      // Negative-demo.html will show "-24 days" if today's day is 1
      // or other incorrect values if it just subtracts days.
      expect(activeText).not.toContain('-');
      
      const statusElement = await page.$('#statusValue, #statusResult');
      if (statusElement) {
          const statusText = await statusElement.innerText();
          // Today is 2026-04-01. Expiration is 2025-02-05. Should be EXPIRED.
          expect(statusText.toUpperCase()).toContain('EXPIRED');
      }
    } else {
      throw new Error('Could not find date inputs');
    }
  });

  // 10. Manual Arithmetic Check
  test('MUST NOT use manual property subtraction for date arithmetic', async () => {
    const html = fs.readFileSync(filePath, 'utf-8');
    // Manual subtraction of .day, .month, or .year is error-prone.
    // negative-demo.html has today.day - startDate.day
    const manualArithmetic = /\.(day|month|year)\s*-\s*/;
    expect(html).not.toMatch(manualArithmetic);
  });

});
