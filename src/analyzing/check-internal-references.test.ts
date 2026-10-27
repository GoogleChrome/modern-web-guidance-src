import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BANNED_PATTERNS,
  isExemptedLine,
  runCheck,
} from './check-internal-references.ts';

const fromParts = (...parts: readonly string[]): string => parts.join('');

describe('check-internal-references guard', () => {
  it('defines the required banned pattern regexes with correct boundaries', () => {
    const internalDirName = fromParts('analyzer', '-', 'internal');
    const datasetName = fromParts('git', 'mirror');
    const fingerprintName = fromParts('farm', '_', 'fingerprint');
    const agentName = fromParts('jet', 'ski');

    const patternNames = BANNED_PATTERNS.map((p) => p.name);
    assert.deepStrictEqual(patternNames, [
      internalDirName,
      datasetName,
      fingerprintName,
      agentName,
      'review-observation-decision-id',
      'internal-doc-reference',
    ]);

    const docPattern = BANNED_PATTERNS.find((p) => p.name === 'internal-doc-reference')!.regex;
    assert.ok(docPattern.test(fromParts('PROG', 'RESS', '.md')));
    assert.ok(docPattern.test(fromParts('PL', 'AN', '.md')));
    assert.ok(docPattern.test(fromParts('DECIS', 'IONS', '.md')));
    assert.ok(docPattern.test(fromParts('logged in prog', 'ress.md')));
    assert.ok(docPattern.test(fromParts('see pl', 'an.md')));
    assert.ok(docPattern.test(fromParts('per decis', 'ions.md')));
    assert.ok(!docPattern.test('README.md'));
    assert.ok(!docPattern.test('LEXICON.md'));
    assert.ok(!docPattern.test('guide.md'));

    const reviewObsId = BANNED_PATTERNS.find((p) => p.name === 'review-observation-decision-id')!.regex;
    assert.ok(reviewObsId.test(fromParts('D-', '041')));
    assert.ok(reviewObsId.test(fromParts('ref (D-', '042)')));
    assert.ok(reviewObsId.test(fromParts('per R', '45')));
    assert.ok(reviewObsId.test(fromParts('(O', '64)')));
    assert.ok(reviewObsId.test(fromParts('G', '10 disclosure')));
    assert.ok(reviewObsId.test(fromParts('R', '29 fail fast')));
    // Should NOT match card-001 or standard words
    assert.ok(!reviewObsId.test('card-001'));
    assert.ok(!reviewObsId.test('standard-001'));

    const internalDir = BANNED_PATTERNS.find((p) => p.name === internalDirName)!.regex;
    assert.ok(internalDir.test(fromParts('join(root, "analyzer', '-internal")')));
    assert.ok(internalDir.test(fromParts('join(root, "analyzer', '_internal")')));
    assert.ok(internalDir.test(fromParts('ANALYZER', '-INTERNAL/labels')));
    assert.ok(internalDir.test(fromParts('analyzer', ' internal')));

    const datasetPattern = BANNED_PATTERNS.find((p) => p.name === datasetName)!.regex;
    assert.ok(datasetPattern.test(fromParts('Git', 'Mirror')));
    assert.ok(datasetPattern.test(fromParts('git', '-mirror')));
    assert.ok(datasetPattern.test(fromParts('git', '_mirror')));

    const farmPattern = BANNED_PATTERNS.find((p) => p.name === fingerprintName)!.regex;
    assert.ok(farmPattern.test(fromParts('FARM', '_FINGERPRINT(repo)')));
    assert.ok(farmPattern.test(fromParts('farm', '_fingerprint')));
    assert.ok(farmPattern.test(fromParts('farm', '-fingerprint')));
    assert.ok(farmPattern.test(fromParts('farm', ' fingerprint')));

    const agentPattern = BANNED_PATTERNS.find((p) => p.name === agentName)!.regex;
    assert.ok(agentPattern.test(fromParts('Jet', 'ski')));
    assert.ok(agentPattern.test(fromParts('jet', 'ski')));
  });

  it('exempts narrow lines for prompt continuity and internal progress logging', () => {
    // schema.ts no longer gets an exemption
    assert.strictEqual(
      isExemptedLine('src/analyzing/schema.ts', fromParts('  readonly git', 'MirrorFilter?: {')),
      false,
    );

    // prompts.ts formatBlindCardPrompt no longer gets an exemption
    assert.strictEqual(
      isExemptedLine(
        'src/analyzing/eval/prompts.ts',
        fromParts(
          '      `formatBlindCardPrompt failed: card ${card.cardId ?? \'unknown\'} (guideId: "${card.guideId}") is missing required guideSummary.markdownBody. Failing fast per R',
          '29.`,',
        ),
      ),
      false,
    );

    // 1. llm-verifier.ts formatVerifierPrompt error string
    assert.strictEqual(
      isExemptedLine(
        'src/analyzing/llm-verifier.ts',
        fromParts(
          '      `formatVerifierPrompt failed: guideMarkdown is required for rule ${rule.id} (guide ${rule.guideId ?? rule.id}). Failing fast per R',
          '28/O',
          '55a.`,',
        ),
      ),
      true,
    );
    assert.strictEqual(
      isExemptedLine(
        'src/analyzing/llm-verifier.ts',
        fromParts('  // other comment referencing R', '28'),
      ),
      false,
    );

    assert.strictEqual(
      isExemptedLine(
        'src/analyzing/README.md',
        fromParts('All scorecard results and audit trails are logged to PROG', 'RESS.md.'),
      ),
      false,
    );
  });

  it('passes on current codebase (including this test file) with zero unexempted violations', () => {
    const violations = runCheck();
    assert.deepStrictEqual(violations, [], 'Expected zero unexempted in-scope violations');
  });
});
