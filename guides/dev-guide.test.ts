import test from 'node:test';
import assert from 'node:assert';
import { printTestComparison } from './dev-guide.ts';
import { parsePassRates } from './guide-gen.ts';

// CRITICAL: This test ensures that if the output format of dev-guide.ts changes,
// we will be alerted, because feedback-handler.ts and guide-gen.ts depend on
// parsing this specific format!
test('printTestComparison outputs expected format and parsePassRates parses it', () => {
  const results = {
    pre: { passed: 0, total: 4 },
    unguided: { passed: 1, total: 4 },
    guided: { passed: 3, total: 4 }
  };

  // Capture console.log
  const originalLog = console.log;
  let output = '';
  console.log = (...args) => {
    output += args.join(' ') + '\n';
  };

  try {
    printTestComparison(results);
  } finally {
    console.log = originalLog;
  }

  // Assert output format
  assert.ok(output.includes('Agent test results:'));
  assert.ok(output.includes('Unguided:          1/4 checks passed (25%)'));
  assert.ok(output.includes('Guided:            3/4 checks passed (75%)'));

  // Assert parsing
  const passRates = parsePassRates(output);
  assert.deepStrictEqual(passRates, { unguided: '25', guided: '75' });
});
