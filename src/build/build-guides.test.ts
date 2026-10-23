import { describe, it } from 'node:test';
import assert from 'node:assert';
import { chunkMarkdown } from './build-guides.ts';

describe('chunkMarkdown', () => {
  it('chunks simple markdown by headings', () => {
    const input = `# Heading 1
Some text here.

## Heading 2
More text.`;
    
    const chunks = chunkMarkdown(input);
    assert.strictEqual(chunks.length, 2);
    assert.ok(chunks[0].includes('Heading 1'));
    assert.ok(chunks[0].includes('Some text here.'));
    assert.ok(chunks[1].includes('Heading 2'));
    assert.ok(chunks[1].includes('More text.'));
  });

  it('keeps paragraphs that appear before any heading', () => {
    const input = `Intro text.

# First heading
Text under first heading.`;
    
    const chunks = chunkMarkdown(input);
    assert.strictEqual(chunks.length, 2);
    assert.ok(chunks[0].includes('Intro text.'));
    assert.ok(chunks[1].includes('First heading'));
  });

  it('merges consecutive headings without intervening body content into a single chunk', () => {
    const input = `# Heading 1
## Heading 2
### Heading 3
Body paragraph under Heading 3.

## Heading 4
Body paragraph under Heading 4.`;
    
    const chunks = chunkMarkdown(input);
    assert.strictEqual(chunks.length, 2);
    assert.ok(chunks[0].includes('# Heading 1'));
    assert.ok(chunks[0].includes('## Heading 2'));
    assert.ok(chunks[0].includes('### Heading 3'));
    assert.ok(chunks[0].includes('Body paragraph under Heading 3.'));
    assert.ok(chunks[1].includes('## Heading 4'));
    assert.ok(chunks[1].includes('Body paragraph under Heading 4.'));
  });

  it('returns empty array for empty string', () => {
    const chunks = chunkMarkdown('');
    assert.strictEqual(chunks.length, 0);
  });
});
