import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import matter from 'gray-matter';
import { marked } from 'marked';

// Import shared utilities
import { scanAllGuides, processGuideInventory } from '../lib/guide-validation.ts';
import { replaceMacros, MACRO_PATTERN } from '../serving/lib/macros.ts';
import { validateGraderExpectationCoverage, formatCoverageFailureMessage } from '../lib/grader-coverage.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

describe('Guides Validation (Single Source of Truth)', () => {
  const guides = scanAllGuides();

  if (guides.length === 0) {
    test('No guides found', () => {
      assert.fail('No guides found in the workspace');
    });
    return;
  }

  it('ensures all guide IDs are unique', () => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const guide of guides) {
      if (seen.has(guide.name)) {
        duplicates.add(guide.name);
      }
      seen.add(guide.name);
    }
    if (duplicates.size > 0) {
      assert.fail(`Duplicate guide IDs found: ${Array.from(duplicates).join(', ')}`);
    }
  });

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

      // 4. Check for git conflict markers at the start of a line
      const conflictMarkers = ['<<<<<<<', '=======', '>>>>>>>'];
      for (const marker of conflictMarkers) {
        if (lines.some(l => l.startsWith(marker))) {
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

    const targetsDir = path.join(guide.dir, 'targets');
    const expectationsPath = path.join(guide.dir, 'expectations.md');

    if (fs.existsSync(targetsDir) && fs.existsSync(expectationsPath)) {
      const targetApps = fs.readdirSync(targetsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => e.name);

      for (const targetApp of targetApps) {
        const targetGraderPath = path.join(targetsDir, targetApp, 'grader.ts');
        if (!fs.existsSync(targetGraderPath)) continue;

        it(`validates expectation coverage for target ${relativeDir}/targets/${targetApp}`, async () => {
          const result = await validateGraderExpectationCoverage(expectationsPath, targetGraderPath);
          if (!result.isComplete) {
            assert.fail(formatCoverageFailureMessage(result, REPO_ROOT));
          }
        });
      }
    }
  }

  it('checks all tracked files for conflict markers', () => {
    const files = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n');
    const extensions = ['.md', '.html', '.txt', '.yaml', '.yml'];
    const conflictMarkers = ['<<<<<<<', '=======', '>>>>>>>'];
    const failedFiles: string[] = [];

    for (const file of files) {
      const ext = path.extname(file);
      if (!extensions.includes(ext)) continue;

      const filePath = path.resolve(REPO_ROOT, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileLines = content.split('\n');
        for (const marker of conflictMarkers) {
          if (fileLines.some(l => l.startsWith(marker))) {
            failedFiles.push(`${file} (contains "${marker}")`);
            break;
          }
        }
      } catch (e) {
        // Ignore files that cannot be read
      }
    }

    if (failedFiles.length > 0) {
      assert.fail(`Conflict markers found in the following files:\n${failedFiles.join('\n')}`);
    }
  });

  it('validates all feature override keys in guides/atls.json', async () => {
    const { validateFeature } = await import('../serving/lib/baseline.ts');
    const atlsPath = path.join(import.meta.dirname, 'atls.json');
    const atlsConfig = JSON.parse(fs.readFileSync(atlsPath, 'utf8'));
    const featureIds = Object.keys(atlsConfig.web_features || {});

    for (const fid of featureIds) {
      const res = validateFeature(fid);
      if (!res.isValid) {
        assert.fail(`Feature ID "${fid}" in guides/atls.json is invalid: ${res.errorMessage}`);
      }
    }
  });

  it('validates that all features/tmp-*.md files are registered in features/pending-web-features.json', async () => {
    const { validateFeature } = await import('../serving/lib/baseline.ts');
    const featuresDir = path.join(REPO_ROOT, 'features');
    const files = fs.readdirSync(featuresDir);

    for (const file of files) {
      if (file.startsWith('tmp-') && file.endsWith('.md')) {
        const tmpId = file.slice(0, -3);
        const res = validateFeature(tmpId);
        if (!res.isValid) {
          assert.fail(`Feature snippet file "features/${file}" uses unregistered feature ID: ${res.errorMessage}`);
        }
      }
    }
  });
});
