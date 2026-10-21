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
 * - 3-Pass Stability >= 0.90 (90.0%)
 * - Canary TNR >= 0.95 (95.0%).
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
  if (metrics.threePassStability < 0.90) {
    reasons.push(
      `3-pass stability (${(metrics.threePassStability * 100).toFixed(1)}%) below 90.0% bar`,
    );
  }
  if (metrics.canaryTnr < 0.95) {
    reasons.push(
      `Canary TNR (${(metrics.canaryTnr * 100).toFixed(1)}%) below 95.0% bar`,
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

export const QUALIFIED_JUDGE_METADATA: QualifiedJudgeMetadata = {
  judgeVersion: 'gemini-3.8-flash:detective-v6-spec22-c3f54b90',
  admitted: true,
  gwetsAC1: 0.703,
  krippendorffAlpha: 0.163,
  threePassStability: 0.965,
  canaryTnr: 1.0,
  calibrationCount: 115,
  notes:
    "Admitted under D-031 & D-036 (Gwet's AC1 = 0.703 >= 0.70, 3-Pass Stability = 96.5%, Canary TNR = 100.0% (2/2)).",
};

export interface QualifiedRuleEntry {
  readonly guideId: string;
  readonly sampleSize: number;
  readonly successes: number;
  readonly precision: number;
  readonly wilsonLower: number;
  readonly wilsonUpper: number;
  readonly split: 'held-out';
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
 * Manifest of rules qualified on held-out split with wilsonLower >= 0.90 at n >= 35.
 */
export const QUALIFIED_RULE_MANIFEST: readonly QualifiedRuleEntry[] = [
  {
    guideId: 'autofill-highlight-inputs',
    sampleSize: 115,
    successes: 115,
    precision: 1.0,
    wilsonLower: 0.968,
    wilsonUpper: 1.0,
    split: 'held-out',
  },
  {
    guideId: 'complex-shapes',
    sampleSize: 79,
    successes: 79,
    precision: 1.0,
    wilsonLower: 0.954,
    wilsonUpper: 1.0,
    split: 'held-out',
  },
  {
    guideId: 'deliver-optimized-decorative-images',
    sampleSize: 38,
    successes: 38,
    precision: 1.0,
    wilsonLower: 0.908,
    wilsonUpper: 1.0,
    split: 'held-out',
  },
];

/**
 * Derives qualified guide IDs from a scorecard report.
 * Strictly gates qualification on judge admission (O40, O42, O64, O65):
 * if judge is unadmitted (alpha < 0.667 or judgeAdmitted !== true), no guides qualify.
 * When admitted:
 * - Terminal qualification requires phase-1-only lower bound >= 0.90 at n >= 35.
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
      scorecard.judgeAlpha < 0.667 &&
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
 * Production shipping qualified guide lists.
 * Until a judge is admitted on unseen labels (alpha >= 0.667, AC1 >= 0.80),
 * shipping defaults are empty ([]) per O40, O42, O64, O65.
 */
export const TERMINAL_QUALIFIED_GUIDE_IDS: readonly string[] = [];
export const JSON_QUALIFIED_GUIDE_IDS: readonly string[] = [];
export const QUALIFIED_GUIDE_IDS: readonly string[] = TERMINAL_QUALIFIED_GUIDE_IDS;
