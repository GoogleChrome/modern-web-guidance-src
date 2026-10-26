import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BANNED_PATTERNS,
  isExemptedLine,
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
      'internal-doc-reference',
    ]);

    const docPattern = BANNED_PATTERNS.find((p) => p.name === 'internal-doc-reference')!.regex;
    assert.ok(docPattern.test('PROGRESS.md'));
    assert.ok(docPattern.test('PLAN.md'));
    assert.ok(docPattern.test('DECISIONS.md'));
    assert.ok(docPattern.test('logged in progress.md'));
    assert.ok(docPattern.test('see plan.md'));
    assert.ok(docPattern.test('per decisions.md'));
    assert.ok(!docPattern.test('README.md'));
    assert.ok(!docPattern.test('LEXICON.md'));
    assert.ok(!docPattern.test('guide.md'));

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

  it('exempts narrow lines for prompt continuity and internal progress logging', () => {
    // schema.ts no longer gets an exemption
    assert.strictEqual(
      isExemptedLine('src/analyzing/schema.ts', '  readonly gitMirrorFilter?: {'),
      false,
    );

    // prompts.ts formatBlindCardPrompt no longer gets an exemption
    assert.strictEqual(
      isExemptedLine(
        'src/analyzing/eval/prompts.ts',
        '      `formatBlindCardPrompt failed: card ${card.cardId ?? \'unknown\'} (guideId: "${card.guideId}") is missing required guideSummary.markdownBody. Failing fast per R29.`,',
      ),
      false,
    );

    // 1. llm-verifier.ts formatVerifierPrompt error string
    assert.strictEqual(
      isExemptedLine(
        'src/analyzing/llm-verifier.ts',
        '      `formatVerifierPrompt failed: guideMarkdown is required for rule ${rule.id} (guide ${rule.guideId ?? rule.id}). Failing fast per R28/O55a.`,',
      ),
      true,
    );
    assert.strictEqual(
      isExemptedLine(
        'src/analyzing/llm-verifier.ts',
        '  // other comment referencing R28',
      ),
      false,
    );

    // 2. update-eval.ts progress logging in internal eval directory
    assert.strictEqual(
      isExemptedLine(
        'src/analyzing/eval/update-eval.ts',
        '  const progressPath = join(evalDataDir, \'PROGRESS.md\');',
      ),
      true,
    );
    assert.strictEqual(
      isExemptedLine(
        'src/analyzing/README.md',
        'All scorecard results and audit trails are logged to PROGRESS.md.',
      ),
      false,
    );
  });

  it('passes on current codebase with zero unexempted violations', () => {
    const violations = runCheck();
    assert.deepStrictEqual(violations, [], 'Expected zero unexempted in-scope violations');
  });
});
