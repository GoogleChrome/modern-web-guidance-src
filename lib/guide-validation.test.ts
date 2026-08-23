import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseExpectations, validateHtmlTags, inventoryGuide, classifyGuide, getSupportedBaseApps } from './guide-validation.ts';
import { extractFeatureIds } from './feature-parser.ts';

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

