import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

// Setup
const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable not set.');
}

const filePath = path.resolve(targetFile);
const targetDir = path.dirname(filePath);
const fileName = path.basename(filePath);
const demoUrl = `http://localhost/${fileName}`;

// Helper to get HTML content for static checks
const htmlContent = fs.readFileSync(filePath, 'utf-8');
const scriptContent = htmlContent.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/g)?.join('\n') || '';

test.describe(`Temporal API Guidance Expectations: ${fileName}`, () => {

  // 1. Feature detection MUST use typeof Temporal === 'undefined'
  test('Feature detection should use typeof Temporal === "undefined"', () => {
    const hasFeatureDetection = /typeof\s+Temporal\s+===\s+['"]undefined['"]/.test(scriptContent);
    expect(hasFeatureDetection, "Must use 'typeof Temporal === 'undefined'' for feature detection").toBe(true);
  });

  // 2. Conditional polyfill loading
  test('Should conditionally load the Temporal polyfill', () => {
    const hasConditionalLoading = /if\s*\(typeof\s+Temporal\s+===\s+['"]undefined['"]\)\s*\{[\s\S]*import\(/.test(scriptContent);
    expect(hasConditionalLoading, 'Must load the polyfill only if native support is absent').toBe(true);
  });

  // 3. Manual assignment to globalThis.Temporal
  test('Should manually assign polyfill to globalThis.Temporal', () => {
    const hasGlobalAssignment = /globalThis\.Temporal\s*=/.test(scriptContent) || /window\.Temporal\s*=/.test(scriptContent);
    expect(hasGlobalAssignment, 'Must assign the loaded polyfill to globalThis.Temporal').toBe(true);
  });

  // 4. Use Temporal.ZonedDateTime as primary type
  test('Should use Temporal.ZonedDateTime for calculations', () => {
    const hasZonedDateTime = /ZonedDateTime/.test(scriptContent);
    expect(hasZonedDateTime, 'Must use Temporal.ZonedDateTime for calculating differentials').toBe(true);
  });

  // 5. Use .since() for elapsed time
  test('Should use .since() to calculate elapsed time', () => {
    const hasSince = /\.since\(/.test(scriptContent);
    expect(hasSince, 'Must use the .since() method on a Temporal instance').toBe(true);
  });

  // 6. Use .until() for remaining time
  test('Should use .until() to calculate remaining time', () => {
    const hasUntil = /\.until\(/.test(scriptContent);
    expect(hasUntil, 'Must use the .until() method on a Temporal instance').toBe(true);
  });

  // 7. Specify largestUnit in .since()
  test('Should specify largestUnit in .since() options', () => {
    const hasLargestUnitInSince = /\.since\([^,]+,\s*\{[\s\S]*largestUnit:/.test(scriptContent);
    expect(hasLargestUnitInSince, 'Must specify largestUnit in the options object for .since()').toBe(true);
  });

  // 8. Specify largestUnit in .until()
  test('Should specify largestUnit in .until() options', () => {
    const hasLargestUnitInUntil = /\.until\([^,]+,\s*\{[\s\S]*largestUnit:/.test(scriptContent);
    expect(hasLargestUnitInUntil, 'Must specify largestUnit in the options object for .until()').toBe(true);
  });

  // 9. Use Temporal.ZonedDateTime.compare
  test('Should use Temporal.ZonedDateTime.compare for comparisons', () => {
    const hasCompare = /Temporal\.ZonedDateTime\.compare\(/.test(scriptContent);
    expect(hasCompare, 'Must use Temporal.ZonedDateTime.compare to compare date-time points').toBe(true);
  });

  // 10. No legacy Date for core calculations
  test('Should not use legacy Date for core calculations', () => {
    const usesDateForCalc = /new\s+Date\(\)[\s\S]*\.getTime\(\)/.test(scriptContent) || 
                            /new\s+Date\(.*\.value\)/.test(scriptContent);
    expect(usesDateForCalc, 'Must not use the legacy Date object for core event differential calculations').toBe(false);
  });

  // Setup browser testing
  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestPath = requestUrl.pathname;
      const localFilePath = path.join(targetDir, requestPath === `/${fileName}` ? fileName : requestPath.slice(1));

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  // Browser assertions: Verify Temporal is globally available (either native or polyfilled)
  test('Temporal should be available on the page and used by scripts', async ({ page }) => {
    const isTemporalDefinedAndUsed = await page.evaluate(() => {
      const isDefined = typeof (globalThis as any).Temporal !== 'undefined';
      const isUsed = Array.from(document.scripts).some(s => s.textContent && s.textContent.includes('Temporal'));
      return isDefined && isUsed;
    });
    expect(isTemporalDefinedAndUsed, 'Temporal should be defined and utilized in the page scripts').toBe(true);
  });

  // Browser assertions: Verify that immutability is respected
  test('Should use immutability correctly by using returned instances from add/subtract', async () => {
    const usesImmutability = /add\(|subtract\(/.test(scriptContent);
    expect(usesImmutability, 'Should use Temporal methods like add() or subtract() which return new instances').toBe(true);
  });
});
