import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;

function getScriptContent(): string {
  if (!targetFile || !fs.existsSync(targetFile)) return '';
  return fs.readFileSync(path.resolve(targetFile), 'utf8');
}

test.describe('Temporal API Expectations', () => {

  test('MUST feature-detect the Temporal API using typeof Temporal === "undefined" before usage if polyfills are used', async () => {
    const code = getScriptContent();
    const hasFeatureDetect =
      /typeof\s+Temporal\s*===\s*['"]undefined['"]/.test(code) ||
      /typeof\s+globalThis\.Temporal\s*===\s*['"]undefined['"]/.test(code) ||
      /!\s*\(\s*['"]Temporal['"]\s+in\s+(?:globalThis|window|self)\s*\)/.test(code) ||
      /!(?:globalThis|window|self)\.Temporal\b/.test(code);
    expect(hasFeatureDetect).toBe(true);
  });

  test('MUST conditionally load a Temporal polyfill only if native support is absent if polyfills are used', async () => {
    const code = getScriptContent();
    const hasConditionalImport =
      /if\s*\([^{]*Temporal[^{]*\)\s*\{[\s\S]*?import\s*\([^)]*temporal/i.test(code) ||
      /typeof\s+Temporal\s*===\s*['"]undefined['"][\s\S]*?import\s*\([^)]*temporal/i.test(code);
    expect(hasConditionalImport).toBe(true);
  });

  test('MUST manually assign the loaded polyfill to globalThis.Temporal to ensure it is globally accessible if polyfills are used', async () => {
    const code = getScriptContent();
    const assignsGlobalTemporal =
      /(?:globalThis|window|self)\.Temporal\s*=/.test(code);
    expect(assignsGlobalTemporal).toBe(true);
  });

  test('MUST use a Temporal partial time concept type (like PlainYearMonth, PlainMonthDay, or PlainTime)', async () => {
    const code = getScriptContent();
    const usesPlainYearMonth = /\bPlainYearMonth\b/.test(code);
    const usesPlainMonthDay = /\bPlainMonthDay\b/.test(code);
    const usesPlainTime = /\bPlainTime\b/.test(code);
    expect(usesPlainYearMonth && usesPlainMonthDay && usesPlainTime).toBe(true);
  });

  test('MUST include explicit calendar properties when creating instances from objects', async () => {
    const code = getScriptContent();
    const usesTemporal = /\bPlainYearMonth\b|\bPlainMonthDay\b|\bPlainTime\b/.test(code);
    const objectFromMatches = code.match(/Plain(?:YearMonth|MonthDay|Time|Date)\.from\(\s*\{[\s\S]*?\}\s*\)/g) || [];
    const allObjectCallsHaveCalendar = objectFromMatches.every((call) =>
      /calendar\s*:\s*['"]iso8601['"]/i.test(call)
    );
    const hasFromCall = /Plain(?:YearMonth|MonthDay|Time)\.from\(/.test(code);
    expect(usesTemporal && hasFromCall && allObjectCallsHaveCalendar).toBe(true);
  });

  test('MUST NOT attempt to perform arithmetic directly on PlainMonthDay without converting it to a PlainDate first', async () => {
    const code = getScriptContent();
    const usesPlainMonthDay = /\bPlainMonthDay\b/.test(code);
    const convertsToPlainDate = /\.toPlainDate\s*\(/.test(code);
    expect(usesPlainMonthDay && convertsToPlainDate).toBe(true);
  });

  test('MUST NOT use the legacy Date object for representing partial time concepts', async () => {
    const code = getScriptContent();
    const usesAllPartialTypes =
      /\bPlainYearMonth\b/.test(code) &&
      /\bPlainMonthDay\b/.test(code) &&
      /\bPlainTime\b/.test(code);
    const usesLegacyDateWithArgs = /new\s+Date\s*\(\s*[^)\s]/.test(code);
    expect(usesAllPartialTypes && !usesLegacyDateWithArgs).toBe(true);
  });
});