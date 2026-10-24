import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveQualifiedGuideIds,
  evaluateHumanSpotCheckQualification,
  evaluateJudgeAdmission,
  evaluateRuleQualification,
  evaluateTwoStageHumanQualification,
  JSON_QUALIFIED_GUIDE_IDS,
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_JUDGE_METADATA,
  QUALIFIED_RULE_MANIFEST,
  SUSPENDED_QUALIFIED_GUIDE_IDS,
  SUSPENDED_QUALIFIED_RULE_HISTORY,
  TERMINAL_QUALIFIED_GUIDE_IDS,
  wilsonLowerBound,
} from './qualification.ts';

describe('qualification shipping lists (O40, O42, O64, O65, O6, D-041, D-042, D-045, D-046, D-048)', () => {
  it('maintains 26 default shipping guides under D-048 graduation criteria', () => {
    assert.strictEqual(QUALIFIED_JUDGE_METADATA.admitted, false);
    assert.strictEqual(evaluateJudgeAdmission(QUALIFIED_JUDGE_METADATA).admitted, false);
    assert.strictEqual(TERMINAL_QUALIFIED_GUIDE_IDS.length, 26);
    assert.strictEqual(JSON_QUALIFIED_GUIDE_IDS.length, 26);
    assert.strictEqual(QUALIFIED_GUIDE_IDS.length, 26);
    assert.strictEqual(QUALIFIED_RULE_MANIFEST.length, 26);
    assert.deepStrictEqual(TERMINAL_QUALIFIED_GUIDE_IDS, [
      'animate-element-entry-exit',
      'animate-to-intrinsic-sizes',
      'atrule-support-conditionals',
      'autofill-address-form',
      'autofill-sign-in-form',
      'branded-select-styling',
      'calculate-event-differentials',
      'capture-location-agnostic-data',
      'checkbox',
      'customize-scrollbar-color-and-thickness',
      'dark-mode',
      'drag',
      'equal-width-text-lines',
      'form-fields-automatically-fit-contents',
      'highlight-text-ranges',
      'improve-next-page-load-performance',
      'individual-transform-properties',
      'language-detection',
      'light-dismiss-a-dialog',
      'prevent-page-scroll-under-modal-dialog',
      'responsive-table',
      'sanitize-untrusted-html',
      'scroll-entry-exit-effects',
      'scroll-position-aware-elements',
      'scrollspy',
      'support-global-calendar-systems',
    ]);
  });

  it('records per-guide suspension provenance for the 3 remaining suspended guides (D-041, D-042, D-048)', () => {
    assert.deepStrictEqual(SUSPENDED_QUALIFIED_GUIDE_IDS, [
      'autofill-highlight-inputs',
      'complex-shapes',
      'deliver-optimized-decorative-images',
    ]);
    assert.strictEqual(SUSPENDED_QUALIFIED_RULE_HISTORY.length, 3);
    for (const entry of SUSPENDED_QUALIFIED_RULE_HISTORY) {
      assert.strictEqual(entry.split, 'held-out');
      assert.ok(entry.suspendedAt.length > 0);
      assert.match(entry.suspensionReason, /D-041/);
      assert.match(entry.suspensionReason, /D-042/);
    }
  });

  it('guarantees shipping lists cannot include ungraduated or suspended guides (O64, D-048)', async () => {
    // Ungraduated/suspended guides must NOT be in shipping qualification lists
    const nonGraduated = [
      'autofill-highlight-inputs',
      'complex-shapes',
      'deliver-optimized-decorative-images',
      'coordinate-global-events',
      'break-up-long-tasks',
      'detect-initial-visibility-state',
      'defer-work-until-scroll-ends',
      'ime-safe-enter-submit',
      'child-state-based-styling',
      'declarative-dialog-popover-control',
      'size-aware-styling',
      'resolution-optimized-pseudo-elements',
    ];
    for (const gid of nonGraduated) {
      assert.strictEqual(
        TERMINAL_QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Non-graduated guide "${gid}" must NOT be in TERMINAL_QUALIFIED_GUIDE_IDS`,
      );
      assert.strictEqual(
        JSON_QUALIFIED_GUIDE_IDS.includes(gid),
        false,
        `Non-graduated guide "${gid}" must NOT be in JSON_QUALIFIED_GUIDE_IDS`,
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

  it('QUALIFIED_RULE_MANIFEST contains the 26 graduated guides while 3 remain suspended (D-048)', () => {
    assert.strictEqual(QUALIFIED_RULE_MANIFEST.length, 26);
    const suspendedIds = SUSPENDED_QUALIFIED_RULE_HISTORY.map((r) => r.guideId);
    assert.deepStrictEqual(suspendedIds, [
      'autofill-highlight-inputs',
      'complex-shapes',
      'deliver-optimized-decorative-images',
    ]);
  });
});

describe('R47 Two-Stage Human Qualification Bar (D-046)', () => {
  it('qualifies at Stage 1 when all 35 cards are legit (35/35, 0 misses)', () => {
    const result = evaluateTwoStageHumanQualification({
      legitModernizeTarget: 35,
      negativeCount: 0,
      unsureCount: 0,
    });
    assert.strictEqual(result.humanSpotCheckQualified, true);
    assert.strictEqual(result.qualificationStage, 'stage1-qualified');
    assert.strictEqual(result.totalEvaluated, 35);
    assert.strictEqual(result.misses, 0);
    assert.ok(result.wilsonLower >= 0.90, `Wilson LB ${result.wilsonLower} must be >= 0.90`);
    assert.strictEqual(Number(result.wilsonLower.toFixed(3)), 0.901);
    assert.deepStrictEqual(result.reasons, []);

    // Alias verification
    const aliasResult = evaluateHumanSpotCheckQualification({
      legitModernizeTarget: 35,
      negativeCount: 0,
    });
    assert.strictEqual(aliasResult.humanSpotCheckQualified, true);
    assert.strictEqual(aliasResult.qualificationStage, 'stage1-qualified');
  });

  it('requires Stage 2 (+25 cards) when 1 negative is observed at 35 cards (34/35)', () => {
    const result = evaluateTwoStageHumanQualification({
      legitModernizeTarget: 34,
      negativeCount: 1,
      unsureCount: 0,
    });
    assert.strictEqual(result.humanSpotCheckQualified, false);
    assert.strictEqual(result.qualificationStage, 'stage2-needed');
    assert.strictEqual(result.totalEvaluated, 35);
    assert.strictEqual(result.misses, 1);
    assert.strictEqual(result.stage2CardsRemaining, 25);
    assert.ok(result.reasons.some((r) => r.includes('+25 cards to reach 60 total')));
  });

  it('counts unsure as 1 miss and requires Stage 2 when 1 unsure occurs at 35 cards (34/35)', () => {
    const result = evaluateTwoStageHumanQualification({
      legitModernizeTarget: 34,
      negativeCount: 0,
      unsureCount: 1,
    });
    assert.strictEqual(result.humanSpotCheckQualified, false);
    assert.strictEqual(result.qualificationStage, 'stage2-needed');
    assert.strictEqual(result.totalEvaluated, 35);
    assert.strictEqual(result.misses, 1);
    assert.strictEqual(result.stage2CardsRemaining, 25);
    assert.ok(result.reasons.some((r) => r.includes('+25 cards to reach 60 total')));
  });

  it('qualifies at Stage 2 when 59/60 cards are legit (misses <= 1)', () => {
    const resultWithNegative = evaluateTwoStageHumanQualification({
      legitModernizeTarget: 59,
      negativeCount: 1,
      unsureCount: 0,
    });
    assert.strictEqual(resultWithNegative.humanSpotCheckQualified, true);
    assert.strictEqual(resultWithNegative.qualificationStage, 'stage2-qualified');
    assert.strictEqual(resultWithNegative.totalEvaluated, 60);
    assert.strictEqual(resultWithNegative.misses, 1);
    assert.ok(
      resultWithNegative.wilsonLower >= 0.90,
      `Wilson LB ${resultWithNegative.wilsonLower} must be >= 0.90`,
    );
    assert.strictEqual(Number(resultWithNegative.wilsonLower.toFixed(3)), 0.911);
    assert.deepStrictEqual(resultWithNegative.reasons, []);

    const resultWithUnsure = evaluateTwoStageHumanQualification({
      legitModernizeTarget: 59,
      negativeCount: 0,
      unsureCount: 1,
    });
    assert.strictEqual(resultWithUnsure.humanSpotCheckQualified, true);
    assert.strictEqual(resultWithUnsure.qualificationStage, 'stage2-qualified');
  });

  it('fails qualification when 2 or more misses occur (33/35, 58/60)', () => {
    const failed35 = evaluateTwoStageHumanQualification({
      legitModernizeTarget: 33,
      negativeCount: 2,
      unsureCount: 0,
    });
    assert.strictEqual(failed35.humanSpotCheckQualified, false);
    assert.strictEqual(failed35.qualificationStage, 'failed');
    assert.strictEqual(failed35.misses, 2);
    assert.ok(failed35.reasons.some((r) => r.includes('2 misses')));

    const failed35WithUnsure = evaluateTwoStageHumanQualification({
      legitModernizeTarget: 33,
      negativeCount: 1,
      unsureCount: 1,
    });
    assert.strictEqual(failed35WithUnsure.humanSpotCheckQualified, false);
    assert.strictEqual(failed35WithUnsure.qualificationStage, 'failed');
    assert.strictEqual(failed35WithUnsure.misses, 2);

    const failed60 = evaluateTwoStageHumanQualification({
      legitModernizeTarget: 58,
      negativeCount: 2,
      unsureCount: 0,
    });
    assert.strictEqual(failed60.humanSpotCheckQualified, false);
    assert.strictEqual(failed60.qualificationStage, 'failed');
    assert.strictEqual(failed60.misses, 2);
  });

  it('rejects qualification when evaluated sample size is under 35', () => {
    const insufficient = evaluateTwoStageHumanQualification({
      legitModernizeTarget: 20,
      negativeCount: 0,
      unsureCount: 0,
    });
    assert.strictEqual(insufficient.humanSpotCheckQualified, false);
    assert.strictEqual(insufficient.qualificationStage, 'insufficient-sample');
    assert.strictEqual(insufficient.totalEvaluated, 20);
    assert.ok(insufficient.reasons.some((r) => r.includes('< Stage 1 minimum of 35 cards')));
  });

  it('wilsonLowerBound helper computes expected lower bound', () => {
    assert.strictEqual(Number(wilsonLowerBound(35, 35).toFixed(3)), 0.901);
    assert.strictEqual(Number(wilsonLowerBound(59, 60).toFixed(3)), 0.911);
  });
});
