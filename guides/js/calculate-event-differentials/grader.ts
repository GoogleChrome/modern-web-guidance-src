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

// Helper to get HTML and external JS/MJS content for static checks
const htmlContent = fs.readFileSync(filePath, 'utf-8');
const inlineScripts = htmlContent.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/g)?.join('\n') || '';
const externalScripts = (() => {
  const results: string[] = [];
  const walk = (dir: string) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === 'vendor' ||
          entry.name === 'lib' ||
          entry.name === 'test-results' ||
          entry.name === 'grade-report' ||
          entry.name.startsWith('.')
        ) {
          continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (
          (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) &&
          !entry.name.includes('.test.') &&
          entry.name !== 'grade.mjs' &&
          entry.name !== 'run.mjs'
        ) {
          results.push(fs.readFileSync(fullPath, 'utf-8'));
        }
      }
    } catch {}
  };
  walk(targetDir);
  return results.join('\n');
})();
const scriptContent = `${inlineScripts}\n${externalScripts}`;

test.describe(`Temporal API Guidance Expectations: ${fileName}`, () => {

  // 1. Feature detection MUST use typeof Temporal === 'undefined' or globalThis.Temporal check
  test('Feature detection should use typeof Temporal === "undefined"', () => {
    const hasFeatureDetection =
      /typeof\s+(?:(?:globalThis|window)\.)?Temporal\s*[!=]==?\s*['"]undefined['"]/.test(scriptContent) ||
      /(?:globalThis|window)\.Temporal\s*(?:\?\?|\|\||\?\.|===?\s*undefined|!==?\s*undefined)/.test(scriptContent) ||
      /['"]Temporal['"]\s+in\s+(?:globalThis|window)/.test(scriptContent);
    expect(hasFeatureDetection, "Must feature-detect Temporal before usage").toBe(true);
  });

  // 2. Conditional polyfill loading
  test('Should conditionally load the Temporal polyfill', () => {
    const hasConditionalLoading =
      /if\s*\([^)]*Temporal[^)]*\)\s*\{?[\s\S]{0,250}?\bimport\s*\(/.test(scriptContent) ||
      /(?:globalThis|window)\.Temporal[\s\S]{0,120}(?:\?\?|\|\||\?)[\s\S]{0,120}\bimport\s*\(/.test(scriptContent);
    expect(hasConditionalLoading, 'Must load the polyfill only if native support is absent').toBe(true);
  });

  // 3. Manual assignment to globalThis.Temporal (or module-scoped Temporal if not relying on global)
  test('Should manually assign polyfill to globalThis.Temporal', () => {
    const hasGlobalAssignment =
      /(?:globalThis|window)\.Temporal\s*=/.test(scriptContent) ||
      /\{\s*Temporal(?:\s*:\s*\w+)?\s*\}\s*=\s*[\s\S]{0,80}\bimport\s*\(/.test(scriptContent) ||
      /(?:const|let|var)\s+\w+\s*=\s*[\s\S]{0,160}\bimport\s*\([\s\S]{0,80}\.Temporal\b/.test(scriptContent);
    expect(hasGlobalAssignment, 'Must assign the loaded polyfill to globalThis.Temporal or module-scoped Temporal').toBe(true);
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
    await page.route('http://localhost/**', async (route) => {
      const requestUrl = new URL(route.request().url());
      const requestPath = decodeURIComponent(requestUrl.pathname);
      const relPath = requestPath === `/${fileName}` || requestPath === '/' ? fileName : requestPath.replace(/^\/+/, '');
      const localFilePath = path.resolve(targetDir, relPath);

      if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });

    await page.goto(demoUrl);
  });

  // Browser assertions: Verify Temporal is globally available (either native or polyfilled)
  test('Temporal should be available on the page and used by scripts', async ({ page }) => {
    const isTemporalDefined = await page.evaluate(() => {
      return typeof (globalThis as any).Temporal !== 'undefined';
    });
    const isUsed = /Temporal/.test(scriptContent);
    expect(isTemporalDefined && isUsed, 'Temporal should be defined and utilized in the page scripts').toBe(true);
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
