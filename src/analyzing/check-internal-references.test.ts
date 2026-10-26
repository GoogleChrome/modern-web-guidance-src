import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BANNED_PATTERNS,
  isOutOfScope,
  runCheck,
} from './check-internal-references.ts';

describe('check-internal-references guard', () => {
  it('defines the required banned pattern regexes with correct boundaries', () => {
    const patternNames = BANNED_PATTERNS.map((p) => p.name);
    assert.deepStrictEqual(patternNames, [
      'analyzer-internal',
      'gitmirror',
      'farm_fingerprint',
      'jetski',
      'decision-id',
    ]);

    const decisionId = BANNED_PATTERNS.find((p) => p.name === 'decision-id')!.regex;
    assert.ok(decisionId.test('D-041'));
    assert.ok(decisionId.test('ref (D-042)'));
    // Should NOT match card-001 or standard words
    assert.ok(!decisionId.test('card-001'));
    assert.ok(!decisionId.test('standard-001'));

    const internalDir = BANNED_PATTERNS.find((p) => p.name === 'analyzer-internal')!.regex;
    assert.ok(internalDir.test('join(root, "analyzer-internal")'));
    assert.ok(internalDir.test('ANALYZER-INTERNAL/labels'));

    const datasetPattern = BANNED_PATTERNS.find((p) => p.name === 'gitmirror')!.regex;
    assert.ok(datasetPattern.test('GitMirror'));
    assert.ok(datasetPattern.test('git-mirror'));
    assert.ok(datasetPattern.test('git_mirror'));

    const farmPattern = BANNED_PATTERNS.find((p) => p.name === 'farm_fingerprint')!.regex;
    assert.ok(farmPattern.test('FARM_FINGERPRINT(repo)'));
    assert.ok(farmPattern.test('farm_fingerprint'));

    const agentPattern = BANNED_PATTERNS.find((p) => p.name === 'jetski')!.regex;
    assert.ok(agentPattern.test('Jetski'));
    assert.ok(agentPattern.test('jetski'));
  });

  it('correctly classifies out-of-scope files owned by other agents', () => {
    assert.strictEqual(isOutOfScope('src/analyzing/README.md'), true);
    assert.strictEqual(isOutOfScope('src/analyzing/LEXICON.md'), true);
    assert.strictEqual(isOutOfScope('src/analyzing/cli.ts'), true);
    assert.strictEqual(isOutOfScope('src/analyzing/cli.test.ts'), true);
    assert.strictEqual(isOutOfScope('src/analyzing/schema.ts'), true);
    assert.strictEqual(isOutOfScope('src/analyzing/rules/index.ts'), true);
    assert.strictEqual(isOutOfScope('src/analyzing/scanners/file-filter.ts'), true);
    assert.strictEqual(isOutOfScope('src/analyzing/rules/checkbox.ts'), true);

    // in-scope files owned by this task
    assert.strictEqual(isOutOfScope('src/analyzing/rules/lazy-load-video-and-audio.ts'), false);
    assert.strictEqual(isOutOfScope('src/analyzing/eval/detection-eval.ts'), false);
    assert.strictEqual(isOutOfScope('src/analyzing/eval/update-eval.ts'), false);
    assert.strictEqual(isOutOfScope('src/analyzing/eval/guide-triage.ts'), false);
    assert.strictEqual(isOutOfScope('src/analyzing/qualification.ts'), false);
    assert.strictEqual(isOutOfScope('src/analyzing/eval/prompts.ts'), false);
  });

  it('passes on current codebase with zero in-scope violations and only schema.ts pending', () => {
    const { inScopeViolations, pendingViolations } = runCheck();
    assert.deepStrictEqual(inScopeViolations, [], 'Expected zero unexempted in-scope violations');
    assert.strictEqual(pendingViolations.length, 1, 'Expected only schema.ts:43 pending');
    assert.strictEqual(pendingViolations[0]?.file, 'src/analyzing/schema.ts');
  });
});
