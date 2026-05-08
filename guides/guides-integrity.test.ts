import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import matter from 'gray-matter';
import { marked } from 'marked';

// Import shared utilities
import { scanAllGuides, processGuideInventory } from '../lib/guide-validation.ts';
import { MACRO_PATTERN, replaceMacros } from '../serving/lib/macros.ts';

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
      // Note: We use a simple fence count check because standard parsers like marked
      // silently consume unclosed blocks to the end of the file. Since many guides
      // legitimately end with a code block, checking if the last token is a code block
      // yields too many false positives. Linters are also too noisy with style rules.
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

      // 4. Check for git conflict markers
      const conflictMarkers = ['<<<<<<<', '=======', '>>>>>>>'];
      for (const marker of conflictMarkers) {
        if (content.includes(marker)) {
          assert.fail(`File contains git conflict marker "${marker}" in ${relativeDir}`);
        }
      }
    });

    // Transclusion macros silently return "" for missing files/sections, which
    // validateMacros (error-throw based) does not catch. Guard against
    // accidentally referencing a path/section that doesn't exist.
    //
    // Excluded macros:
    // - FEATURE_ISSUES: "" is its documented return when #issues is empty/missing,
    //   so an empty result is not a bug.
    // - BASELINE_STATUS: not a transclusion macro; it either returns content or
    //   throws (already caught by validateMacros), so a non-empty check is redundant.
    it(`validates transclusion macros for ${relativeDir}`, () => {
      const guidePath = path.join(guide.dir, 'guide.md');
      if (!fs.existsSync(guidePath)) return;

      const { content: body } = matter(fs.readFileSync(guidePath, 'utf8'));
      const REQUIRED = new Set(['INCLUDE', 'FEATURE', 'FEATURE_FALLBACKS']);

      for (const match of body.matchAll(MACRO_PATTERN)) {
        const [full, name] = match;
        if (!REQUIRED.has(name)) continue;
        const result = replaceMacros(full, guidePath);
        if (!result.trim()) {
          assert.fail(`${full} in ${relativeDir} returned empty content (file or section not found).`);
        }
      }
    });
  }
});
