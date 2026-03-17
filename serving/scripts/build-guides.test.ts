import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from './build-guides.ts';

describe('chunkMarkdown', () => {
  it('chunks simple markdown by headings', () => {
    const input = `# Heading 1
Some text here.

## Heading 2
More text.`;
    
    const chunks = chunkMarkdown(input);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain('Heading 1');
    expect(chunks[0]).toContain('Some text here.');
    expect(chunks[1]).toContain('Heading 2');
    expect(chunks[1]).toContain('More text.');
  });

  it('keeps paragraphs that appear before any heading', () => {
    const input = `Intro text.

# First heading
Text under first heading.`;
    
    const chunks = chunkMarkdown(input);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain('Intro text.');
    expect(chunks[1]).toContain('First heading');
  });

  it('handles multiple headings without content correctly', () => {
    const input = `# Heading 1
## Heading 2
### Heading 3`;
    
    // Each heading creates a new chunk based on the current implementation
    const chunks = chunkMarkdown(input);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toBe('# Heading 1\n');
    expect(chunks[1]).toBe('## Heading 2\n');
    expect(chunks[2]).toBe('### Heading 3');
  });

  it('returns empty array for empty string', () => {
    const chunks = chunkMarkdown('');
    expect(chunks).toHaveLength(0);
  });
});
