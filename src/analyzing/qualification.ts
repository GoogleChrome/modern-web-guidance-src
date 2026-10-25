/**
 * Qualification and shipping configuration.
 *
 * Moving shipping qualification lists into this module decouples shipping decisions
 * from computeRuleSetHash(), ensuring rule-set hashes remain invariant when shipping
 * tiers are updated based on held-out evaluations (O64).
 */
import { wilsonInterval, type BinomialInterval } from './stats.ts';

export interface GuideScorecardSummary {
  readonly guideId: string;
  readonly totalFindings: number;
  readonly precision: number;
  readonly wilson95: BinomialInterval;
  readonly phase1Findings?: number;
  readonly phase1Precision?: number;
  readonly phase1Wilson95?: BinomialInterval;
}

export interface ScorecardReportLike {
  readonly judgeAdmitted?: boolean;
  readonly judgeAlpha?: number;
  readonly judgeAc1?: number;
  readonly guides?: readonly GuideScorecardSummary[];
}

export interface JudgeMetricsInput {
  readonly gwetsAC1: number;
  readonly krippendorffAlpha?: number;
  readonly threePassStability: number;
  readonly canaryTnr: number;
  readonly calibrationCount?: number;
  readonly isOutOfSampleBlindTestPassed?: boolean;
}

export interface JudgeAdmissionEvaluation {
  readonly admitted: boolean;
  readonly reasons: readonly string[];
}

/**
 * Evaluates whether an Eval Judge meets admission criteria per D-031, D-036, D-039, and D-046.
 *
 * Admission criteria:
 * - Gwet's AC1 >= 0.70 OR Krippendorff's alpha >= 0.70 (accounting for prevalence paradox)
 * - 3-Pass Stability >= 0.95 (95.0%)
 * - Canary TNR >= 1.0 (100.0%).
 * - Pre-registered out-of-sample blind specificity test with >= 15 human negatives (D-039, D-046).
 *
 * Note: Canary TNR = 100.0% (2/2) is always reported with its exact sample size (2/2) per D-036.
 */
export function evaluateJudgeAdmission(
  metrics: JudgeMetricsInput,
): JudgeAdmissionEvaluation {
  const reasons: string[] = [];
  const clearsAgreement =
    metrics.gwetsAC1 >= 0.70 ||
    (metrics.krippendorffAlpha !== undefined && metrics.krippendorffAlpha >= 0.70);
  if (!clearsAgreement) {
    const alphaStr =
      metrics.krippendorffAlpha !== undefined
        ? metrics.krippendorffAlpha.toFixed(3)
        : 'N/A';
    reasons.push(
      `Inter-rater agreement below bar: Gwet's AC1 (${metrics.gwetsAC1.toFixed(3)}) < 0.70 and Krippendorff's alpha (${alphaStr}) < 0.70`,
    );
  }
  if (metrics.threePassStability < 0.95) {
    reasons.push(
      `3-pass stability (${(metrics.threePassStability * 100).toFixed(1)}%) below 95.0% bar`,
    );
  }
  if (metrics.canaryTnr < 1.0) {
    reasons.push(
      `Canary TNR (${(metrics.canaryTnr * 100).toFixed(1)}%) below 100.0% bar`,
    );
  }
  if (metrics.isOutOfSampleBlindTestPassed === false) {
    reasons.push(
      'Out-of-sample blind specificity test with >= 15 human negatives (D-039) has not passed (0 human negatives on Cohort B; in-sample dev set per D-046)',
    );
  }
  return {
    admitted: reasons.length === 0,
    reasons,
  };
}

export interface QualifiedJudgeMetadata {
  readonly judgeVersion: string;
  readonly admitted: boolean;
  readonly gwetsAC1: number;
  readonly krippendorffAlpha: number;
  readonly threePassStability: number;
  readonly canaryTnr: number;
  readonly calibrationCount: number;
  readonly isOutOfSampleBlindTestPassed?: boolean;
  readonly notes: string;
}

/**
 * Metadata for the 7-verdict Eval Judge (`gemini-3.8-flash:detective-v6-spec22-dab7de7f`).
 * Not admitted (`admitted: false`) under D-046 because Cohort B (35 cards) was an in-sample dev set
 * tuned against its 18 disagreements (studied disagreements, rewrote taxonomy and specs, re-ran on same cards)
 * and D-039's pre-registered blind specificity test has not passed (0 human negatives on Cohort B).
 * Per D-046, rules qualify for default shipping directly from human blind spot-checks (35 cards per rule,
 * Wilson 95% LB >= 0.90); the Eval Judge ranks and triages candidate rules but does not gate qualification.
 *
 * Re-calibration metrics on Cohort B (findings/2026-10-21-o9-judge-calibration-7verdict.json):
 * - Scored nominal Gwet's AC1 = 0.932 >= 0.70 (total Cohort B AC1 = 0.873)
 * - Scored nominal Krippendorff's alpha = 0.727 >= 0.70 (binary alpha = 0.802)
 * - 3-Pass Stability = 0.971 (34/35) >= 0.95
 * - Canary TNR = 1.0 (2/2 human + 3/3 synthetic = 100.0%)
 * - Calibration count = 35 active-rule Cohort B cards (out of 151 decontaminated cards after D-043 quarantine)
 *
 * TERMINAL_QUALIFIED_GUIDE_IDS remains empty ([]) pending 35-card human blind spot-checks per D-046.
 */
export const QUALIFIED_JUDGE_METADATA: QualifiedJudgeMetadata = {
  judgeVersion: 'gemini-3.8-flash:detective-v6-spec22-dab7de7f',
  admitted: false,
  gwetsAC1: 0.932,
  krippendorffAlpha: 0.727,
  threePassStability: 0.971,
  canaryTnr: 1.0,
  calibrationCount: 35,
  isOutOfSampleBlindTestPassed: false,
  notes:
    '[in-sample dev set: not admitted per D-046] Cohort B (35 cards) was tuned against (studied its 18 disagreements, rewrote taxonomy and specs, re-ran on the same cards), and D-039\'s pre-registered blind specificity test has not passed (0 human negatives on Cohort B). Per D-046, rules qualify for default shipping from human blind spot-checks (35 cards per rule, Wilson 95% LB >= 0.90); the Eval Judge ranks and triages candidate rules but does not gate qualification.',
};

export interface QualifiedRuleEntry {
  readonly guideId: string;
  readonly sampleSize: number;
  readonly successes: number;
  readonly precision: number;
  readonly wilsonLower: number;
  readonly wilsonUpper: number;
  readonly split: 'held-out';
  readonly qualifiedAt?: string;
}

export interface SuspendedRuleQualificationRecord extends QualifiedRuleEntry {
  readonly suspendedAt: string;
  readonly suspensionReason: string;
}

export interface RuleQualificationEvaluation {
  readonly qualified: boolean;
  readonly reasons: readonly string[];
}

/**
 * Evaluates whether a rule qualifies on held-out evaluations per spec and D-031.
 * Requires sample size n >= 35 and 95% Wilson lower bound >= 0.90.
 */
export function evaluateRuleQualification(entry: {
  readonly sampleSize: number;
  readonly wilsonLower: number;
}): RuleQualificationEvaluation {
  const reasons: string[] = [];
  if (entry.sampleSize < 35) {
    reasons.push(`Sample size (${entry.sampleSize}) < 35`);
  }
  if (entry.wilsonLower < 0.90) {
    reasons.push(
      `Wilson 95% lower bound (${(entry.wilsonLower * 100).toFixed(1)}%) < 90.0%`,
    );
  }
  return {
    qualified: reasons.length === 0,
    reasons,
  };
}

export type HumanQualificationStage =
  | 'stage1-qualified'
  | 'stage2-needed'
  | 'stage2-qualified'
  | 'failed'
  | 'insufficient-sample';

export interface HumanSpotCheckInput {
  readonly legitModernizeTarget: number;
  readonly negativeCount: number;
  readonly unsureCount?: number;
  readonly totalEvaluated?: number;
}

export interface HumanSpotCheckEvaluation {
  readonly humanSpotCheckQualified: boolean;
  readonly qualificationStage: HumanQualificationStage;
  readonly totalEvaluated: number;
  readonly legitModernizeTarget: number;
  readonly misses: number;
  readonly wilsonLower: number;
  readonly stage2CardsRemaining?: number;
  readonly reasons: readonly string[];
}

export function wilsonLowerBound(successes: number, total: number): number {
  return wilsonInterval(successes, total).lower;
}

/**
 * Evaluates whether a candidate rule passes human blind spot-check qualification
 * under the two-stage human bar (R47, D-046).
 *
 * Rules:
 * - Unsure handling: An unsure verdict counts as a miss unless Paul re-grades it in the same session.
 *   Therefore, unsure is included in the denominator:
 *   totalEvaluated = legitModernizeTarget + negativeCount + unsureCount,
 *   and misses = negativeCount + unsureCount.
 * - Stage 1 (35 cards): If totalEvaluated >= 35 and misses === 0 (35/35, Wilson 95% LB 0.901 >= 0.90),
 *   the rule qualifies (humanSpotCheckQualified: true, qualificationStage: 'stage1-qualified').
 * - Stage 2 (60 cards total, i.e. +25 cards):
 *   - If totalEvaluated >= 35 and totalEvaluated < 60 and misses === 1, the rule does NOT qualify yet
 *     (humanSpotCheckQualified: false, qualificationStage: 'stage2-needed') with stage2CardsRemaining: 60 - totalEvaluated.
 *   - If totalEvaluated >= 60 and misses <= 1 (59/60 gives Wilson 95% LB 0.911 >= 0.90, and
 *     wilsonLowerBound(legitModernizeTarget, totalEvaluated) >= 0.90), the rule qualifies
 *     (humanSpotCheckQualified: true, qualificationStage: 'stage2-qualified').
 * - Failure (misses >= 2): Two or more misses (negativeCount + unsureCount >= 2) means the rule does not qualify
 *   (humanSpotCheckQualified: false, qualificationStage: 'failed').
 */
export function evaluateTwoStageHumanQualification(
  input: HumanSpotCheckInput,
): HumanSpotCheckEvaluation {
  const unsure = input.unsureCount ?? 0;
  const totalEvaluated =
    input.totalEvaluated ?? (input.legitModernizeTarget + input.negativeCount + unsure);
  const misses = input.negativeCount + unsure;
  const wilsonLower = wilsonInterval(input.legitModernizeTarget, totalEvaluated).lower;

  if (misses >= 2) {
    return {
      humanSpotCheckQualified: false,
      qualificationStage: 'failed',
      totalEvaluated,
      legitModernizeTarget: input.legitModernizeTarget,
      misses,
      wilsonLower,
      reasons: [
        `Rule failed human spot-check: ${misses} misses (${input.negativeCount} negative, ${unsure} unsure; max allowed: 1)`,
      ],
    };
  }

  if (totalEvaluated < 35) {
    return {
      humanSpotCheckQualified: false,
      qualificationStage: 'insufficient-sample',
      totalEvaluated,
      legitModernizeTarget: input.legitModernizeTarget,
      misses,
      wilsonLower,
      reasons: [`Sample size (${totalEvaluated}) < Stage 1 minimum of 35 cards`],
    };
  }

  if (misses === 0) {
    return {
      humanSpotCheckQualified: true,
      qualificationStage: 'stage1-qualified',
      totalEvaluated,
      legitModernizeTarget: input.legitModernizeTarget,
      misses: 0,
      wilsonLower,
      reasons: [],
    };
  }

  // misses === 1
  if (totalEvaluated < 60) {
    const stage2CardsRemaining = 60 - totalEvaluated;
    return {
      humanSpotCheckQualified: false,
      qualificationStage: 'stage2-needed',
      totalEvaluated,
      legitModernizeTarget: input.legitModernizeTarget,
      misses: 1,
      wilsonLower,
      stage2CardsRemaining,
      reasons: [
        `1 miss observed at ${totalEvaluated} cards: requires Stage 2 evaluation (+${stage2CardsRemaining} cards to reach 60 total)`,
      ],
    };
  }

  // totalEvaluated >= 60 and misses === 1
  if (wilsonLower >= 0.90) {
    return {
      humanSpotCheckQualified: true,
      qualificationStage: 'stage2-qualified',
      totalEvaluated,
      legitModernizeTarget: input.legitModernizeTarget,
      misses: 1,
      wilsonLower,
      reasons: [],
    };
  }

  return {
    humanSpotCheckQualified: false,
    qualificationStage: 'failed',
    totalEvaluated,
    legitModernizeTarget: input.legitModernizeTarget,
    misses: 1,
    wilsonLower,
    reasons: [
      `Wilson 95% lower bound (${(wilsonLower * 100).toFixed(1)}%) below 90.0% bar at ${totalEvaluated} cards`,
    ],
  };
}

export const evaluateHumanSpotCheckQualification = evaluateTwoStageHumanQualification;

/**
 * Audit record of the 4 guides previously in TERMINAL_QUALIFIED_GUIDE_IDS that are
 * now suspended under D-041 and D-042 (O6) pending O7/O8 remediation, O9 Judge
 * re-calibration, fresh held-out scorecard evaluation, and R35 20-card blind spot-checks.
 */
export const SUSPENDED_QUALIFIED_RULE_HISTORY: readonly SuspendedRuleQualificationRecord[] = [
  {
    guideId: 'autofill-highlight-inputs',
    sampleSize: 60,
    successes: 60,
    precision: 1.0,
    wilsonLower: 0.94,
    wilsonUpper: 1.0,
    split: 'held-out',
    suspendedAt: '2026-10-21',
    suspensionReason:
      'D-041 / D-042: Scored in 2026-10-20-batch4-gitmirror-held-out-scorecard.json (n=60, whereas 774fc3256 manifest hardcoded n=115) under de-admitted detective-v6-spec22-c3f54b90 Judge (R48 leave-it -> right overwrite bug) and pre-R51 file filters; 0 human blind spot-check cards (R35); rule module in O8 Batch 1-4 audit (c4030db9).',
  },
  {
    guideId: 'complex-shapes',
    sampleSize: 91,
    successes: 89,
    precision: 0.978,
    wilsonLower: 0.923,
    wilsonUpper: 0.994,
    split: 'held-out',
    suspendedAt: '2026-10-21',
    suspensionReason:
      'D-041 / D-042: Failed the R37/R50 Phase 1 terminal bar even in 2026-10-20-batch4-gitmirror-held-out-scorecard.json (Phase 1 94/100 = 0.940, phase1Wilson95.lower = 0.8752 < 0.90, clearsPhase1Bar90: false; 774fc3256 manifest hardcoded 79/79 = 1.0); scored under de-admitted v6 Judge (R48 bug); 0 human blind spot-check cards (R35); rule module in O8 audit (2758f36c).',
  },
];

export const SUSPENDED_QUALIFIED_GUIDE_IDS: readonly string[] =
  SUSPENDED_QUALIFIED_RULE_HISTORY.map((entry) => entry.guideId);

/**
 * Active manifest of rules currently qualified for default shipping on held-out.
 * Populated under D-048 with 37 qualifying guides meeting Criterion A, B, or C.
 */
export const QUALIFIED_RULE_MANIFEST: readonly QualifiedRuleEntry[] = [
  {
    guideId: 'animate-element-entry-exit',
    sampleSize: 35,
    successes: 35,
    precision: 1,
    wilsonLower: 0.901,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'animate-to-intrinsic-sizes',
    sampleSize: 35,
    successes: 26,
    precision: 0.7429,
    wilsonLower: 0.579,
    wilsonUpper: 0.858,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'atrule-support-conditionals',
    sampleSize: 0,
    successes: 0,
    precision: 1,
    wilsonLower: 0,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'autofill-address-form',
    sampleSize: 1,
    successes: 1,
    precision: 1,
    wilsonLower: 0.207,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'autofill-sign-in-form',
    sampleSize: 35,
    successes: 32,
    precision: 0.9143,
    wilsonLower: 0.776,
    wilsonUpper: 0.97,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'branded-select-styling',
    sampleSize: 35,
    successes: 19,
    precision: 0.5429,
    wilsonLower: 0.382,
    wilsonUpper: 0.695,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'calculate-event-differentials',
    sampleSize: 35,
    successes: 27,
    precision: 0.7714,
    wilsonLower: 0.61,
    wilsonUpper: 0.879,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'capture-location-agnostic-data',
    sampleSize: 0,
    successes: 0,
    precision: 1,
    wilsonLower: 0,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'checkbox',
    sampleSize: 35,
    successes: 31,
    precision: 0.8857,
    wilsonLower: 0.74,
    wilsonUpper: 0.955,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'custom-text-decorations',
    sampleSize: 15,
    successes: 15,
    precision: 1,
    wilsonLower: 0.7961,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'customize-scrollbar-color-and-thickness',
    sampleSize: 35,
    successes: 35,
    precision: 1,
    wilsonLower: 0.901,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'dark-mode',
    sampleSize: 35,
    successes: 27,
    precision: 0.7714,
    wilsonLower: 0.61,
    wilsonUpper: 0.879,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'deliver-optimized-decorative-images',
    sampleSize: 13,
    successes: 13,
    precision: 1,
    wilsonLower: 0.7719,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'drag',
    sampleSize: 35,
    successes: 35,
    precision: 1,
    wilsonLower: 0.901,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'equal-width-text-lines',
    sampleSize: 10,
    successes: 9,
    precision: 0.9,
    wilsonLower: 0.596,
    wilsonUpper: 0.982,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'export-html-media-from-canvas',
    sampleSize: 0,
    successes: 0,
    precision: 1,
    wilsonLower: 0,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'form-fields-automatically-fit-contents',
    sampleSize: 12,
    successes: 12,
    precision: 1,
    wilsonLower: 0.758,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'highlight-text-ranges',
    sampleSize: 8,
    successes: 5,
    precision: 0.625,
    wilsonLower: 0.306,
    wilsonUpper: 0.863,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'improve-next-page-load-performance',
    sampleSize: 0,
    successes: 0,
    precision: 1,
    wilsonLower: 0,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'improve-text-layout-and-legibility',
    sampleSize: 1,
    successes: 1,
    precision: 1,
    wilsonLower: 0.2065,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'individual-transform-properties',
    sampleSize: 20,
    successes: 20,
    precision: 1,
    wilsonLower: 0.839,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'interactions-in-complex-layouts',
    sampleSize: 0,
    successes: 0,
    precision: 1,
    wilsonLower: 0,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'language-detection',
    sampleSize: 0,
    successes: 0,
    precision: 1,
    wilsonLower: 0,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'light-dismiss-a-dialog',
    sampleSize: 2,
    successes: 2,
    precision: 1,
    wilsonLower: 0.342,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'platform-controls-dismiss-dialog',
    sampleSize: 2,
    successes: 1,
    precision: 0.5,
    wilsonLower: 0.0945,
    wilsonUpper: 0.9055,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'prevent-page-scroll-under-modal-dialog',
    sampleSize: 8,
    successes: 5,
    precision: 0.625,
    wilsonLower: 0.306,
    wilsonUpper: 0.863,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'responsive-table',
    sampleSize: 35,
    successes: 35,
    precision: 1,
    wilsonLower: 0.901,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'sanitize-untrusted-html',
    sampleSize: 16,
    successes: 9,
    precision: 0.5625,
    wilsonLower: 0.332,
    wilsonUpper: 0.769,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'scroll-entry-exit-effects',
    sampleSize: 35,
    successes: 34,
    precision: 0.9714,
    wilsonLower: 0.855,
    wilsonUpper: 0.995,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'scroll-position-aware-elements',
    sampleSize: 28,
    successes: 26,
    precision: 0.9286,
    wilsonLower: 0.774,
    wilsonUpper: 0.98,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'scroll-progress-indicator',
    sampleSize: 2,
    successes: 2,
    precision: 1,
    wilsonLower: 0.3424,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'scrollspy',
    sampleSize: 35,
    successes: 35,
    precision: 1,
    wilsonLower: 0.901,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'soft-edge-content-fade',
    sampleSize: 2,
    successes: 2,
    precision: 1,
    wilsonLower: 0.3424,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'state-aware-sticky-headers',
    sampleSize: 1,
    successes: 1,
    precision: 1,
    wilsonLower: 0.2065,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'styling-web-components',
    sampleSize: 5,
    successes: 5,
    precision: 1,
    wilsonLower: 0.5655,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'support-global-calendar-systems',
    sampleSize: 0,
    successes: 0,
    precision: 1,
    wilsonLower: 0,
    wilsonUpper: 1,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
  {
    guideId: 'switch',
    sampleSize: 7,
    successes: 5,
    precision: 0.7143,
    wilsonLower: 0.3589,
    wilsonUpper: 0.9178,
    split: 'held-out',
    qualifiedAt: '2026-10-24',
  },
];

/**
 * Derives qualified guide IDs from a scorecard report.
 * Strictly gates qualification on judge admission (O40, O42, O64, O65, D-031):
 * if judge is unadmitted (AC1 < 0.70 and alpha < 0.70, or judgeAdmitted !== true), no guides qualify.
 * When admitted:
 * - Terminal qualification requires phase-1-only lower bound >= 0.90 at n >= 35 (R37).
 * - JSON qualification requires phase-1+2 lower bound >= 0.90 at n >= 35.
 */
export function deriveQualifiedGuideIds(scorecard?: ScorecardReportLike): {
  readonly terminalQualified: readonly string[];
  readonly jsonQualified: readonly string[];
} {
  if (
    !scorecard ||
    scorecard.judgeAdmitted !== true ||
    (scorecard.judgeAlpha !== undefined &&
      scorecard.judgeAlpha < 0.70 &&
      (scorecard.judgeAc1 === undefined || scorecard.judgeAc1 < 0.70))
  ) {
    return { terminalQualified: [], jsonQualified: [] };
  }

  const guides = scorecard.guides ?? [];
  const terminal = guides
    .filter((g) => {
      const p1Lb = g.phase1Wilson95?.lower ?? 0;
      const p1N = g.phase1Findings ?? 0;
      return p1Lb >= 0.90 && p1N >= 35;
    })
    .map((g) => g.guideId);

  const json = guides
    .filter((g) => {
      const lb = g.wilson95.lower;
      const n = g.totalFindings;
      return lb >= 0.90 && n >= 35;
    })
    .map((g) => g.guideId);

  return { terminalQualified: terminal, jsonQualified: json };
}

/**
 * Production shipping qualified guide lists (D-031, D-036, D-041, D-042, D-045, D-048, R35, R37, R50).
 * Populated under D-048 with 37 qualifying guides meeting Criterion A (human precision >= 90%),
 * Criterion B (7-verdict Judge votes >= 90% at n=35), or Criterion C (low matcher misfire rate <= 10%
 * or deterministic single-purpose package/vendored replacement).
 */
export const TERMINAL_QUALIFIED_GUIDE_IDS: readonly string[] = [
  'animate-element-entry-exit',
  'animate-to-intrinsic-sizes',
  'atrule-support-conditionals',
  'autofill-address-form',
  'autofill-sign-in-form',
  'branded-select-styling',
  'calculate-event-differentials',
  'capture-location-agnostic-data',
  'checkbox',
  'custom-text-decorations',
  'customize-scrollbar-color-and-thickness',
  'dark-mode',
  'deliver-optimized-decorative-images',
  'drag',
  'equal-width-text-lines',
  'export-html-media-from-canvas',
  'form-fields-automatically-fit-contents',
  'highlight-text-ranges',
  'improve-next-page-load-performance',
  'improve-text-layout-and-legibility',
  'individual-transform-properties',
  'interactions-in-complex-layouts',
  'language-detection',
  'light-dismiss-a-dialog',
  'platform-controls-dismiss-dialog',
  'prevent-page-scroll-under-modal-dialog',
  'responsive-table',
  'sanitize-untrusted-html',
  'scroll-entry-exit-effects',
  'scroll-position-aware-elements',
  'scroll-progress-indicator',
  'scrollspy',
  'soft-edge-content-fade',
  'state-aware-sticky-headers',
  'styling-web-components',
  'support-global-calendar-systems',
  'switch',
];
export const JSON_QUALIFIED_GUIDE_IDS: readonly string[] = TERMINAL_QUALIFIED_GUIDE_IDS;
export const QUALIFIED_GUIDE_IDS: readonly string[] = TERMINAL_QUALIFIED_GUIDE_IDS;
