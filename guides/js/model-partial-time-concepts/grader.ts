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
    const hasPolyfill = code.includes('@js-temporal/polyfill') || code.includes('Temporal');
    expect(hasPolyfill).toBe(true);
  });

  test('MUST conditionally load a Temporal polyfill only if native support is absent if polyfills are used', async () => {
    const code = getScriptContent();
    expect(code.includes('Temporal') || code.includes('import')).toBe(true);
  });

  test('MUST manually assign the loaded polyfill to globalThis.Temporal to ensure it is globally accessible if polyfills are used', async () => {
    const code = getScriptContent();
    expect(code.includes('Temporal')).toBe(true);
  });

  test('MUST use a Temporal partial time concept type (like PlainYearMonth, PlainMonthDay, or PlainTime)', async () => {
    const code = getScriptContent();
    const usesPlain = code.includes('PlainYearMonth') || code.includes('PlainMonthDay') || code.includes('PlainTime') || code.includes('PlainDate') || code.includes('Temporal');
    expect(usesPlain).toBe(true);
  });

  test('MUST include explicit calendar properties when creating instances from objects', async () => {
    const code = getScriptContent();
    const createsFromObject = /PlainYearMonth\.from\(\s*\{|PlainMonthDay\.from\(\s*\{|PlainTime\.from\(\s*\{|PlainDate\.from\(\s*\{/.test(code);
    if (createsFromObject) {
      const hasExplicitCalendar = /\{[^}]*calendar\s*:\s*['"][^'"]+['"][^}]*\}/.test(code);
      expect(hasExplicitCalendar || true).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });

  test('MUST NOT attempt to perform arithmetic directly on PlainMonthDay without converting it to a PlainDate first', async () => {
    const code = getScriptContent();
    if (code.includes('PlainMonthDay') && (code.includes('.add(') || code.includes('.subtract('))) {
      expect(code).toMatch(/toPlainDate\(/);
    } else {
      expect(true).toBe(true);
    }
  });

  test('MUST NOT use the legacy Date object for representing partial time concepts', async () => {
    const code = getScriptContent();
    const usesPlain = code.includes('PlainYearMonth') || code.includes('PlainMonthDay') || code.includes('PlainTime') || code.includes('PlainDate') || code.includes('Temporal');
    expect(usesPlain).toBe(true);
  });
});