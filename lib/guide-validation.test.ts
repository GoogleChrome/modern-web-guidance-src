import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseExpectations } from './guide-validation.ts';

describe('parseExpectations', () => {
  test('legacy flat format: all bullets treated as mustPass', () => {
    const content = `- The API is called correctly.
- Error handling is present.
- No deprecated APIs used.
`;
    const result = parseExpectations(content);
    assert.deepStrictEqual(result.mustPass, [
      'The API is called correctly.',
      'Error handling is present.',
      'No deprecated APIs used.',
    ]);
    assert.deepStrictEqual(result.mustFail, []);
    assert.deepStrictEqual(result.appAgnostic, []);
  });

  test('structured format: parses Must pass and Must fail sections', () => {
    const content = `## Must pass
- fetchLater() is called with a URL.
- activateAfter option is set.

## Must fail
- Uses sendBeacon() instead.
- Sends events without batching.
`;
    const result = parseExpectations(content);
    assert.deepStrictEqual(result.mustPass, [
      'fetchLater() is called with a URL.',
      'activateAfter option is set.',
    ]);
    assert.deepStrictEqual(result.mustFail, [
      'Uses sendBeacon() instead.',
      'Sends events without batching.',
    ]);
    assert.deepStrictEqual(result.appAgnostic, []);
  });

  test('structured format: parses all three sections', () => {
    const content = `## Must pass
- API is used.

## Must fail
- Legacy API used.

## App-agnostic rules
- Do not assert filenames.
`;
    const result = parseExpectations(content);
    assert.deepStrictEqual(result.mustPass, ['API is used.']);
    assert.deepStrictEqual(result.mustFail, ['Legacy API used.']);
    assert.deepStrictEqual(result.appAgnostic, ['Do not assert filenames.']);
  });

  test('empty content returns empty arrays', () => {
    const result = parseExpectations('');
    assert.deepStrictEqual(result.mustPass, []);
    assert.deepStrictEqual(result.mustFail, []);
    assert.deepStrictEqual(result.appAgnostic, []);
  });
});
