import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { WORKTREE_ROOT } from './paths.ts';
import {
  deriveQualifiedGuideIds,
  evaluateJudgeAdmission,
  evaluateRuleQualification,
  JSON_QUALIFIED_GUIDE_IDS,
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_JUDGE_METADATA,
  QUALIFIED_RULE_MANIFEST,
  TERMINAL_QUALIFIED_GUIDE_IDS,
} from './qualification.ts';

describe('qualification shipping lists (O40, O42, O64, O65)', () => {
  it('ships empty default qualification lists while judge is not admitted on unseen labels', () => {
    assert.deepStrictEqual(TERMINAL_QUALIFIED_GUIDE_IDS, []);
    assert.deepStrictEqual(JSON_QUALIFIED_GUIDE_IDS, []);
    assert.deepStrictEqual(QUALIFIED_GUIDE_IDS, []);
  });

  it('guarantees shipping lists cannot contradict final scorecard (O64)', async () => {
    const finalScorecardPath = join(
      WORKTREE_ROOT,
      'analyzer-internal/findings/2026-10-16-gitmirror-final-scorecard.json',
    );
    const raw = await readFile(finalScorecardPath, 'utf8');
    const scorecard = JSON.parse(raw) as {
      guides: Array<{
        guideId: string;
        totalFindings: number;
        precision: number;
        wilson95: { lower: number };
        phase1Findings?: number;
        phase1Precision?: number;
        phase1Wilson95?: { lower: number };
      }>;
    };

    // Find all guides that failed the final held-out bar (wilson95.lower < 0.90)
    const failedOnFinal = scorecard.guides.filter((g) => g.wilson95.lower < 0.90);
    const failedGuideIds = new Set(failedOnFinal.map((g) => g.guideId));

    // animate-element-entry-exit is known to have failed final (46/58 = 79.3%, lower bound 0.672)
    assert.ok(
      failedGuideIds.has('animate-element-entry-exit'),
      'animate-element-entry-exit must be recognized as having failed final',
    );

    // Verify that NO failed guide is in shipping qualification lists
    for (const gid of failedGuideIds) {
      assert.strictEqual(
        TERMINAL_QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Failing guide "${gid}" must NOT be in TERMINAL_QUALIFIED_GUIDE_IDS`,
      );
      assert.strictEqual(
        JSON_QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Failing guide "${gid}" must NOT be in JSON_QUALIFIED_GUIDE_IDS`,
      );
    }
  });

  it('deriveQualifiedGuideIds returns empty lists when judge is unadmitted', () => {
    const derived = deriveQualifiedGuideIds({
      judgeAdmitted: false,
      judgeAlpha: -0.099,
      guides: [
        {
          guideId: 'individual-transform-properties',
          totalFindings: 95,
          precision: 0.989,
          wilson95: { proportion: 0.989, lower: 0.943, upper: 0.998, n: 95 },
          phase1Findings: 97,
          phase1Precision: 0.979,
          phase1Wilson95: { proportion: 0.979, lower: 0.928, upper: 0.994, n: 97 },
        },
      ],
    });
    assert.deepStrictEqual(derived.terminalQualified, []);
    assert.deepStrictEqual(derived.jsonQualified, []);
  });

  it('deriveQualifiedGuideIds qualifies only guides clearing 0.90 LB at n>=35 when judge is admitted', () => {
    const derived = deriveQualifiedGuideIds({
      judgeAdmitted: true,
      judgeAlpha: 0.75,
      guides: [
        {
          guideId: 'individual-transform-properties',
          totalFindings: 95,
          precision: 0.989,
          wilson95: { proportion: 0.989, lower: 0.943, upper: 0.998, n: 95 },
          phase1Findings: 97,
          phase1Precision: 0.979,
          phase1Wilson95: { proportion: 0.979, lower: 0.928, upper: 0.994, n: 97 },
        },
        {
          guideId: 'animate-element-entry-exit',
          totalFindings: 58,
          precision: 0.793,
          wilson95: { proportion: 0.793, lower: 0.672, upper: 0.878, n: 58 },
          phase1Findings: 58,
          phase1Precision: 0.759,
          phase1Wilson95: { proportion: 0.759, lower: 0.646, upper: 0.852, n: 58 },
        },
      ],
    });
    assert.deepStrictEqual(derived.terminalQualified, ['individual-transform-properties']);
    assert.deepStrictEqual(derived.jsonQualified, ['individual-transform-properties']);
  });
});

describe('Judge Admission (D-031, D-036)', () => {
  it('admits judge when AC1 >= 0.70, stability >= 0.90, and canary TNR >= 0.95', () => {
    const result = evaluateJudgeAdmission({
      gwetsAC1: 0.703,
      krippendorffAlpha: 0.163,
      threePassStability: 0.965,
      canaryTnr: 1.0,
      calibrationCount: 115,
    });
    assert.strictEqual(result.admitted, true);
    assert.deepStrictEqual(result.reasons, []);
  });

  it('admits judge when Krippendorff alpha >= 0.70 even if AC1 is lower', () => {
    const result = evaluateJudgeAdmission({
      gwetsAC1: 0.65,
      krippendorffAlpha: 0.72,
      threePassStability: 0.92,
      canaryTnr: 1.0,
    });
    assert.strictEqual(result.admitted, true);
    assert.deepStrictEqual(result.reasons, []);
  });

  it('rejects judge when both AC1 and alpha are below 0.70', () => {
    const result = evaluateJudgeAdmission({
      gwetsAC1: 0.62,
      krippendorffAlpha: 0.55,
      threePassStability: 0.95,
      canaryTnr: 1.0,
    });
    assert.strictEqual(result.admitted, false);
    assert.ok(result.reasons.some((r) => r.includes('Inter-rater agreement below bar')));
  });

  it('rejects judge when 3-pass stability < 0.90', () => {
    const result = evaluateJudgeAdmission({
      gwetsAC1: 0.75,
      threePassStability: 0.88,
      canaryTnr: 1.0,
    });
    assert.strictEqual(result.admitted, false);
    assert.ok(result.reasons.some((r) => r.includes('3-pass stability')));
  });

  it('rejects judge when canary TNR < 0.95', () => {
    const result = evaluateJudgeAdmission({
      gwetsAC1: 0.75,
      threePassStability: 0.95,
      canaryTnr: 0.90,
    });
    assert.strictEqual(result.admitted, false);
    assert.ok(result.reasons.some((r) => r.includes('Canary TNR')));
  });

  it('QUALIFIED_JUDGE_METADATA reflects D-031 and D-036 calibration and admission', () => {
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.admitted, true);
    assert.strictEqual(
      QUALIFIED_JUDGE_METADATA.judgeVersion,
      'gemini-3.8-flash:detective-v6-spec22-c3f54b90',
    );
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.gwetsAC1, 0.703);
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.krippendorffAlpha, 0.163);
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.threePassStability, 0.965);
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.canaryTnr, 1.0);
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.calibrationCount, 115);
    assert.match(QUALIFIED_JUDGE_METADATA.notes, /D-031/);
    assert.match(QUALIFIED_JUDGE_METADATA.notes, /D-036/);
    assert.match(QUALIFIED_JUDGE_METADATA.notes, /\(2\/2\)/);

    const evaluated = evaluateJudgeAdmission(QUALIFIED_JUDGE_METADATA);
    assert.strictEqual(evaluated.admitted, true);
  });
});

describe('Rule Qualification and Manifest (D-031, D-036)', () => {
  it('evaluateRuleQualification enforces n >= 35 and wilsonLower >= 0.90', () => {
    assert.strictEqual(
      evaluateRuleQualification({ sampleSize: 35, wilsonLower: 0.90 }).qualified,
      true,
    );
    assert.strictEqual(
      evaluateRuleQualification({ sampleSize: 34, wilsonLower: 0.95 }).qualified,
      false,
    );
    assert.strictEqual(
      evaluateRuleQualification({ sampleSize: 50, wilsonLower: 0.899 }).qualified,
      false,
    );
  });

  it('QUALIFIED_RULE_MANIFEST contains rules clearing wilsonLower >= 0.90 at n >= 35 on held-out', () => {
    assert.ok(QUALIFIED_RULE_MANIFEST.length >= 3);
    for (const rule of QUALIFIED_RULE_MANIFEST) {
      assert.ok(rule.sampleSize >= 35);
      assert.ok(rule.wilsonLower >= 0.90);
      assert.strictEqual(rule.split, 'held-out');
      const evalResult = evaluateRuleQualification(rule);
      assert.strictEqual(evalResult.qualified, true);
    }

    const guideIds = QUALIFIED_RULE_MANIFEST.map((r) => r.guideId);
    assert.ok(guideIds.includes('autofill-highlight-inputs'));
    assert.ok(guideIds.includes('complex-shapes'));
    assert.ok(guideIds.includes('deliver-optimized-decorative-images'));
  });
});
