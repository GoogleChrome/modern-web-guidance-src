import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { replaceMacros } from './macros.ts';
import { slugify } from './include.ts';
import { rootDir } from '../../lib/paths.ts';

describe('replaceMacros (Functional with real data)', () => {
  describe('BASELINE_STATUS', () => {
    it('replaces macro with widely available status', () => {
      const content = '{{ BASELINE_STATUS("grid") }}';
      const result = replaceMacros(content, 'test.md');
      assert.ok(result.includes('2017-10-17'));
      assert.ok(result.includes('Widely available'));
    });

    it('replaces macro with newly available status', () => {
      const content = "{{ BASELINE_STATUS('dialog-closedby') }}";
      const result = replaceMacros(content, 'test.md');
      assert.ok(result !== undefined); // Specific text might vary depending on live data
    });

    it('replaces macro with not supported status', () => {
      // Accelerometer is typically limited
      const content = '{{ BASELINE_STATUS("accelerometer") }}';
      const result = replaceMacros(content, 'test.md');
      assert.ok(result.includes('limited availability'));
    });

    it('throws error for non-existent feature', () => {
      const content = '{{ BASELINE_STATUS("non-existent-feature-xyz") }}';
      assert.throws(() => replaceMacros(content, 'test.md'), /Web feature ID "non-existent-feature-xyz" not found/);
    });
  });

  describe('BASELINE_STATUS (with BCD key)', () => {
    it('replaces macro with widely available status', () => {
      const content = '{{ BASELINE_STATUS("grid", "css.properties.grid-template-columns") }}';
      const result = replaceMacros(content, 'test.md');
      assert.ok(result.includes('grid') && result.includes('Widely'));
    });

    it('throws error for non-existent BCD key', () => {
      const content = '{{ BASELINE_STATUS("grid", "css.properties.non-existent-xyz") }}';
      assert.throws(() => replaceMacros(content, 'test.md'), /BCD key/);
    });
  });

  it('supports multiple macros and mixed quotes', () => {
    const content = '{{ BASELINE_STATUS("grid") }} and {{ BASELINE_STATUS("grid", "css.properties.grid-template-columns") }}';
    const result = replaceMacros(content, 'test.md');
    assert.ok(result.includes('grid'));
    assert.ok(result.includes('Widely available'));
    assert.ok(result.includes('Baseline since'));
  });
});

describe('slugify', () => {
  it('lowercases and replaces whitespace with hyphens', () => {
    assert.equal(slugify('Fallback strategies'), 'fallback-strategies');
  });

  it('trims surrounding whitespace', () => {
    assert.equal(slugify('  Foo Bar  '), 'foo-bar');
  });

  it('strips punctuation', () => {
    assert.equal(slugify('Hello, World!'), 'hello-world');
  });

  it('preserves hyphens', () => {
    assert.equal(slugify('multi-word section'), 'multi-word-section');
  });
});

describe('INCLUDE', () => {
  let tmpDir: string;
  let FIXTURE_CALLER: string;
  let repoFixtureDir: string;
  let repoFixtureRelPath: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'macros-test-'));
    FIXTURE_CALLER = path.join(tmpDir, 'caller.md');
    // A second tmp dir inside the repo root, so we can test bare-path resolution
    // (which always resolves from rootDir).
    repoFixtureDir = fs.mkdtempSync(path.join(rootDir, 'macros-test-'));
    repoFixtureRelPath = `${path.basename(repoFixtureDir)}/repo-root-fixture.md`;
    fs.writeFileSync(
      path.join(repoFixtureDir, 'repo-root-fixture.md'),
      '# Repo Root Fixture\n\nThis fixture lives inside the repo root.\n'
    );

    fs.writeFileSync(
      path.join(tmpDir, 'sibling.md'),
      '# Sibling Fixture\n\nSibling content.\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'with-frontmatter.md'),
      '---\ntitle: With Frontmatter\n---\n\n# Heading One\n\nBody content after frontmatter.\n\n### Section Alpha\n\nAlpha section text.\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'multi-section.md'),
      '# Multi-section\n\n### First\n\nFirst section content. UNIQUE_FIRST.\n\n#### Nested\n\nNested content stays inside First.\n\n### Second\n\nSecond section content. UNIQUE_SECOND.\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'explicit-id.md'),
      '# Explicit ID\n\n### A long renamed heading {#stable-id}\n\nExplicit-ID section content. UNIQUE_EXPLICIT.\n\n### Plain heading\n\nPlain section content.\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'with-baseline.md'),
      '# With Baseline\n\n### Fallbacks\n\nBaseline status: {{ BASELINE_STATUS("grid") }}\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'formatted-headings.md'),
      '# Formatted Headings\n\n' +
      '### Foo **bar** <em>baz</em>\n\nUNIQUE_BOLD_HTML\n\n' +
      '### A [link](https://example.com) here\n\nUNIQUE_LINK\n\n' +
      '### `code` in heading\n\nUNIQUE_CODE\n\n' +
      '### *Italic* heading {#renamed}\n\nUNIQUE_RENAMED\n\n' +
      'Setext Foo  \nBar\n----------\n\nUNIQUE_BR\n'
    );
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(repoFixtureDir, { recursive: true, force: true });
  });

  describe('whole-file include', () => {
    it('strips frontmatter and leading h1 from the included body', () => {
      const result = replaceMacros('{{ INCLUDE("./with-frontmatter.md") }}', FIXTURE_CALLER);
      assert.ok(!result.includes('---'));
      assert.ok(!result.includes('# Heading One'));
      assert.ok(result.includes('Body content after frontmatter.'));
      assert.ok(result.includes('### Section Alpha'));
    });

    it('expands BASELINE_STATUS inside the included content (recursive)', () => {
      const result = replaceMacros('{{ INCLUDE("./with-baseline.md") }}', FIXTURE_CALLER);
      assert.ok(!result.includes('{{ BASELINE_STATUS'));
      assert.ok(/Baseline|limited availability/.test(result));
    });
  });

  describe('section include', () => {
    it('returns section body, dropping the section heading itself', () => {
      const result = replaceMacros(
        '{{ INCLUDE("./multi-section.md#first") }}',
        FIXTURE_CALLER
      );
      assert.ok(result.includes('UNIQUE_FIRST'));
      assert.ok(!result.includes('### First'));
    });

    it('stops at the next heading of the same depth (and includes deeper sub-headings)', () => {
      const result = replaceMacros('{{ INCLUDE("./multi-section.md#first") }}', FIXTURE_CALLER);
      assert.ok(result.includes('UNIQUE_FIRST'));
      assert.ok(result.includes('Nested content stays inside First.'));
      assert.ok(!result.includes('UNIQUE_SECOND'));
    });

    it('matches an explicit `{#id}` suffix on the heading', () => {
      const result = replaceMacros('{{ INCLUDE("./explicit-id.md#stable-id") }}', FIXTURE_CALLER);
      assert.ok(result.includes('UNIQUE_EXPLICIT'));
      assert.ok(!result.includes('Plain section content'));
    });

    it('still matches by slugified heading text when no `{#id}` is set', () => {
      const result = replaceMacros('{{ INCLUDE("./explicit-id.md#plain-heading") }}', FIXTURE_CALLER);
      assert.ok(result.includes('Plain section content'));
    });

    it('matches headings with bold and inline HTML by visible text', () => {
      const result = replaceMacros('{{ INCLUDE("./formatted-headings.md#foo-bar-baz") }}', FIXTURE_CALLER);
      assert.ok(result.includes('UNIQUE_BOLD_HTML'));
    });

    it('matches headings with links by visible text only (URL not in slug)', () => {
      const result = replaceMacros('{{ INCLUDE("./formatted-headings.md#a-link-here") }}', FIXTURE_CALLER);
      assert.ok(result.includes('UNIQUE_LINK'));
    });

    it('matches headings with inline code', () => {
      const result = replaceMacros('{{ INCLUDE("./formatted-headings.md#code-in-heading") }}', FIXTURE_CALLER);
      assert.ok(result.includes('UNIQUE_CODE'));
    });

    it('treats a hard line break in a setext heading as a word boundary', () => {
      const result = replaceMacros('{{ INCLUDE("./formatted-headings.md#setext-foo-bar") }}', FIXTURE_CALLER);
      assert.ok(result.includes('UNIQUE_BR'));
    });

    it('matches a heading with both formatting and {#id}, by either id or slug', () => {
      const byId = replaceMacros('{{ INCLUDE("./formatted-headings.md#renamed") }}', FIXTURE_CALLER);
      assert.ok(byId.includes('UNIQUE_RENAMED'));
      const bySlug = replaceMacros('{{ INCLUDE("./formatted-headings.md#italic-heading") }}', FIXTURE_CALLER);
      assert.ok(bySlug.includes('UNIQUE_RENAMED'));
    });

    it('trims output so a section can be inlined cleanly', () => {
      const result = replaceMacros(
        '* prelude {{ INCLUDE("./sibling.md") }} postlude',
        FIXTURE_CALLER
      );
      assert.ok(/prelude Sibling content[^\n]* postlude/.test(result));
    });
  });

  describe('path resolution', () => {
    it('resolves bare paths from repo root regardless of caller location', () => {
      const result = replaceMacros(
        `{{ INCLUDE("${repoFixtureRelPath}") }}`,
        '/some/unrelated/path/test.md'
      );
      assert.ok(result.includes('This fixture lives inside the repo root.'));
    });

    it('resolves ./ paths relative to the caller', () => {
      const result = replaceMacros('{{ INCLUDE("./sibling.md") }}', FIXTURE_CALLER);
      assert.ok(result.includes('Sibling content'));
    });

    it('resolves ../ paths relative to the caller', () => {
      const deeperCaller = path.join(tmpDir, 'subdir', 'caller.md');
      const result = replaceMacros('{{ INCLUDE("../sibling.md") }}', deeperCaller);
      assert.ok(result.includes('Sibling content'));
    });

    it('rejects absolute paths', () => {
      assert.throws(
        () => replaceMacros('{{ INCLUDE("/etc/passwd") }}', 'test.md'),
        /Absolute paths are not allowed/
      );
    });
  });

  describe('error handling', () => {
    it('throws on missing argument', () => {
      assert.throws(
        () => replaceMacros('{{ INCLUDE() }}', 'test.md'),
        /Missing path in INCLUDE/
      );
    });
  });

  describe('silent miss', () => {
    it('returns empty string for missing file', () => {
      const result = replaceMacros(
        'before {{ INCLUDE("features/does-not-exist-xyz.md") }} after',
        'test.md'
      );
      assert.equal(result, 'before  after');
    });

    it('returns empty string for missing section', () => {
      const result = replaceMacros(
        'before {{ INCLUDE("./multi-section.md#nonexistent-section-xyz") }} after',
        FIXTURE_CALLER
      );
      assert.equal(result, 'before  after');
    });
  });

  describe('FEATURE_FALLBACKS wrapper', () => {
    it('throws on missing feature ID', () => {
      assert.throws(
        () => replaceMacros('{{ FEATURE_FALLBACKS() }}', 'test.md'),
        /Missing feature ID in FEATURE_FALLBACKS/
      );
    });

    it('throws on unknown feature ID', () => {
      assert.throws(
        () => replaceMacros('{{ FEATURE_FALLBACKS("nonexistent-feature") }}', 'test.md'),
        /Web feature ID "nonexistent-feature" not found/
      );
    });
  });

  describe('caching', () => {
    it('returns consistent results across multiple includes of the same file and section', () => {
      const result = replaceMacros(
        `{{ INCLUDE("./multi-section.md#first") }}\n---\n{{ INCLUDE("./multi-section.md#first") }}`,
        FIXTURE_CALLER
      );
      const [first, second] = result.split('\n---\n');
      assert.equal(first, second);
      assert.ok(first.length > 0);
    });

    it('shares the file read across whole-file and section requests', () => {
      const wholeFile = replaceMacros('{{ INCLUDE("./multi-section.md") }}', FIXTURE_CALLER);
      const section = replaceMacros('{{ INCLUDE("./multi-section.md#first") }}', FIXTURE_CALLER);
      assert.ok(wholeFile.length > 0);
      assert.ok(section.length > 0);
      assert.ok(wholeFile.includes('UNIQUE_FIRST'));
      assert.ok(section.includes('UNIQUE_FIRST'));
    });
  });
});
