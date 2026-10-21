import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  type BlindCardPayload,
  buildGeminiRequestBody,
  computeJudgePromptVersion,
  JUDGE_SYSTEM_PROMPT,
  JUDGE_VERSION,
  parseJudgeJsonContent,
} from './eval-judge.ts';

describe('eval-judge (R45 Judge Prompt Sync)', () => {
  it('defines all five verdicts and expanded leave-it criteria in JUDGE_SYSTEM_PROMPT', () => {
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('"right"'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('"not-old-pattern"'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('"leave-it"'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('"guide-wrong"'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('"unsure"'));

    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes('Genuine legacy pattern where applying the guide is a clean win.'),
    );
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes(
        "Matcher misfired — this code isn't even doing the legacy pattern the guide replaces.",
      ),
    );
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('no-op syntax swap'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('non-1:1 library component migration'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('custom side effects'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('order-dependent geometry'));
    assert.ok(JUDGE_SYSTEM_PROMPT.includes('incompatible API contract'));
    assert.ok(
      JUDGE_SYSTEM_PROMPT.includes(
        "The guide's advice is bad or overstates what the feature does for this case.",
      ),
    );
  });

  it('computes a deterministic content-hashed JUDGE_VERSION', () => {
    const version = computeJudgePromptVersion();
    assert.equal(version, JUDGE_VERSION);
    assert.match(version, /:detective-v7-r45-[0-9a-f]{8}$/);
  });

  it('builds a Gemini request body with the updated JUDGE_SYSTEM_PROMPT', () => {
    const sampleCard: BlindCardPayload = {
      cardId: 'card-001',
      repo: 'owner/repo',
      file: 'src/styles.css',
      line: 10,
      guideId: 'individual-transform-properties',
      guideSummary: {
        guideId: 'individual-transform-properties',
        problem: 'Combining transforms',
        before: 'transform: translateX(10px)',
        now: 'translate: 10px',
        markdownBody: '# Individual transform properties\nUse `translate`, `rotate`, and `scale`.',
      },
      codeSnippet: '.box:hover { transform: scale(1.05); }',
    };

    const body = buildGeminiRequestBody(sampleCard);
    assert.deepEqual(body.systemInstruction, {
      parts: [{ text: JUDGE_SYSTEM_PROMPT }],
    });
  });

  it('derives leave-it verdict via parseJudgeJsonContent when modern_feature_applies_here is false', () => {
    const res = parseJudgeJsonContent(
      JSON.stringify({
        matches_before_syntax: true,
        has_fallback_or_feature_guard: false,
        modern_feature_applies_here: false,
        reasoning: 'Single transform function swap is a no-op syntax swap with no composition benefit.',
        verdict: 'leave-it',
      }),
      'card-001',
    );
    assert.equal(res.verdict, 'leave-it');
  });
});
