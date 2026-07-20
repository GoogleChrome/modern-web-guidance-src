import test from 'node:test';
import assert from 'node:assert';
import { parsePassRates } from './lib/utils.ts';

test('parsePassRates parses multi-dimensional base-app scores correctly', () => {
  const output = `
Some generation logs...
Running agent test for target: daily-grind
=== Test Suite Starting with ID: size-aware-styling-daily-grind ===
...
Grading unguided...
  unguided: 1/4 checks passed (25%)
Grading guided...
  guided: 3/4 checks passed (75%)
Agent test results:
  Base app (zero-passrate): 0/4 checks passed (0%)
  Unguided:                 1/4 checks passed (25%)
  Guided:                   3/4 checks passed (75%)
  Guide impact:             +50% (vs unguided)
  Guides consumed:          [size-aware-styling, container-queries]

Running agent test for target: devtools-times
=== Test Suite Starting with ID: size-aware-styling-devtools-times ===
...
Grading unguided...
  unguided: 2/4 checks passed (50%)
Grading guided...
  guided: 4/4 checks passed (100%)
Agent test results:
  Base app (zero-passrate): 0/4 checks passed (0%)
  Unguided:                 2/4 checks passed (50%)
  Guided:                   4/4 checks passed (100%)
  Guide impact:             +50% (vs unguided)
  Guides consumed:          [size-aware-styling]
`;

  const parsed = parsePassRates(output);
  assert.deepStrictEqual(parsed, {
    'daily-grind': {
      unguided: '25',
      guided: '75',
      guidesConsumed: ['size-aware-styling', 'container-queries']
    },
    'devtools-times': {
      unguided: '50',
      guided: '100',
      guidesConsumed: ['size-aware-styling']
    }
  });
});

test('parsePassRates parses legacy single-page outputs correctly (fallback to demo)', () => {
  const output = `
Some generation logs...
=== Test Suite Starting with ID: legacy-same-document-transitions ===
...
Grading unguided...
  unguided: 0/4 checks passed (0%)
Grading guided...
  guided: 2/4 checks passed (50%)
Agent test results:
  Base app (zero-passrate): 0/4 checks passed (0%)
  Unguided:                 0/4 checks passed (0%)
  Guided:                   2/4 checks passed (50%)
  Guide impact:             +50% (vs unguided)
  Guides consumed:          [same-document-transitions]
`;

  const parsed = parsePassRates(output);
  assert.deepStrictEqual(parsed, {
    'demo': {
      unguided: '0',
      guided: '50',
      guidesConsumed: ['same-document-transitions']
    }
  });
});
