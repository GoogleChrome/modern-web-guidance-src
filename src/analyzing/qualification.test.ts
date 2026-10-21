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
  SUSPENDED_QUALIFIED_GUIDE_IDS,
  SUSPENDED_QUALIFIED_RULE_HISTORY,
  TERMINAL_QUALIFIED_GUIDE_IDS,
} from './qualification.ts';

describe('qualification shipping lists (O40, O42, O64, O65, O6, D-041, D-042, D-045, D-046)', () => {
  it('maintains empty default shipping guide lists while rules await human blind spot-checks per D-046', () => {
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.admitted, false);
    assert.strictEqual(evaluateJudgeAdmission(QUALIFIED_JUDGE_METADATA).admitted, false);
    assert.deepStrictEqual(TERMINAL_QUALIFIED_GUIDE_IDS, []);
    assert.deepStrictEqual(JSON_QUALIFIED_GUIDE_IDS, []);
    assert.deepStrictEqual(QUALIFIED_GUIDE_IDS, []);
    assert.deepStrictEqual(QUALIFIED_RULE_MANIFEST, []);
  });

  it('records per-guide suspension provenance for all 4 previously qualified guides (D-042)', () => {
    assert.deepStrictEqual(SUSPENDED_QUALIFIED_GUIDE_IDS, [
      'autofill-highlight-inputs',
      'complex-shapes',
      'deliver-optimized-decorative-images',
      'individual-transform-properties',
    ]);
    assert.strictEqual(SUSPENDED_QUALIFIED_RULE_HISTORY.length, 4);
    for (const entry of SUSPENDED_QUALIFIED_RULE_HISTORY) {
      assert.strictEqual(entry.split, 'held-out');
      assert.ok(entry.suspendedAt.length > 0);
      assert.match(entry.suspensionReason, /D-041/);
      assert.match(entry.suspensionReason, /D-042/);
    }
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

describe('Judge Admission (D-031, D-036, D-041, D-042)', () => {
  it('admits judge when AC1 >= 0.70, stability >= 0.95, and canary TNR >= 1.0', () => {
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
      threePassStability: 0.95,
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

  it('rejects judge when 3-pass stability < 0.95 and accepts >= 0.95', () => {
    const rejected = evaluateJudgeAdmission({
      gwetsAC1: 0.75,
      threePassStability: 0.94,
      canaryTnr: 1.0,
    });
    assert.strictEqual(rejected.admitted, false);
    assert.ok(rejected.reasons.some((r) => r.includes('below 95.0% bar')));

    const acceptedBoundary = evaluateJudgeAdmission({
      gwetsAC1: 0.75,
      threePassStability: 0.95,
      canaryTnr: 1.0,
    });
    assert.strictEqual(acceptedBoundary.admitted, true);

    const acceptedObserved = evaluateJudgeAdmission({
      gwetsAC1: 0.75,
      threePassStability: 0.965,
      canaryTnr: 1.0,
    });
    assert.strictEqual(acceptedObserved.admitted, true);
  });

  it('rejects judge when canary TNR < 1.0 and accepts 1.0', () => {
    const rejected99 = evaluateJudgeAdmission({
      gwetsAC1: 0.75,
      threePassStability: 0.95,
      canaryTnr: 0.99,
    });
    assert.strictEqual(rejected99.admitted, false);
    assert.ok(rejected99.reasons.some((r) => r.includes('below 100.0% bar')));

    const rejected95 = evaluateJudgeAdmission({
      gwetsAC1: 0.75,
      threePassStability: 0.95,
      canaryTnr: 0.95,
    });
    assert.strictEqual(rejected95.admitted, false);
    assert.ok(rejected95.reasons.some((r) => r.includes('below 100.0% bar')));

    const accepted100 = evaluateJudgeAdmission({
      gwetsAC1: 0.75,
      threePassStability: 0.95,
      canaryTnr: 1.0,
    });
    assert.strictEqual(accepted100.admitted, true);
  });

  it('QUALIFIED_JUDGE_METADATA reflects D-046 de-admission under O9 7-verdict calibration metrics', () => {
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.admitted, false);
    assert.strictEqual(
      QUALIFIED_JUDGE_METADATA.judgeVersion,
      'gemini-3.8-flash:detective-v6-spec22-dab7de7f',
    );
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.gwetsAC1, 0.932);
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.krippendorffAlpha, 0.727);
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.threePassStability, 0.971);
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.canaryTnr, 1.0);
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.calibrationCount, 35);
    assert.match(QUALIFIED_JUDGE_METADATA.notes, /D-046/);
    assert.match(QUALIFIED_JUDGE_METADATA.notes, /in-sample dev set/);
    assert.match(QUALIFIED_JUDGE_METADATA.notes, /D-039/);
    const evalResult = evaluateJudgeAdmission(QUALIFIED_JUDGE_METADATA);
    assert.strictEqual(evalResult.admitted, false);
    assert.ok(
      evalResult.reasons.some((r) => r.includes('Out-of-sample blind specificity test')),
    );
  });

  it('admits judge when metrics pass and out-of-sample blind test passes (D-039, D-046)', () => {
    const passed = evaluateJudgeAdmission({
      ...QUALIFIED_JUDGE_METADATA,
      isOutOfSampleBlindTestPassed: true,
    });
    assert.strictEqual(passed.admitted, true);
    assert.deepStrictEqual(passed.reasons, []);
  });
});

describe('Rule Qualification and Manifest (D-031, D-036, D-041, D-042)', () => {
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

  it('QUALIFIED_RULE_MANIFEST is empty while rules are suspended in SUSPENDED_QUALIFIED_RULE_HISTORY', () => {
    assert.strictEqual(QUALIFIED_RULE_MANIFEST.length, 0);
    const suspendedIds = SUSPENDED_QUALIFIED_RULE_HISTORY.map((r) => r.guideId);
    assert.deepStrictEqual(suspendedIds, [
      'autofill-highlight-inputs',
      'complex-shapes',
      'deliver-optimized-decorative-images',
      'individual-transform-properties',
    ]);
  });
});
