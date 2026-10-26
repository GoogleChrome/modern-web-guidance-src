import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDevsiteMarkdown,
  moonriseHeadingId,
  githubSlug,
  buildHeadingMap,
  escapeJinjaDelimiters,
} from './devsite-markdown.ts';

describe('toDevsiteMarkdown', () => {
  it('converts a single-paragraph GitHub alert to a DevSite notice paragraph', () => {
    const input = `Intro.\n\n> [!NOTE]\n> Line one\n> line two.\n\nOutro.\n`;
    const res = toDevsiteMarkdown(input);
    assert.strictEqual(res.markdown, `Intro.\n\nNote: Line one\nline two.\n\nOutro.\n`);
  });

  it('maps IMPORTANT to the special aside class for multi-block alerts', () => {
    const input = `> [!IMPORTANT]\n> First para.\n>\n> - item a\n> - item b\n`;
    const res = toDevsiteMarkdown(input);
    assert.strictEqual(
      res.markdown,
      `<aside class="special"><b>Important:</b>\n\nFirst para.\n\n- item a\n- item b\n\n</aside>\n`,
    );
  });

  it('leaves plain blockquotes alone', () => {
    const input = `> Just a quote.\n`;
    const res = toDevsiteMarkdown(input);
    assert.strictEqual(res.markdown, input);
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
    const res = toDevsiteMarkdown(input, n => merges.push(n));
    assert.deepStrictEqual(merges, [2, 3]);
    assert.strictEqual(res.markdown, [
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
    const res = toDevsiteMarkdown(input, n => merges.push(n));
    assert.strictEqual(res.markdown, input);
    assert.deepStrictEqual(merges, []);
  });

  it('leaves already-indented lists untouched', () => {
    const input = `1. a\n\n    \`\`\`js\n    x();\n    \`\`\`\n\n2. b\n`;
    const merges: number[] = [];
    const res = toDevsiteMarkdown(input, n => merges.push(n));
    assert.strictEqual(res.markdown, input);
    assert.deepStrictEqual(merges, []);
  });
});

describe('moonriseHeadingId', () => {
  it('collapses ampersand and surrounding spaces into a single underscore', () => {
    assert.strictEqual(moonriseHeadingId('10. Transitions & animations'), '10_transitions_animations');
  });

  it('handles code tags in headings without leaking angle brackets or tag names', () => {
    assert.strictEqual(moonriseHeadingId('`code` in heading'), 'code_in_heading');
    assert.strictEqual(moonriseHeadingId('Using `@property` rules'), 'using_property_rules');
  });

  it('percent-encodes non-ASCII characters to uppercase hex', () => {
    assert.strictEqual(moonriseHeadingId('Heading with — em-dash'), 'heading_with_%E2%80%94_em_dash');
  });

  it('trims leading and trailing underscores and punctuation', () => {
    assert.strictEqual(moonriseHeadingId('### Overview: '), 'overview');
  });
});

describe('explicit heading IDs and anchor resolution (T2 & T3)', () => {
  it('normalizes explicit heading IDs to Moonrise syntax {: #id } and resolves links to them', () => {
    const input = [
      '# Title',
      '',
      'See [the guidance below](#detecting-at-rules-without-supports-at-rule).',
      '',
      '## Detecting support for at-rules when `@supports at-rule()` isn’t appropriate { #detecting-at-rules-without-supports-at-rule }',
      '',
      'Guidance text.',
    ].join('\n');

    const res = toDevsiteMarkdown(input);
    assert.ok(res.markdown.includes('## Detecting support for at-rules when `@supports at-rule()` isn’t appropriate {: #detecting-at-rules-without-supports-at-rule }'));
    assert.ok(res.markdown.includes('[the guidance below](#detecting-at-rules-without-supports-at-rule)'));
    assert.ok(res.headingIds.has('detecting-at-rules-without-supports-at-rule'));
  });

  it('resolves GitHub-style hyphenated anchor slugs to Moonrise underscore IDs', () => {
    const input = [
      '# Document Title',
      '',
      'Go to [transitions section](#10-transitions--animations).',
      '',
      '## 10. Transitions & animations',
      '',
      'Content.',
    ].join('\n');

    const res = toDevsiteMarkdown(input);
    assert.ok(res.markdown.includes('[transitions section](#10_transitions_animations)'));
    assert.ok(res.headingIds.has('10_transitions_animations'));
  });

  it('resolves duplicate headings with hoedown numeric suffixes', () => {
    const input = [
      '# Doc',
      '',
      '## Subhead',
      'First.',
      '',
      '## Subhead',
      'Second.',
      '',
      '## Subhead',
      'Third.',
    ].join('\n');

    const { headingIds } = buildHeadingMap(input);
    assert.ok(headingIds.has('subhead'));
    assert.ok(headingIds.has('subhead_2'));
    assert.ok(headingIds.has('subhead_3'));
  });

  it('throws when an anchor cannot be resolved on the page', () => {
    const input = [
      '# Document Title',
      '',
      'See [missing anchor](#does-not-exist).',
      '',
      '## Valid Section',
      '',
      'Content.',
    ].join('\n');

    assert.throws(
      () => toDevsiteMarkdown(input, { filePath: 'guides/test/test.md' }),
      /Unresolved anchor "#does-not-exist" in guides\/test\/test\.md/
    );
  });
});

describe('BaselineStatus formatting (T4)', () => {
  it('strips trailing period and formats spacing around BaselineStatus macro', () => {
    const input = [
      '# Guide',
      '',
      "{{ macros.BaselineStatus('fetchlater') }}. Therefore, a fallback strategy is typically required.",
    ].join('\n');

    const res = toDevsiteMarkdown(input);
    assert.strictEqual(res.hasBaselineMacro, true);
    assert.strictEqual(
      res.markdown,
      "# Guide\n\n{{ macros.BaselineStatus('fetchlater') }}\n\nTherefore, a fallback strategy is typically required."
    );
  });
});

describe('escapeJinjaDelimiters (T5)', () => {
  it('wraps raw Jinja delimiters in verbatim tags', () => {
    const input = 'Pass an object: `{{algorithm: string, value: string}}` or `{% raw %}` or `{# comment #}`';
    const escaped = escapeJinjaDelimiters(input);
    assert.ok(escaped.includes('{% verbatim %}{{algorithm: string, value: string}}{% endverbatim %}'));
    assert.ok(escaped.includes('{% verbatim %}{%{% endverbatim %}'));
    assert.ok(escaped.includes('{% verbatim %}{#{% endverbatim %}'));
  });

  it('preserves valid DevSite macros, imports, and includes without double-escaping', () => {
    const input = [
      '{% import "/_macros.html" as macros %}',
      '{% include "/docs/modern-web-guidance/_guide-promo.html" %}',
      "{{ macros.BaselineStatus('grid') }}",
      'Stray {{ delimiter }}',
    ].join('\n');

    const escaped = escapeJinjaDelimiters(input);
    assert.ok(escaped.includes('{% import "/_macros.html" as macros %}'));
    assert.ok(escaped.includes('{% include "/docs/modern-web-guidance/_guide-promo.html" %}'));
    assert.ok(escaped.includes("{{ macros.BaselineStatus('grid') }}"));
    assert.ok(escaped.includes('{% verbatim %}{{ delimiter }}{% endverbatim %}'));
  });
});

describe('closing code fence indentation normalization (T10)', () => {
  it('normalizes closing fence indentation to match opening fence', () => {
    const input = [
      '# Title',
      '',
      '```html',
      '<script type="module">',
      '</script>',
      ' ```',
      '',
      'Paragraph after code.',
    ].join('\n');

    const res = toDevsiteMarkdown(input);
    assert.strictEqual(
      res.markdown,
      [
        '# Title',
        '',
        '```html',
        '<script type="module">',
        '</script>',
        '```',
        '',
        'Paragraph after code.',
      ].join('\n')
    );
  });
});

describe('block spacing (T6)', () => {
  it('ensures blank line between paragraph and following code block or list', () => {
    const input = [
      '# Title',
      '',
      'Intro paragraph without trailing blank line:',
      '```css',
      '.rule { color: red; }',
      '```',
      'Another paragraph without trailing blank line:',
      '- item 1',
      '- item 2',
    ].join('\n');

    const res = toDevsiteMarkdown(input);
    assert.strictEqual(
      res.markdown,
      [
        '# Title',
        '',
        'Intro paragraph without trailing blank line:',
        '',
        '```css',
        '.rule { color: red; }',
        '```',
        '',
        'Another paragraph without trailing blank line:',
        '',
        '- item 1',
        '- item 2',
      ].join('\n')
    );
  });
});
