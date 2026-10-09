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

  it('handles multiple headings without content correctly', () => {
    const input = `# Heading 1
## Heading 2
### Heading 3`;
    
    // Each heading creates a new chunk based on the current implementation
    const chunks = chunkMarkdown(input);
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0], '# Heading 1\n');
    assert.strictEqual(chunks[1], '## Heading 2\n');
    assert.strictEqual(chunks[2], '### Heading 3');
  });

  it('returns empty array for empty string', () => {
    const chunks = chunkMarkdown('');
    assert.strictEqual(chunks.length, 0);
  });
});
