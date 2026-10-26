import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BANNED_PATTERNS,
  isExemptedLine,
  isPendingEc03a62f,
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
      'review-observation-decision-id',
    ]);

    const reviewObsId = BANNED_PATTERNS.find((p) => p.name === 'review-observation-decision-id')!.regex;
    assert.ok(reviewObsId.test('D-041'));
    assert.ok(reviewObsId.test('ref (D-042)'));
    assert.ok(reviewObsId.test('per R45'));
    assert.ok(reviewObsId.test('(O64)'));
    assert.ok(reviewObsId.test('G10 disclosure'));
    assert.ok(reviewObsId.test('R29 fail fast'));
    // Should NOT match card-001 or standard words
    assert.ok(!reviewObsId.test('card-001'));
    assert.ok(!reviewObsId.test('standard-001'));

    const internalDir = BANNED_PATTERNS.find((p) => p.name === 'analyzer-internal')!.regex;
    assert.ok(internalDir.test('join(root, "analyzer-internal")'));
    assert.ok(internalDir.test('join(root, "analyzer_internal")'));
    assert.ok(internalDir.test('ANALYZER-INTERNAL/labels'));
    assert.ok(internalDir.test('analyzer internal'));

    const datasetPattern = BANNED_PATTERNS.find((p) => p.name === 'gitmirror')!.regex;
    assert.ok(datasetPattern.test('GitMirror'));
    assert.ok(datasetPattern.test('git-mirror'));
    assert.ok(datasetPattern.test('git_mirror'));

    const farmPattern = BANNED_PATTERNS.find((p) => p.name === 'farm_fingerprint')!.regex;
    assert.ok(farmPattern.test('FARM_FINGERPRINT(repo)'));
    assert.ok(farmPattern.test('farm_fingerprint'));
    assert.ok(farmPattern.test('farm-fingerprint'));
    assert.ok(farmPattern.test('farm fingerprint'));

    const agentPattern = BANNED_PATTERNS.find((p) => p.name === 'jetski')!.regex;
    assert.ok(agentPattern.test('Jetski'));
    assert.ok(agentPattern.test('jetski'));
  });

  it('exempts exactly one line for gitMirrorFilter in schema.ts', () => {
    assert.strictEqual(
      isExemptedLine('src/analyzing/schema.ts', '  readonly gitMirrorFilter?: {'),
      true,
    );
    assert.strictEqual(
      isExemptedLine('src/analyzing/schema.ts', '  readonly otherField?: string;'),
      false,
    );
    assert.strictEqual(
      isExemptedLine('src/analyzing/eval/detection-eval.ts', '  gitMirrorFilter'),
      false,
    );
  });

  it('identifies files actively edited by ec03a62f', () => {
    assert.strictEqual(isPendingEc03a62f('src/analyzing/rules/index.ts'), true);
    assert.strictEqual(isPendingEc03a62f('src/analyzing/rules/index.test.ts'), true);
    assert.strictEqual(isPendingEc03a62f('src/analyzing/eval/update-eval-data.json'), true);
    assert.strictEqual(isPendingEc03a62f('src/analyzing/rules/copy-button.ts'), true);
    assert.strictEqual(isPendingEc03a62f('src/analyzing/rules/camera-and-microphone-capture.ts'), true);

    // Other files are NOT exempted
    assert.strictEqual(isPendingEc03a62f('src/analyzing/README.md'), false);
    assert.strictEqual(isPendingEc03a62f('src/analyzing/cli.ts'), false);
    assert.strictEqual(isPendingEc03a62f('src/analyzing/eval/detection-eval.ts'), false);
    assert.strictEqual(isPendingEc03a62f('src/analyzing/eval/update-eval.ts'), false);
    assert.strictEqual(isPendingEc03a62f('src/analyzing/rules/checkbox.ts'), false);
    assert.strictEqual(isPendingEc03a62f('src/analyzing/scanners/file-filter.ts'), false);
  });

  it('passes on current codebase with zero unexempted violations', () => {
    const { inScopeViolations } = runCheck();
    assert.deepStrictEqual(inScopeViolations, [], 'Expected zero unexempted in-scope violations');
  });
});
