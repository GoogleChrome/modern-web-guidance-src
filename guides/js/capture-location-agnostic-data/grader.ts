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
      /(typeof\s+(?:globalThis\.|window\.)?Temporal|['"]Temporal['"]\s+in|!\s*(?:globalThis|window)\.Temporal\b|(?:globalThis|window)\.Temporal\s*(?:\?\?|\|\||\?|!==|===|!=|==))/i.test(
        fileContent
      );
    expect(hasFeatureDetection, "Expected to find some form of feature detection for Temporal").toBe(true);
  });

  test('MUST conditionally load a Temporal polyfill only if native support is absent', async () => {
    const hasUnconditionalImport = /import\s+[^('"`]*['"`][^'"`]*polyfill[^'"`]*['"`]/i.test(fileContent);
    const hasDynamicImport = /import\s*\(\s*['"`][^'"`]*polyfill[^'"`]*['"`]\s*\)/i.test(fileContent);
    
    expect(hasUnconditionalImport, "Expected NOT to find top-level static import of polyfill").toBe(false);
    expect(hasDynamicImport, "Expected to find dynamic import() of polyfill").toBe(true);
  });

  test('MUST ensure the Temporal API is available globally', async () => {
    const assignsToGlobal =
      /(globalThis|window)?\.?Temporal\s*(?:\?\?=|\|\|=|=)/.test(fileContent) ||
      /\{\s*Temporal\s*\}\s*=\s*await\s+import\s*\(/.test(fileContent);
    expect(assignsToGlobal, "Expected polyfill to be assigned to global scope or Temporal object initialized").toBe(true);
  });

  test('MUST use Temporal.PlainDate for capturing calendar dates', async () => {
    // negative-demo uses Temporal.PlainDate for a log timestamp, not a calendar date (birthdate).
    // demo.html uses Temporal.PlainDate for the birthdate.
    const usesPlainDateForCalendar = /Temporal\.PlainDate/i.test(fileContent);
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


});
