/**
 * Qualification and shipping configuration.
 *
 * Moving shipping qualification lists into this module decouples shipping decisions
 * from computeRuleSetHash(), ensuring rule-set hashes remain invariant when shipping
 * tiers are updated based on held-out evaluations (O64).
 */
import type { BinomialInterval } from './stats.ts';

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
}

export interface JudgeAdmissionEvaluation {
  readonly admitted: boolean;
  readonly reasons: readonly string[];
}

/**
 * Evaluates whether an Eval Judge meets admission criteria per D-031 and D-036.
 *
 * Admission criteria:
 * - Gwet's AC1 >= 0.70 OR Krippendorff's alpha >= 0.70 (accounting for prevalence paradox)
 * - 3-Pass Stability >= 0.95 (95.0%)
 * - Canary TNR >= 1.0 (100.0%).
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
  readonly notes: string;
}

/**
 * Metadata for the previously calibrated Eval Judge (`detective-v6-spec22-c3f54b90`).
 * De-admitted (`admitted: false`) under D-041 and D-042 (O6) because:
 * 1. Judge code and prompts changed in 29b403d05 and 7c6f1a18b (`detective-v7-r45`).
 * 2. Out-of-sample R34 blind check (`_false-positives-check-deck`) failed (AC1 = 0.258 < 0.70, 3-pass stability = 85.0% < 95.0%).
 * 3. R48 showed `deriveJudgeVerdictFromFacts` in v6 forcibly overwrote `leave-it` and `guide-wrong` to `right`, inflating precision.
 */
export const QUALIFIED_JUDGE_METADATA: QualifiedJudgeMetadata = {
  judgeVersion: 'gemini-3.8-flash:detective-v6-spec22-c3f54b90',
  admitted: false,
  gwetsAC1: 0.703,
  krippendorffAlpha: 0.163,
  threePassStability: 0.965,
  canaryTnr: 1.0,
  calibrationCount: 115,
  notes:
    'De-admitted under D-041 & D-042 (O6): superseded by 29b403d05 / 7c6f1a18b, failed R34 blind specificity check (AC1 = 0.258 < 0.70, stability = 85.0% < 95.0%), and contained the R48 deriveJudgeVerdictFromFacts bug that overwrote leave-it/guide-wrong to right. Historical in-sample D-031/D-036 metrics retained for provenance (Canary TNR = 100.0% (2/2)).',
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
  {
    guideId: 'deliver-optimized-decorative-images',
    sampleSize: 60,
    successes: 60,
    precision: 1.0,
    wilsonLower: 0.94,
    wilsonUpper: 1.0,
    split: 'held-out',
    suspendedAt: '2026-10-21',
    suspensionReason:
      'D-041 / D-042: Scored in 2026-10-20-batch4-gitmirror-held-out-scorecard.json (n=60, whereas 774fc3256 manifest hardcoded n=38) under de-admitted detective-v6-spec22-c3f54b90 Judge (R48 leave-it -> right overwrite bug) and pre-R51 file filters; 0 human blind spot-check cards (R35); matcher targets CSS content property overlapping R49.4 content: image-set(...) sizing defect; rule module in O8 audit (2758f36c).',
  },
  {
    guideId: 'individual-transform-properties',
    sampleSize: 95,
    successes: 94,
    precision: 0.9895,
    wilsonLower: 0.943,
    wilsonUpper: 0.998,
    split: 'held-out',
    qualifiedAt: '2026-10-20',
    suspendedAt: '2026-10-21',
    suspensionReason:
      'D-041 / D-042 / R39 / R50.2: Independent replication (R39) showed 13/20 (65%) of _itp-held-out-spotcheck-deck cards were isolated single-function state transforms (:hover { transform: scale(1.1) }) graded before R45 promoted leave-it to a top-level button; matcher was rewritten in 4acd735d6 and has not been re-evaluated on held-out.',
  },
];

export const SUSPENDED_QUALIFIED_GUIDE_IDS: readonly string[] =
  SUSPENDED_QUALIFIED_RULE_HISTORY.map((entry) => entry.guideId);

/**
 * Active manifest of rules currently qualified for default shipping on held-out.
 * Empty (`[]`) while `QUALIFIED_JUDGE_METADATA.admitted === false` and all 4 prior
 * guides are suspended pending D-041 / D-042 re-validation.
 */
export const QUALIFIED_RULE_MANIFEST: readonly QualifiedRuleEntry[] = [];

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
 * Production shipping qualified guide lists (D-031, D-036, D-041, D-042, R35, R37, R50).
 * Empty (`[]`) while the Eval Judge is de-admitted and all 4 previously qualified guides
 * are suspended pending O7/O8 remediation, O9 Judge re-calibration, held-out Phase 1
 * Wilson 95% lower bound >= 0.90 at n >= 35 (R37/R50), and 20-card blind human spot-checks (R35).
 */
export const TERMINAL_QUALIFIED_GUIDE_IDS: readonly string[] = [];
export const JSON_QUALIFIED_GUIDE_IDS: readonly string[] = TERMINAL_QUALIFIED_GUIDE_IDS;
export const QUALIFIED_GUIDE_IDS: readonly string[] = TERMINAL_QUALIFIED_GUIDE_IDS;
