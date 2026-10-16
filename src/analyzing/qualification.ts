/**
 * Qualification and shipping configuration.
 *
 * Moving shipping qualification lists into this module decouples shipping decisions
 * from computeRuleSetHash(), ensuring rule-set hashes remain invariant when shipping
 * tiers are updated based on held-out evaluations (O64).
 */
import type { AnalyzerRule } from './schema.ts';
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
  readonly guides?: readonly GuideScorecardSummary[];
}

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
    (scorecard.judgeAlpha !== undefined && scorecard.judgeAlpha < 0.667)
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
