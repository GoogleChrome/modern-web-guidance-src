import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toDevsiteMarkdown } from './devsite-markdown.ts';

describe('toDevsiteMarkdown', () => {
  it('converts a single-paragraph GitHub alert to a DevSite notice paragraph', () => {
    const input = `Intro.\n\n> [!NOTE]\n> Line one\n> line two.\n\nOutro.\n`;
    assert.strictEqual(toDevsiteMarkdown(input), `Intro.\n\nNote: Line one\nline two.\n\nOutro.\n`);
  });

  it('maps IMPORTANT to the special aside class for multi-block alerts', () => {
    const input = `> [!IMPORTANT]\n> First para.\n>\n> - item a\n> - item b\n`;
    assert.strictEqual(
      toDevsiteMarkdown(input),
      `<aside class="special"><b>Important:</b>\n\nFirst para.\n\n- item a\n- item b\n\n</aside>\n`,
    );
  });

  it('leaves plain blockquotes alone', () => {
    const input = `> Just a quote.\n`;
    assert.strictEqual(toDevsiteMarkdown(input), input);
  });

  it('throws on unknown alert types', () => {
    assert.throws(() => toDevsiteMarkdown(`> [!BOGUS]\n> text\n`), /Unsupported GitHub alert/);
  });

  it('folds blocks that interrupt an ordered list into the previous item', () => {
    const input = [
      '1. **First**',
      '',
      'Explain first.',
      '',
      '```js',
      'one();',
      '```',
      '',
      '2. **Second**',
      '',
      '```js',
      'two();',
      '```',
      '',
      '3. **Third**',
      '',
    ].join('\n');
    const merges: number[] = [];
    const output = toDevsiteMarkdown(input, n => merges.push(n));
    assert.deepStrictEqual(merges, [2, 3]);
    assert.strictEqual(output, [
      '1. **First**',
      '',
      '    Explain first.',
      '',
      '    ```js',
      '    one();',
      '    ```',
      '',
      '2. **Second**',
      '',
      '    ```js',
      '    two();',
      '    ```',
      '',
      '3. **Third**',
      '',
    ].join('\n'));
  });

  it('does not merge lists separated by a heading', () => {
    const input = `1. a\n2. b\n\n## Next\n\nText.\n\n3. c\n`;
    const merges: number[] = [];
    assert.strictEqual(toDevsiteMarkdown(input, n => merges.push(n)), input);
    assert.deepStrictEqual(merges, []);
  });

  it('leaves already-indented lists untouched', () => {
    const input = `1. a\n\n    \`\`\`js\n    x();\n    \`\`\`\n\n2. b\n`;
    const merges: number[] = [];
    assert.strictEqual(toDevsiteMarkdown(input, n => merges.push(n)), input);
    assert.deepStrictEqual(merges, []);
  });
});
