import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseExpectations, validateHtmlTags, validateHeadings, validateGuideTitle, validateBaselineClaims, validateGuide, inventoryGuide, classifyGuide, getSupportedBaseApps, extractH1Heading, extractAllH1Headings } from './guide-validation.ts';
import { extractFeatureIds } from './feature-parser.ts';

describe('extractH1Heading and extractAllH1Headings', () => {
  test('extracts standard ATX H1 heading', () => {
    const markdown = '# My Title\n\nSome introductory paragraph.';
    assert.strictEqual(extractH1Heading(markdown), 'My Title');
    assert.deepStrictEqual(extractAllH1Headings(markdown), ['My Title']);
  });

  test('extracts H1 heading after HTML comments or frontmatter', () => {
    const markdownWithComments = `<!-- Author: Someone -->\n<!-- Status: Draft -->\n\n# Document Title\n\nContent here.`;
    assert.strictEqual(extractH1Heading(markdownWithComments), 'Document Title');
    assert.deepStrictEqual(extractAllH1Headings(markdownWithComments), ['Document Title']);

    const markdownWithFrontmatter = `---\nname: test-guide\ndescription: A test guide\n---\n\n# Frontmatter Title\n\nBody content.`;
    assert.strictEqual(extractH1Heading(markdownWithFrontmatter), 'Frontmatter Title');
    assert.deepStrictEqual(extractAllH1Headings(markdownWithFrontmatter), ['Frontmatter Title']);
  });

  test('ignores H1 headings inside code blocks', () => {
    const markdown = `\`\`\`markdown\n# Inside Code Block\n# Another Inside Code Block\n\`\`\`\n\n\`\`\`js\n// # Not a heading\n\`\`\``;
    assert.strictEqual(extractH1Heading(markdown), undefined);
    assert.deepStrictEqual(extractAllH1Headings(markdown), []);

    const markdownWithRealH1AndCodeBlock = `\`\`\`markdown\n# Code Block Title\n\`\`\`\n\n# Real Heading\n\n\`\`\`\n# Another Fake Heading\n\`\`\``;
    assert.strictEqual(extractH1Heading(markdownWithRealH1AndCodeBlock), 'Real Heading');
    assert.deepStrictEqual(extractAllH1Headings(markdownWithRealH1AndCodeBlock), ['Real Heading']);
  });

  test('preserves inline backticks and formatting in title', () => {
    const markdown = '# Guide for `<dialog>` and `popover`\n\nContent.';
    assert.strictEqual(extractH1Heading(markdown), 'Guide for `<dialog>` and `popover`');
    assert.deepStrictEqual(extractAllH1Headings(markdown), ['Guide for `<dialog>` and `popover`']);
  });

  test('returns undefined / empty array when only lower level headings exist', () => {
    const markdown = `## Subhead\n\n### Sub Subhead\n\n#### Minor Heading`;
    assert.strictEqual(extractH1Heading(markdown), undefined);
    assert.deepStrictEqual(extractAllH1Headings(markdown), []);
  });

  test('handles multiple H1 headings across document', () => {
    const markdown = `# First Heading\n\nSome text.\n\n# Second Heading\n\nMore text.\n\n# Third Heading`;
    assert.strictEqual(extractH1Heading(markdown), 'First Heading');
    assert.deepStrictEqual(extractAllH1Headings(markdown), ['First Heading', 'Second Heading', 'Third Heading']);
  });

  test('returns undefined / empty array for empty or whitespace markdown', () => {
    assert.strictEqual(extractH1Heading(''), undefined);
    assert.deepStrictEqual(extractAllH1Headings(''), []);

    assert.strictEqual(extractH1Heading('   \n\n  \t  \n'), undefined);
    assert.deepStrictEqual(extractAllH1Headings('   \n\n  \t  \n'), []);
  });
});

describe('parseExpectations', () => {
  test('legacy flat format: all bullets treated as mustPass', () => {
    const content = `- The API is called correctly.
- Error handling is present.
- No deprecated APIs used.
`;
    const result = parseExpectations(content);
    assert.deepStrictEqual(result.mustPass, [
      'The API is called correctly.',
      'Error handling is present.',
      'No deprecated APIs used.',
    ]);
    assert.deepStrictEqual(result.mustFail, []);
    assert.deepStrictEqual(result.appAgnostic, []);
  });

  test('structured format: parses Must pass and Must fail sections', () => {
    const content = `## Must pass
- fetchLater() is called with a URL.
- activateAfter option is set.

## Must fail
- Uses sendBeacon() instead.
- Sends events without batching.
`;
    const result = parseExpectations(content);
    assert.deepStrictEqual(result.mustPass, [
      'fetchLater() is called with a URL.',
      'activateAfter option is set.',
    ]);
    assert.deepStrictEqual(result.mustFail, [
      'Uses sendBeacon() instead.',
      'Sends events without batching.',
    ]);
    assert.deepStrictEqual(result.appAgnostic, []);
  });

  test('structured format: parses all three sections', () => {
    const content = `## Must pass
- API is used.

## Must fail
- Legacy API used.

## App-agnostic rules
- Do not assert filenames.
`;
    const result = parseExpectations(content);
    assert.deepStrictEqual(result.mustPass, ['API is used.']);
    assert.deepStrictEqual(result.mustFail, ['Legacy API used.']);
    assert.deepStrictEqual(result.appAgnostic, ['Do not assert filenames.']);
  });

  test('empty content returns empty arrays', () => {
    const result = parseExpectations('');
    assert.deepStrictEqual(result.mustPass, []);
    assert.deepStrictEqual(result.mustFail, []);
    assert.deepStrictEqual(result.appAgnostic, []);
  });
});

describe('validateHtmlTags', () => {
  // Tests that safe inline typographic elements are permitted
  test('allows comments, kbd, br, wbr tags', () => {
    const body = `This is a comment: <!-- comment -->
Some keyboard shortcut: <kbd>Ctrl</kbd> + <kbd>C</kbd>
Line break: <br> and <br />
Word break: <wbr>
`;
    const errors = validateHtmlTags(body, 'test.md');
    assert.deepStrictEqual(errors, []);
  });

  test('detects unescaped invalid tags', () => {
    const body = `Please use <select> or <button> here.
And an iframe: <iframe src="foo"></iframe>.
Also unescaped <label>.
`;
    const errors = validateHtmlTags(body, 'test.md');
    assert.strictEqual(errors.length, 5);
    assert.ok(errors[0].includes('Unescaped HTML tag <select> found on line 1'));
    assert.ok(errors[1].includes('Unescaped HTML tag <button> found on line 1'));
    assert.ok(errors[2].includes('Unescaped HTML tag <iframe> found on line 2'));
    assert.ok(errors[3].includes('Unescaped HTML tag <iframe> found on line 2'));
    assert.ok(errors[4].includes('Unescaped HTML tag <label> found on line 3'));
  });

  test('ignores code blocks', () => {
    const body = `\`\`\`html
<select>
  <option>foo</option>
</select>
\`\`\`
`;
    const errors = validateHtmlTags(body, 'test.md');
    assert.deepStrictEqual(errors, []);
  });

  test('ignores code spans', () => {
    const body = `Using \`<select>\` is recommended.
`;
    const errors = validateHtmlTags(body, 'test.md');
    assert.deepStrictEqual(errors, []);
  });

  test('reports true line numbers for duplicate unescaped tags across document', () => {
    const body = `Line 1: unescaped <dialog>.
Line 2: normal text.
Line 3: normal text.
Line 4: duplicate unescaped <dialog>.
`;
    const errors = validateHtmlTags(body, 'test.md');
    assert.strictEqual(errors.length, 2);
    assert.ok(errors[0].includes('Unescaped HTML tag <dialog> found on line 1'));
    assert.ok(errors[1].includes('Unescaped HTML tag <dialog> found on line 4'));
  });
});

describe('validateHeadings and validateGuideTitle', () => {
  test('disallows vague H1 headings like Overview, Introduction, Guide, Title', () => {
    const vagueHeadings = ['# Overview', '# Introduction', '# Guide', '# Title', '# overview', '# OVERVIEW', '#  Introduction '];
    for (const heading of vagueHeadings) {
      const body = `${heading}\n\nSome body text.`;
      const errors = validateHeadings(body, 'test.md');
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].includes('Vague H1 heading'));
    }
  });

  test('allows depth > 1 headings like ## Overview or ### Introduction without errors', () => {
    const body = `# Valid Feature Heading

## Overview
Some overview content.

### Introduction
Some introduction details.

#### Guide
Some guide steps.
`;
    const errors = validateHeadings(body, 'test.md');
    assert.deepStrictEqual(errors, []);
  });

  test('disallows H1 headings ending with redundant "Guide"', () => {
    const guideHeadings = [
      '# Passkey Registration Guide',
      '# Web Components Orientation Guide',
      '# passkey guide',
      '# PASSKEY AUTHENTICATION GUIDE',
      '# Custom Elements Guide ',
      '# Passkey Reauthentication Guide  ',
    ];
    for (const heading of guideHeadings) {
      const body = `${heading}\n\nSome body text.`;
      const errors = validateHeadings(body, 'test.md');
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].includes('Redundant trailing "Guide" in H1 heading'));
      assert.ok(errors[0].includes('Strip the trailing "Guide"'));
    }
  });

  test('disallows frontmatter titles ending with redundant "Guide"', () => {
    const guideTitles = [
      'Passkey Registration Guide',
      'Web Components Orientation Guide',
      'passkey guide',
      'PASSKEY AUTHENTICATION GUIDE',
      'Custom Elements Guide ',
      'Passkey Reauthentication Guide  ',
    ];
    for (const title of guideTitles) {
      const errors = validateHeadings('Some body text', 'test.md', { title });
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].includes('Redundant trailing "Guide" in frontmatter title'));
      assert.ok(errors[0].includes('Strip the trailing "Guide"'));
    }
  });

  test('allows depth > 1 headings ending with "Guide" (e.g. ## Implementation Guide)', () => {
    const body = `# Passkey Authentication

## Implementation Guide
Some implementation steps.

### Migration Guide
Some migration details.

#### Setup Guide
Setup instructions.
`;
    const errors = validateHeadings(body, 'test.md');
    assert.deepStrictEqual(errors, []);
  });

  test('allows H1 headings containing "Guide" in non-suffix positions or words like Guidelines', () => {
    const validHeadings = [
      '# Guide for Dynamic Sibling Animations',
      '# Guidelines for Accessibility',
      '# Guide to Passkeys',
      '# Web Privacy Guidelines for Developers',
      '# Guidelines',
    ];
    for (const heading of validHeadings) {
      const body = `${heading}\n\nSome body text.`;
      const errors = validateHeadings(body, 'test.md');
      assert.deepStrictEqual(errors, []);
    }
  });

  test('allows frontmatter titles containing "Guide" in non-suffix positions or words like Guidelines', () => {
    const validTitles = [
      'Guide for Dynamic Sibling Animations',
      'Guidelines for Accessibility',
      'Guide to Passkeys',
      'Web Privacy Guidelines for Developers',
      'Guidelines',
    ];
    for (const title of validTitles) {
      const errors = validateHeadings('Some body text', 'test.md', { title });
      assert.deepStrictEqual(errors, []);
    }
  });

  test('allows descriptive H1 headings', () => {
    const validHeadings = [
      '# Declarative Dialog and Popover Control',
      '# HTML',
      '# Persistent Top Layer UI',
      '# Move DOM Element Without Losing State',
      '# Agentic JavaScript Tools',
      '# Overview of Invoker Commands',
      '# Introduction to WebMCP',
      '# Guide for Dynamic Sibling Animations',
    ];
    for (const heading of validHeadings) {
      const body = `${heading}\n\nSome body text.`;
      const errors = validateHeadings(body, 'test.md');
      assert.deepStrictEqual(errors, []);
    }
  });

  test('ignores vague headings inside code blocks', () => {
    const body = `\`\`\`markdown
# Overview
# Introduction
\`\`\`
`;
    const errors = validateHeadings(body, 'test.md');
    assert.deepStrictEqual(errors, []);
  });

  test('flags vague frontmatter title', () => {
    const errors = validateHeadings('Some body text', 'test.md', { title: 'Overview' });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].includes('Vague title "Overview" in frontmatter'));
  });

  test('validateGuideTitle flags missing title in non-stub guide when requireTitle is set', () => {
    const nonStubBody = `Some guide content without H1 heading.`;
    const errors = validateGuideTitle(nonStubBody, 'test.md', {}, { requireTitle: true });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].includes('Missing H1 heading or frontmatter "title" in non-stub guide'));
  });

  test('validateGuideTitle flags whitespace-only frontmatter title when requireTitle is set', () => {
    const nonStubBody = `Some guide content without H1 heading.`;
    const errors = validateGuideTitle(nonStubBody, 'test.md', { title: '   ' }, { requireTitle: true });
    assert.strictEqual(errors.length, 1);
    assert.ok(errors[0].includes('Missing H1 heading or frontmatter "title" in non-stub guide'));
  });

  test('validateGuideTitle succeeds with valid descriptive frontmatter title without an H1', () => {
    const nonStubBody = `Some guide content without H1 heading.`;
    const errors = validateGuideTitle(nonStubBody, 'test.md', { title: 'Descriptive Feature Title' }, { requireTitle: true });
    assert.deepStrictEqual(errors, []);
  });

  test('validateGuideTitle allows stub guide without title even when requireTitle is set', () => {
    const stubBody = `<!-- stub -->\n`;
    const errors = validateGuideTitle(stubBody, 'test.md', {}, { requireTitle: true });
    assert.deepStrictEqual(errors, []);
  });

  test('validateGuide integrates heading validation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-val-test-'));
    const guideDir = path.join(tmpDir, 'test-guide');
    fs.mkdirSync(guideDir, { recursive: true });
    const guideFile = path.join(guideDir, 'guide.md');

    fs.writeFileSync(guideFile, `---
name: test-guide
description: Test description
web-feature-ids: []
---

# Overview

Guide content.
`);

    try {
      const result = validateGuide(guideFile);
      assert.ok(result.errors.some(e => e.includes('Vague H1 heading "# Overview"')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('validateGuide enforces title presence on non-stub guides', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-val-title-'));
    const guideDir = path.join(tmpDir, 'test-guide');
    fs.mkdirSync(guideDir, { recursive: true });
    const guideFile = path.join(guideDir, 'guide.md');

    fs.writeFileSync(guideFile, `---
name: test-guide
description: Test description
web-feature-ids: []
---

## Section Title

Guide content without H1 heading or frontmatter title.
`);

    try {
      const result = validateGuide(guideFile);
      assert.ok(result.errors.some(e => e.includes('Missing H1 heading or frontmatter "title" in non-stub guide')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('validateGuide allows stub guides without title or H1 heading', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-val-stub-'));
    const guideDir = path.join(tmpDir, 'test-guide');
    fs.mkdirSync(guideDir, { recursive: true });
    const guideFile = path.join(guideDir, 'guide.md');

    fs.writeFileSync(guideFile, `---
name: test-guide
description: Test description
web-feature-ids: []
---

<!-- stub guide -->
`);

    try {
      const result = validateGuide(guideFile);
      assert.strictEqual(result.errors.length, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('inventoryGuide and classifyGuide target discovery', () => {
  test('correctly identifies target inventory and classifies target guide status', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-test-'));
    const guideDir = path.join(tmpDir, 'test-guide');
    const targetsDir = path.join(guideDir, 'targets', 'daily-grind');
    const patchesDir = path.join(targetsDir, 'patches');
    fs.mkdirSync(patchesDir, { recursive: true });
    
    fs.writeFileSync(path.join(guideDir, 'guide.md'), '# Test Guide\nContent');
    fs.writeFileSync(path.join(guideDir, 'expectations.md'), '- rule');
    fs.writeFileSync(path.join(patchesDir, 'jetski-solution.patch'), '+++ b/src/app.ts\n+const x = 1;');
    fs.writeFileSync(path.join(patchesDir, 'claude-solution.patch'), '+++ b/src/app.ts\n+const x = 1;');
    fs.writeFileSync(path.join(patchesDir, 'codex-solution.patch'), '+++ b/src/app.ts\n+const x = 1;');
    fs.writeFileSync(path.join(patchesDir, 'zero-passrate.patch'), '+++ b/src/app.ts\n+const x = 2;');
    fs.writeFileSync(path.join(targetsDir, 'grader.ts'), 'console.log("test");');
    fs.writeFileSync(path.join(targetsDir, 'task.md'), '- Implement feature');

    try {
      const inv = inventoryGuide(guideDir);
      assert.strictEqual(inv.targets?.length, 1);
      assert.strictEqual(inv.targets?.[0].name, 'daily-grind');
      assert.strictEqual(inv.targets?.[0].hasSolution, true);
      assert.strictEqual(inv.targets?.[0].hasZeroPassrate, true);
      assert.strictEqual(inv.targets?.[0].hasGrader, true);
      assert.strictEqual(inv.targets?.[0].hasTask, true);
      
      const status = classifyGuide(inv);
      assert.strictEqual(status, 'eval-ready');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('classifyGuide returns incomplete, needs-calibration, and needs-test for partial target capsules', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-test-target-partial-'));
    const guideDir = path.join(tmpDir, 'guides', 'test-category', 'test-guide-partial');
    const targetsDir = path.join(guideDir, 'targets', 'daily-grind');
    const patchesDir = path.join(targetsDir, 'patches');
    fs.mkdirSync(patchesDir, { recursive: true });

    fs.writeFileSync(path.join(guideDir, 'guide.md'), '# Test Guide\nContent');
    fs.writeFileSync(path.join(guideDir, 'expectations.md'), '- rule');

    try {
      // Case 1: only partial solutions exist across targets -> hasSolution is false
      fs.writeFileSync(path.join(patchesDir, 'jetski-solution.patch'), '+++ b/src/app.ts\n+const x = 1;');
      let inv = inventoryGuide(guideDir);
      assert.strictEqual(classifyGuide(inv), 'incomplete');

      // Case 2: all solution patches and zero-passrate exist, but missing grader
      fs.writeFileSync(path.join(patchesDir, 'claude-solution.patch'), '+++ b/src/app.ts\n+const x = 1;');
      fs.writeFileSync(path.join(patchesDir, 'codex-solution.patch'), '+++ b/src/app.ts\n+const x = 1;');
      fs.writeFileSync(path.join(patchesDir, 'zero-passrate.patch'), '+++ b/src/app.ts\n+const x = 2;');
      inv = inventoryGuide(guideDir);
      assert.strictEqual(classifyGuide(inv), 'needs-calibration');

      // Case 3: solutions, zero-passrate, and grader exist, but missing task
      fs.writeFileSync(path.join(targetsDir, 'grader.ts'), 'console.log("test");');
      inv = inventoryGuide(guideDir);
      assert.strictEqual(classifyGuide(inv), 'needs-test');

      // Case 4: all present -> eval-ready
      fs.writeFileSync(path.join(targetsDir, 'task.md'), '- task');
      inv = inventoryGuide(guideDir);
      assert.strictEqual(classifyGuide(inv), 'eval-ready');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('prioritizes single-page root files (Option A) over target tasks (Option B) if both are present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-both-test-'));
    const guideDir = path.join(tmpDir, 'test-guide');
    const targetsDir = path.join(guideDir, 'targets', 'daily-grind');
    const patchesDir = path.join(targetsDir, 'patches');
    const tasksDir = path.join(guideDir, 'tasks');
    fs.mkdirSync(patchesDir, { recursive: true });
    fs.mkdirSync(tasksDir, { recursive: true });
    
    fs.writeFileSync(path.join(guideDir, 'guide.md'), '# Test Guide\nContent');
    fs.writeFileSync(path.join(guideDir, 'expectations.md'), '- rule');
    
    // Write Option B files
    fs.writeFileSync(path.join(patchesDir, 'jetski-solution.patch'), 'patch');
    fs.writeFileSync(path.join(patchesDir, 'claude-solution.patch'), 'patch');
    fs.writeFileSync(path.join(patchesDir, 'codex-solution.patch'), 'patch');
    fs.writeFileSync(path.join(patchesDir, 'zero-passrate.patch'), 'patch');
    fs.writeFileSync(path.join(targetsDir, 'grader.ts'), 'grader');
    fs.writeFileSync(path.join(targetsDir, 'task.md'), '- task');
    
    // Write Option A files
    fs.writeFileSync(path.join(guideDir, 'demo.html'), '<html></html>');
    fs.writeFileSync(path.join(guideDir, 'negative-demo.html'), '<html></html>');
    fs.writeFileSync(path.join(guideDir, 'grader.ts'), 'grader');
    fs.writeFileSync(path.join(tasksDir, 'task.md'), '- root task');

    try {
      const inv = inventoryGuide(guideDir);
      // Since tasks/ exists, Option A is prioritized, meaning inv.targets should be undefined
      assert.strictEqual(inv.targets, undefined);
      assert.strictEqual(inv.hasDemo, true);
      assert.strictEqual(inv.hasNegativeDemo, true);
      assert.strictEqual(inv.hasGrader, true);
      assert.strictEqual(inv.hasTask, true);
      
      const status = classifyGuide(inv);
      assert.strictEqual(status, 'eval-ready');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('getSupportedBaseApps', () => {
  test('returns the exact list of supported base applications', () => {
    const apps = getSupportedBaseApps();
    assert.deepStrictEqual(apps, ['daily-grind', 'devtools-times']);
  });
});

describe('extractFeatureIds', () => {
  test('extracts tmp- feature IDs while removing outer formatting', () => {
    const body = `
### web-feature-id

tmp-streaming-api

**Web Feature ID**: \`tmp-streaming-api\`
Feature ID: *tmp-fetch-body*
https://webstatus.dev/features/tmp-custom-feature
`;
    const fids = extractFeatureIds(body);
    assert.ok(fids.includes('tmp-streaming-api'));
    assert.ok(fids.includes('tmp-fetch-body'));
    assert.ok(fids.includes('tmp-custom-feature'));
  });
});

describe('validateBaselineClaims', () => {
  test('flags hardcoded baseline availability claims', () => {
    const cases = [
      'The `<details>` element is Baseline Widely available, so a fallback strategy is not required.',
      'The `hidden="until-found"` attribute is not yet Baseline Widely available, but it can be safely used.',
      'The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but older browsers need a fallback.',
      'Speculative loading is a new feature (Baseline limited availability).',
      'The mechanics are all Baseline Widely Available, so the gesture works broadly.',
      'The features are Baseline newly available across modern browsers.',
      'The capabilities have been Baseline since April 2024.',
      'Most features used in this guide are Baseline Widely available.',
      'Feature overscroll-behavior was Baseline Widely Available but no longer is.',
    ];

    for (const text of cases) {
      const errors = validateBaselineClaims(text, 'guides/test/guide.md');
      assert.strictEqual(errors.length, 1, `Expected "${text}" to produce 1 error`);
      assert.ok(errors[0].includes('Hardcoded Baseline availability claim found'));
      assert.ok(errors[0].includes('Use {{ BASELINE_STATUS("feature-id") }} macro instead.'));
    }
  });

  test('allows macros without error', () => {
    const body = `
## Fallback strategies

{{ BASELINE_STATUS("speculation-rules") }}

{{ FEATURE_FALLBACKS("user-pseudos") }}

{{ BASELINE_STATUS("scroll-snap") }}
`;
    const errors = validateBaselineClaims(body, 'guides/test/guide.md');
    assert.deepStrictEqual(errors, []);
  });

  test('allows legitimate non-status baseline prose and CSS properties', () => {
    const validProse = [
      'A fallback strategy is required if `fetchLater()` does not meet your Baseline target.',
      'If your Baseline target does not include `scrollbar-width`, the row still scrolls.',
      'If a parallax fallback is required for older baseline targets, attach a `scroll` listener.',
      'Reach for native masonry only when it ships in your Baseline target.',
      'Use `@starting-style` to define the baseline styles the browser should compute.',
      'Phase 1 and 2 establish baseline hygiene and data gathering.',
      'Trim the text box to the cap-height and the alphabetic baseline.',
      'Reset a task to its baseline configuration.',
      'Clone the baseline session for new tasks.',
      'Until there is Baseline support for container style queries, use selectors.',
    ];

    for (const text of validProse) {
      const errors = validateBaselineClaims(text, 'guides/test/guide.md');
      assert.deepStrictEqual(errors, [], `Expected legitimate prose "${text}" to have no errors`);
    }
  });

  test('ignores code blocks with baseline mentions or CSS baseline properties', () => {
    const body = `
\`\`\`css
.item {
  vertical-align: baseline;
  alignment-baseline: baseline;
}
\`\`\`

\`\`\`markdown
The <details> element is Baseline Widely available.
\`\`\`
`;
    const errors = validateBaselineClaims(body, 'guides/test/guide.md');
    assert.deepStrictEqual(errors, []);
  });

  test('ignores SKILL.md meta policy instructions', () => {
    const body = `* **Default Behavior**: All guides assume **Baseline Widely available** features are safe to use without fallbacks.`;
    const errors = validateBaselineClaims(body, 'guides/modern-web-guidance/SKILL.md');
    assert.deepStrictEqual(errors, []);
  });

  test('validateGuide integrates baseline claims validation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-baseline-test-'));
    const guideDir = path.join(tmpDir, 'test-guide');
    fs.mkdirSync(guideDir, { recursive: true });
    const guideFile = path.join(guideDir, 'guide.md');

    fs.writeFileSync(guideFile, `---
name: test-guide
description: Test description
web-feature-ids: []
---

# Test Guide

The \`<details>\` element is Baseline Widely available.
`);

    try {
      const result = validateGuide(guideFile);
      assert.ok(result.errors.some(e => e.includes('Hardcoded Baseline availability claim found')));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});


