import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseExpectations, validateHtmlTags } from './guide-validation.ts';

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

describe('validateHtmlTags', () => {
  // Tests that safe inline typographic elements are permitted
  test('allows comments, kbd, br, wbr tags', () => {
    const body = `This is a comment: <!-- comment -->
Some keyboard shortcut: <kbd>Ctrl</kbd> + <kbd>C</kbd>
Line break: <br> and <br />
Word break: <wbr>
`;
    const errors = validateHtmlTags(body, 'test.md');
    assert.deepStrictEqual(errors, []);
  });

  test('detects unescaped invalid tags', () => {
    const body = `Please use <select> or <button> here.
And an iframe: <iframe src="foo"></iframe>.
Also unescaped <label>.
`;
    const errors = validateHtmlTags(body, 'test.md');
    assert.strictEqual(errors.length, 4);
    assert.ok(errors[0].includes('Unescaped HTML tag <select> found on line 1'));
    assert.ok(errors[1].includes('Unescaped HTML tag <button> found on line 1'));
    assert.ok(errors[2].includes('Unescaped HTML tag <iframe> found on line 2'));
    assert.ok(errors[3].includes('Unescaped HTML tag <label> found on line 3'));
  });

  test('ignores code blocks', () => {
    const body = `\`\`\`html
<select>
  <option>foo</option>
</select>
\`\`\`
`;
    const errors = validateHtmlTags(body, 'test.md');
    assert.deepStrictEqual(errors, []);
  });

  test('ignores code spans', () => {
    const body = `Using \`<select>\` is recommended.
`;
    const errors = validateHtmlTags(body, 'test.md');
    assert.deepStrictEqual(errors, []);
  });
});

