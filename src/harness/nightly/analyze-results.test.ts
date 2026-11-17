import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { EvalsReport, TrialResult } from '../lib/metrics.ts';
import { formatJobSummary } from './analyze-results.ts';

const FIXTURE_PATH = path.join(import.meta.dirname, '..', 'public', 'fixtures', 'nightly-sample.evals.json');

test('formatJobSummary formats pass, leak, and error rates', () => {
  const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as EvalsReport;
  assert.strictEqual(
    formatJobSummary(data),
    [
      'Unguided pass rate: 28% (8/29)',
      'Guided pass rate: 66% (19/29)',
      'Leak rate: 0%',
      'Error rate: 0%',
    ].join('\n'),
  );
});

test('formatJobSummary handles sub-1% leak/error rates, paired exclusion, and empty/catastrophic jobs', () => {
  const ok = (passed: boolean): TrialResult => ({ runNumber: 1, results: [{ passed, message: 'c' }] });
  const err: TrialResult = { runNumber: 1, results: [{ passed: false, message: 'err', isEarlyFailure: true }] };
  const results: Record<string, TrialResult[]> = {};
  for (let i = 0; i < 198; i++) {
    results[`daily-grind - g${i} - unguided`] = [ok(false)];
    results[`daily-grind - g${i} - guided`] = [ok(true)];
  }
  results['daily-grind - leaked - unguided'] = [{ ...ok(true), guidesUsed: ['leaked'] }];
  results['daily-grind - leaked - guided'] = [ok(true)];
  results['daily-grind - broken - unguided'] = [ok(true)];
  results['daily-grind - broken - guided'] = [err];

  assert.strictEqual(
    formatJobSummary({ results }),
    [
      'Unguided pass rate: 1% (1/199)',
      'Guided pass rate: 100% (199/199)',
      'Leak rate: 0.5%',
      'Error rate: 0.3%',
    ].join('\n'),
  );
  assert.strictEqual(formatJobSummary({ results: {} }), '');
  assert.strictEqual(formatJobSummary({ results: { 'daily-grind - g0 - guided': [err] } }), '');
});
