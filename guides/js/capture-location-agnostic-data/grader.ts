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

function getCombinedCode(): string {
  const html = fs.readFileSync(filePath, 'utf-8');
  const parts = [html];
  if (demoName === 'demo.html' || demoName === 'negative-demo.html') {
    for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
      const src = m[1];
      if (/^https?:\/\//i.test(src)) continue;
      const localPath = path.resolve(targetDir, src.replace(/^\/+/, ''));
      if (localPath.startsWith(targetDir + path.sep) && fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
        parts.push(fs.readFileSync(localPath, 'utf-8'));
      }
    }
    return parts.join('\n');
  }
  const excludedDirs = new Set(['node_modules', 'vendor', 'test', 'tests', 'grade-report', 'test-results', 'dist', '.git']);
  const walk = (dir: string) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!excludedDirs.has(entry.name)) walk(path.join(dir, entry.name));
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) &&
          entry.name !== 'grade.mjs' &&
          entry.name !== 'run.mjs' &&
          !entry.name.includes('.config.') &&
          !entry.name.includes('.test.') &&
          !entry.name.includes('.spec.')
        ) {
          parts.push(fs.readFileSync(path.join(dir, entry.name), 'utf-8'));
        }
      }
    } catch {
      // ignore read errors
    }
  };
  walk(targetDir);
  return parts.join('\n');
}

const fileContent = getCombinedCode();

test.describe(`Temporal API Expectations: ${demoName}`, () => {

  test.beforeEach(async ({ page }) => {
    await page.route('http://localhost/**', async (route) => {
      const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
      const localFilePath = path.join(targetDir, requestPath === '/' ? demoName : requestPath.replace(/^\//, ''));
      if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
    await page.goto(demoUrl);
  });

  test('MUST feature-detect the Temporal API before usage', async () => {
    const hasFeatureDetection =
      /(typeof\s+(?:(?:globalThis|window|self)\.)?Temporal|['"]Temporal['"]\s+in\b|!\s*(?:globalThis|window|self)\.Temporal\b|(?:globalThis|window|self)\.Temporal\s*(?:\?\?|\|\||\?|!==|===|!=|==)?)/i.test(
        fileContent
      );
    expect(hasFeatureDetection, "Expected to find some form of feature detection for Temporal").toBe(true);
  });

  test('MUST conditionally load a Temporal polyfill only if native support is absent', async () => {
    // A static import is `import x from '...polyfill'` or `import '...polyfill'`; `import(` is dynamic.
    const hasUnconditionalImport = /import\s+(?!\()[^('"`]*['"`][^'"`]*polyfill[^'"`]*['"`]/i.test(fileContent);
    const hasDynamicImport = /import\s*\(\s*['"`][^'"`]*polyfill[^'"`]*['"`]\s*\)/i.test(fileContent);
    
    expect(hasUnconditionalImport, "Expected NOT to find top-level static import of polyfill").toBe(false);
    expect(hasDynamicImport, "Expected to find dynamic import() of polyfill").toBe(true);
  });

  test('MUST ensure the Temporal API is available globally', async () => {
    // Require an actual global assignment (`typeof Temporal === 'undefined'` must not count)
    // or destructuring `{ Temporal } = await import(...)` from the dynamic polyfill import.
    const assignsToGlobal =
      /(?:globalThis|window|self)\.Temporal\s*(?:\?\?=|\|\|=|=(?!=))/.test(fileContent) ||
      /\{\s*Temporal\s*\}\s*=\s*await\s+import\s*\(/.test(fileContent) ||
      /(?:const|let|var)\s+(?:temporal|Temporal)\s*=\s*(?:globalThis|window|self)\.Temporal\s*(?:\?\?|\|\|)/.test(fileContent);
    expect(assignsToGlobal, "Expected polyfill to be assigned to global scope (e.g. globalThis.Temporal = ...)").toBe(true);
  });

  test('MUST use Temporal.PlainDate for capturing calendar dates', async () => {
    // negative-demo uses Temporal.PlainDate for a log timestamp, not a calendar date (birthdate).
    // demo.html uses Temporal.PlainDate for the birthdate.
    const usesPlainDateForCalendar = /Temporal\.Plain(?:Date|MonthDay|YearMonth)/i.test(fileContent);
    expect(usesPlainDateForCalendar, "Expected to find Temporal.PlainDate (or PlainMonthDay/PlainYearMonth) usage for calendar dates").toBe(true);
  });

  test('MUST use Temporal.PlainTime for capturing wall-clock times', async () => {
    // Require an actual construction call (from() or the constructor), not just a mention of the type in prose.
    const usesPlainTime = /(?:Temporal\.PlainTime\.from|new\s+Temporal\.PlainTime)\s*\(/i.test(fileContent);
    expect(usesPlainTime, "Expected to find Temporal.PlainTime construction for wall-clock times (e.g. reminder/alarm)").toBe(true);
  });

  test('MUST NOT use Temporal.PlainDate or Temporal.PlainTime for data that represents a specific moment in physical time', async () => {
    // Match identifiers that *start with* or camelCase/snake_case-contain log/instant/timestamp,
    // without tripping on substrings like `catalogDate` or `dialogDate`.
    const badUsage = /(?:const|let|var)\s+(?:log|instant|timestamp|\w*(?:Log|Instant|Timestamp|_log|_instant|_timestamp))\w*\s*=\s*Temporal\.(?:PlainDate|PlainTime)/.test(fileContent);
    expect(badUsage, "Expected Temporal.PlainDate/Time NOT to be used for server logs or physical moments").toBe(false);
  });

  test('MUST NOT construct legacy Date objects from hand-assembled ISO strings', async () => {
    // e.g. new Date(`${selectedDate}T00:00:00Z`) or new Date(dateStr + 'T00:00:00Z')
    const handBuiltIso = /new\s+Date\s*\(\s*(`[^`]*\$\{[^}]+\}[^`]*T\d{2}:\d{2}|[^)]*\+\s*['"`]T\d{2}:\d{2})/.test(fileContent);
    expect(handBuiltIso, "Expected NO new Date() built from hand-assembled ISO strings").toBe(false);

    // Only if the implementation constructs a Date from a value at all must the conversion go through
    // Temporal (epochMilliseconds on Instant/ZonedDateTime, or Date#toTemporalInstant for the reverse).
    const constructsDateFromValue = /new\s+Date\s*\(\s*[^)\s]/.test(fileContent);
    if (constructsDateFromValue) {
      const usesTemporalInterop = /epochMilliseconds|toTemporalInstant\s*\(/.test(fileContent);
      expect(usesTemporalInterop, "Expected legacy Date interop to go through Temporal epochMilliseconds / toTemporalInstant()").toBe(true);
    }
  });

  test('MUST NOT use Intl.DateTimeFormat.prototype.formatToParts() to extract date parts', async () => {
    // Ban formatToParts() only when its output is mined for year/month/day parts; other uses (e.g. styled
    // display of a genuine instant) are legitimate and unrelated to Plain types.
    const extractsPartsWithFormatToParts = /formatToParts\s*\([^)]*\)[\s\S]{0,400}?type\s*===?\s*['"](?:year|month|day)['"]/.test(fileContent);
    expect(extractsPartsWithFormatToParts, "Expected NO formatToParts() used to extract year/month/day; read fields from Temporal plain types and compare with .equals()").toBe(false);
  });

  test('MUST NOT attempt to modify Temporal instances directly', async () => {
    const modifiesDirectly = /\.\s*(year|month|day|hour|minute|second|microsecond|nanosecond)\s*=[^=]/i.test(fileContent);
    expect(modifiesDirectly, "Expected NO direct modification of Temporal instances (they are immutable)").toBe(false);
  });


});
