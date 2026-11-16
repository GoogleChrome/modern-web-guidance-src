import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { marked } from 'marked';
import {
  extractSectionFromTokens,
  indexHeadingsFromTokens,
  stripExplicitHeadingId,
  stripHeadingIdsFromMarkdown,
} from './headings.ts';

describe('headings section helpers', () => {
  it('strips explicit heading IDs in both {#id} and {: #id } forms without altering newlines or setext underlines', () => {
    assert.equal(stripExplicitHeadingId('### Title {#my-id}\n\n'), '### Title\n\n');
    assert.equal(stripExplicitHeadingId('### Title {: #my-id }\n'), '### Title\n');
    assert.equal(stripExplicitHeadingId('Setext {#id}\n---\n\n'), 'Setext\n---\n\n');
  });

  it('strips heading IDs from markdown headings while leaving code fences untouched', () => {
    const input = [
      '# Guide Title {#title}',
      '',
      '### Section One {#sec-one}',
      '',
      '```md',
      '### Literal Example {#keep-me}',
      '```',
      '',
      '### Section Two {: #sec-two }',
      '',
    ].join('\n');

    const output = stripHeadingIdsFromMarkdown(input);
    assert.ok(output.includes('# Guide Title\n'));
    assert.ok(output.includes('### Section One\n'));
    assert.ok(output.includes('### Section Two\n'));
    assert.ok(output.includes('### Literal Example {#keep-me}'));
    assert.ok(!output.includes('{#sec-one}'));
    assert.ok(!output.includes('{: #sec-two }'));
  });

  it('indexes headings and slices depth-bounded sections with stripped heading when requested', () => {
    const md = [
      '# JS',
      '',
      'Top intro prose.',
      '',
      '## Parent Category',
      '',
      'Parent intro prose.',
      '',
      '### Target Subsection {#target-id}',
      '',
      'Target body.',
      '',
      '#### Nested Detail',
      '',
      'Detail body.',
      '',
      '### Next Subsection {#next-id}',
      '',
      'Should not appear.',
    ].join('\n');

    const tokens = marked.lexer(md);
    const { headingMap, headingTokens } = indexHeadingsFromTokens(tokens);
    const canonical = headingMap.get('target-id');
    assert.equal(canonical, 'target-id');
    const heading = canonical ? headingTokens.get(canonical) : undefined;
    assert.ok(heading);

    const sliced = extractSectionFromTokens(tokens, heading, {
      includeHeading: true,
      stripHeadingIds: true,
    });
    assert.equal(
      sliced,
      ['### Target Subsection', '', 'Target body.', '', '#### Nested Detail', '', 'Detail body.'].join(
        '\n',
      ),
    );
  });
});
