import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFile = process.env.TARGET_FILE;

function getScriptContent(): string {
  if (!targetFile || !fs.existsSync(targetFile)) return '';
  const resolved = path.resolve(targetFile);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved);
  const html = fs.readFileSync(resolved, 'utf8');
  if (base === 'demo.html' || base === 'negative-demo.html') {
    return html;
  }
  const extra = fs.readdirSync(dir)
    .filter((f) => /\.(m?js|cjs)$/i.test(f) && f !== 'grade.mjs' && f !== 'run.mjs' && !f.includes('.config.'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');
  return `${html}\n${extra}`;
}

test.describe('Temporal API Expectations', () => {

  test('MUST feature-detect the Temporal API using typeof Temporal === "undefined" before usage if polyfills are used', async () => {
    const code = getScriptContent();
    const hasFeatureDetect =
      /typeof\s+Temporal\s*===\s*['"]undefined['"]/.test(code) ||
      /typeof\s+(?:globalThis|window|self)\.Temporal\s*===\s*['"]undefined['"]/.test(code) ||
      /!\s*\(\s*['"]Temporal['"]\s+in\s+(?:globalThis|window|self)\s*\)/.test(code) ||
      /!(?:globalThis|window|self)\.Temporal\b/.test(code) ||
      /(?:globalThis|window|self)\.Temporal\s*(?:\?\?|\|\||\?)/.test(code);
    expect(hasFeatureDetect).toBe(true);
  });

  test('MUST conditionally load a Temporal polyfill only if native support is absent if polyfills are used', async () => {
    const code = getScriptContent();
    const hasConditionalImport =
      /if\s*\([^{]*Temporal[^{]*\)\s*\{[\s\S]*?import\s*\([^)]*temporal/i.test(code) ||
      /typeof\s+(?:(?:globalThis|window|self)\.)?Temporal\s*===\s*['"]undefined['"][\s\S]*?import\s*\([^)]*temporal/i.test(code) ||
      /(?:globalThis|window|self)\.Temporal\s*(?:\?\?|\|\|)[\s\S]*?import\s*\([^)]*temporal/i.test(code);
    expect(hasConditionalImport).toBe(true);
  });

  test('MUST manually assign the loaded polyfill to globalThis.Temporal to ensure it is globally accessible if polyfills are used', async () => {
    const code = getScriptContent();
    const assignsGlobalTemporal =
      /(?:globalThis|window|self)\.Temporal\s*(?:\?\?=|\|\|=|=(?!=))/.test(code) ||
      /(?:const|let|var)\s+(?:\{\s*Temporal\s*\}|temporal|Temporal)\s*=[\s\S]*?import\s*\([^)]*temporal/i.test(code);
    expect(assignsGlobalTemporal).toBe(true);
  });

  test('MUST use a Temporal partial time concept type (like PlainYearMonth, PlainMonthDay, or PlainTime)', async () => {
    const code = getScriptContent();
    const usesPlainYearMonth = /\bPlainYearMonth\b/.test(code);
    const usesPlainMonthDay = /\bPlainMonthDay\b/.test(code);
    const usesPlainTime = /\bPlainTime\b/.test(code);
    const usesLegacyDateWithArgs = /new\s+Date\s*\(\s*[^)\s]/.test(code);
    expect((usesPlainYearMonth || usesPlainMonthDay || usesPlainTime) && !usesLegacyDateWithArgs).toBe(true);
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
    const usesPartialTemporal = /\b(?:PlainYearMonth|PlainMonthDay|PlainTime)\b/.test(code);
    const usesPlainMonthDay = /\bPlainMonthDay\b/.test(code);
    const convertsToPlainDate = /\.toPlainDate\s*\(/.test(code);
    expect(usesPartialTemporal && (!usesPlainMonthDay || convertsToPlainDate)).toBe(true);
  });

  test('MUST NOT use the legacy Date object for representing partial time concepts', async () => {
    const code = getScriptContent();
    const usesPartialType =
      /\bPlainYearMonth\b/.test(code) ||
      /\bPlainMonthDay\b/.test(code) ||
      /\bPlainTime\b/.test(code);
    const usesLegacyDateWithArgs = /new\s+Date\s*\(\s*[^)\s]/.test(code);
    expect(usesPartialType && !usesLegacyDateWithArgs).toBe(true);
  });
});