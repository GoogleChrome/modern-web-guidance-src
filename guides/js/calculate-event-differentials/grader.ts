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

  // 7. Use Duration.sign or Temporal.ZonedDateTime.compare for status checks
  test('Should use Duration .sign or Temporal.ZonedDateTime.compare for comparisons', () => {
    const hasCompare = /Temporal\.ZonedDateTime\.compare\(/.test(scriptContent);
    const hasSign = /\.sign\b/.test(scriptContent);
    expect(hasCompare || hasSign, 'Must use the Duration .sign property or Temporal.ZonedDateTime.compare to determine past/future status').toBe(true);
  });

  // 8. Combine date and time inputs by chaining Temporal methods, not string interpolation
  test('Should combine date and time inputs with PlainDate.toPlainDateTime() instead of string interpolation', () => {
    const usesInterpolatedIso = /Plain(?:Date)?Time\.from\(\s*`[^`]*\$\{[^}]+\}T\$\{/.test(scriptContent) ||
                                /PlainDateTime\.from\(\s*[\w.]+\s*\+\s*['"]T['"]/.test(scriptContent);
    expect(usesInterpolatedIso, 'Must not build an ISO string from separate date and time inputs; chain Temporal methods instead').toBe(false);
    const usesChain = /\.toPlainDateTime\(|\.toZonedDateTime\(\s*\{[^}]*plainTime/.test(scriptContent);
    expect(usesChain, 'Must combine date and time inputs with Temporal methods (e.g. PlainDate.toPlainDateTime() or toZonedDateTime({ timeZone, plainTime }))').toBe(true);
  });

  // 9. Format durations for display with toLocaleString()
  test('Should format durations with toLocaleString() instead of manual unit concatenation', () => {
    const usesLocaleString = /\.toLocaleString\(/.test(scriptContent);
    expect(usesLocaleString, 'Must format durations for display with Temporal.Duration.prototype.toLocaleString()').toBe(true);
    const manualUnitString = /\$\{\s*\w+\.(?:years|months|days|hours|minutes)\s*\}\s*(?:y|mo|m|d|h|days?|hours?|minutes?)\b/.test(scriptContent);
    expect(manualUnitString, 'Must not hand-assemble duration strings from individual unit fields').toBe(false);
  });

  // 10. No brittle .slice(0, 5) for PlainTime formatting
  test('Should not use .slice(0, 5) to format PlainTime values', () => {
    const usesSlice = /\.slice\(\s*0\s*,\s*5\s*\)/.test(scriptContent);
    expect(usesSlice, 'Must use toPlainTime().toString({ smallestUnit: "minute" }) instead of .slice(0, 5)').toBe(false);
  });

  // 11. No legacy Date for core calculations
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

  // Browser assertions: Verify that immutability is respected if date arithmetic is performed
  test('Should use immutability correctly if performing date arithmetic', async () => {
    const usesDateMath = /add\(|subtract\(/.test(scriptContent);
    if (usesDateMath) {
      // Check that they don't just call add/subtract on a standalone line without using the result
      const isAssignedOrChained = /(=|return|\bconst\b|\blet\b|\bvar\b|\.add\(.*?\)\.|\.subtract\(.*?\)\.)/.test(scriptContent);
      expect(isAssignedOrChained, 'Must use the returned instance of add() or subtract() because Temporal objects are immutable').toBe(true);
    }
  });
});
