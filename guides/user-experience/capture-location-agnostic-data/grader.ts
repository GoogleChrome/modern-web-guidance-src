import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const demoName = path.basename(filePath);
const demoUrl = `http://localhost/${demoName}`;
const fileContent = fs.readFileSync(filePath, 'utf-8');

test.describe(`Temporal API Expectations: ${demoName}`, () => {

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

  test('MUST feature-detect the Temporal API using typeof Temporal === "undefined" before usage', async () => {
    const hasFeatureDetection = /typeof\s+Temporal\s*===\s*['"`]undefined['"`]/.test(fileContent);
    expect(hasFeatureDetection, "Expected to find typeof Temporal === 'undefined'").toBe(true);
  });

  test('MUST conditionally load a Temporal polyfill only if native support is absent', async () => {
    const hasUnconditionalImport = /import\s+[^('"`]*['"`][^'"`]*@js-temporal\/polyfill[^'"`]*['"`]/.test(fileContent);
    const hasDynamicImport = /import\s*\(\s*['"`][^'"`]*@js-temporal\/polyfill[^'"`]*['"`]\s*\)/.test(fileContent);
    
    expect(hasUnconditionalImport, "Expected NOT to find top-level static import of @js-temporal/polyfill").toBe(false);
    expect(hasDynamicImport, "Expected to find dynamic import() of @js-temporal/polyfill").toBe(true);
  });

  test('MUST manually assign the loaded polyfill to globalThis.Temporal', async () => {
    const assignsToGlobal = /globalThis\.Temporal\s*=/.test(fileContent) || /window\.Temporal\s*=/.test(fileContent);
    expect(assignsToGlobal, "Expected polyfill to be assigned to globalThis.Temporal").toBe(true);
  });

  test('MUST use Temporal.PlainDate for capturing calendar dates', async () => {
    // negative-demo uses Temporal.PlainDate for a log timestamp, not a calendar date (birthdate).
    // demo.html uses Temporal.PlainDate for the birthdate.
    const usesPlainDateForCalendar = /Temporal\.PlainDate\.from\([^)]*(date|birth|input)[^)]*\)/i.test(fileContent);
    expect(usesPlainDateForCalendar, "Expected to find Temporal.PlainDate usage for calendar dates (e.g. date/birth)").toBe(true);
  });

  test('MUST use Temporal.PlainTime for capturing wall-clock times', async () => {
    const usesPlainTime = /Temporal\.PlainTime/i.test(fileContent);
    expect(usesPlainTime, "Expected to find Temporal.PlainTime usage or mention").toBe(true);
  });

  test('MUST NOT use Temporal.PlainDate or Temporal.PlainTime for data that represents a specific moment in physical time', async () => {
    const badUsage = /const\s+[a-zA-Z0-9_]*(log|instant|timestamp)[a-zA-Z0-9_]*\s*=\s*Temporal\.(PlainDate|PlainTime)/i.test(fileContent);
    expect(badUsage, "Expected Temporal.PlainDate/Time NOT to be used for server logs or physical moments").toBe(false);
  });

  test('MUST NOT attempt to modify Temporal instances directly', async () => {
    const modifiesDirectly = /\.\s*(year|month|day|hour|minute|second|microsecond|nanosecond)\s*=[^=]/i.test(fileContent);
    expect(modifiesDirectly, "Expected NO direct modification of Temporal instances (they are immutable)").toBe(false);
  });

  test('MUST NOT use the legacy Date object for capturing or displaying location-agnostic calendar dates', async ({ page }) => {
    // negative-demo.html drifts when timezone changes.
    // demo.html PlainDate output does NOT drift when timezone changes.
    
    const tzSelect = page.locator('select').first();
    const dateInput = page.locator('input[type="date"]').first();
    
    const count = await dateInput.count();
    if (count === 0) return; // if no date input, assume passed or skip
    
    await dateInput.fill('1990-01-01');
    
    const getResultTexts = async () => {
      const locators = await page.locator('.result-value').all();
      const texts: string[] = [];
      for (const loc of locators) {
        texts.push((await loc.textContent()) || '');
      }
      return texts;
    };
    
    await tzSelect.selectOption({ label: 'UTC (Center)' }).catch(() => tzSelect.selectOption({ index: 0 }));
    await page.waitForTimeout(100);
    const initialTexts = await getResultTexts();
    
    await tzSelect.selectOption({ index: 4 }); // Honolulu or similar
    await page.waitForTimeout(100);
    const honoluluTexts = await getResultTexts();
    
    await tzSelect.selectOption({ index: 2 }); // Paris or similar
    await page.waitForTimeout(100);
    const parisTexts = await getResultTexts();
    
    let hasStableDate = false;
    for (let i = 0; i < initialTexts.length; i++) {
       const initial = initialTexts[i];
       const honolulu = honoluluTexts[i];
       const paris = parisTexts[i];
       
       if (initial.includes('1990') || initial.includes('1989')) {
         if (initial === honolulu && initial === paris && initial.includes('1990')) {
           hasStableDate = true;
         }
       }
    }
    
    expect(hasStableDate, "Expected at least one location-agnostic calendar date output to not drift across timezones").toBe(true);
  });
});
