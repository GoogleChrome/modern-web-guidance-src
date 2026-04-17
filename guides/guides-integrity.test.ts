import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import matter from 'gray-matter';
import { marked } from 'marked';

// Import shared utilities
import { scanAllGuides, processGuideInventory } from '../lib/guide-validation.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

describe('Guides Validation (Single Source of Truth)', () => {
  const guides = scanAllGuides();

  if (guides.length === 0) {
    test('No guides found', () => {
      assert.fail('No guides found in the workspace');
    });
    return;
  }

  for (const guide of guides) {
    const relativeDir = path.relative(REPO_ROOT, guide.dir);

    it(`validates ${relativeDir}`, () => {
      const result = processGuideInventory([guide]);
      
      if (result.hasError) {
        assert.fail(`Validation errors found in ${relativeDir}:\n${result.errors.join('\n')}`);
      }
    });

    it(`validates markdown soundness for ${relativeDir}`, () => {
      const guidePath = path.join(guide.dir, 'guide.md');
      if (!fs.existsSync(guidePath)) return;

      const content = fs.readFileSync(guidePath, 'utf8');

      // 1. Check frontmatter with gray-matter
      try {
        const { data } = matter(content);
        assert.ok(data, 'Frontmatter should be parsable');
      } catch (e) {
        assert.fail(`Frontmatter parsing failed: ${e}`);
      }

      // 2. Check for unclosed code blocks (fence count)
      const lines = content.split('\n');
      const fenceLines = lines.filter(line => line.trim().startsWith('```'));
      if (fenceLines.length % 2 !== 0) {
        assert.fail(`Odd number of code block fences (\`\`\`) in ${relativeDir}. Likely an unclosed code block.`);
      }

      // 3. Check with marked
      try {
        const tokens = marked.lexer(content);
        assert.ok(tokens.length > 0, 'Marked should produce tokens');
      } catch (e) {
        assert.fail(`Marked parsing failed: ${e}`);
      }
    });
  }
});
