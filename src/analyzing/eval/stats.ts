import { createHash } from 'node:crypto';

export const CARD_ID_HEX_LENGTH = 12;
export const Z_95 = 1.96;
export const Z_SEQUENTIAL_STOPPING = 2.39;

export const MIN_SEQUENTIAL_GRADES = 15;
export const MAX_SEQUENTIAL_GRADES = 60;

export interface BinomialInterval {
  proportion: number;
  lower: number;
  upper: number;
  n: number;
}

export type SequentialStopDecision = 'pass' | 'fail' | 'continue';

export interface SensitivitySpecificityResult {
  tpr: number;
  tnr: number;
  positives: number;
  negatives: number;
}

export { computeCardId } from '../scanners/index.ts';

/**
 * Calculates the Wilson score interval for a binomial proportion.
 * Defaults to 95% confidence interval (z = 1.96).
 */
export function wilsonInterval(
  successes: number,
  total: number,
  z: number = Z_95,
): BinomialInterval {
  if (total <= 0) {
    return { proportion: 0, lower: 0, upper: 0, n: 0 };
  }

  const p = Math.max(0, Math.min(1, successes / total));
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const varianceTerm = (p * (1 - p)) / total + z2 / (4 * total * total);
  const margin = (z * Math.sqrt(Math.max(0, varianceTerm))) / denominator;

  const lower = Math.max(0, center - margin);
  const upper = Math.min(1, center + margin);

  return {
    proportion: p,
    lower,
    upper,
    n: total,
  };
}

/**
 * Evaluates sequential stopping boundaries at 15, 30, and 60 grades
 * using Z_SEQUENTIAL_STOPPING (2.39) per Spec §3.
 *
 * Rules:
 * - If total < 15: not at minimum checkpoint, continue.
 * - If Wilson lower bound >= targetLowerBound: pass.
 * - If Wilson upper bound < targetLowerBound: early fail.
 * - If total >= 60: terminal checkpoint, pass if lower >= target else fail.
 * - Otherwise: continue grading.
 */
export function checkSequentialStop(
  successes: number,
  total: number,
  targetLowerBound: number,
  maxGrades: number = MAX_SEQUENTIAL_GRADES,
): SequentialStopDecision {
  if (total < MIN_SEQUENTIAL_GRADES) {
    return 'continue';
  }

  const { lower, upper } = wilsonInterval(successes, total, Z_SEQUENTIAL_STOPPING);

  if (lower >= targetLowerBound) {
    return 'pass';
  }

  if (upper < targetLowerBound) {
    return 'fail';
  }

  if (total >= maxGrades) {
    return 'fail';
  }

  return 'continue';
}

/**
 * Computes Krippendorff's alpha for nominal data over paired ratings.
 * Each item in `pairs` represents two raters' categorical labels for a single unit.
 */
export function krippendorffAlphaNominal(
  pairs: ReadonlyArray<readonly [string, string]>,
): number {
  const nUnits = pairs.length;
  if (nUnits === 0) {
    return 1;
  }
  if (nUnits === 1) {
    return pairs[0][0] === pairs[0][1] ? 1 : 0;
  }

  let discordantUnits = 0;
  const categoryCounts = new Map<string, number>();

  for (const [r1, r2] of pairs) {
    if (r1 !== r2) {
      discordantUnits++;
    }
    categoryCounts.set(r1, (categoryCounts.get(r1) ?? 0) + 1);
    categoryCounts.set(r2, (categoryCounts.get(r2) ?? 0) + 1);
  }

  const observedDisagreement = discordantUnits / nUnits;

  const totalValues = 2 * nUnits;
  let sumSquaredCounts = 0;
  for (const count of categoryCounts.values()) {
    sumSquaredCounts += count * count;
  }

  const expectedDisagreement =
    (totalValues * totalValues - sumSquaredCounts) /
    (totalValues * (totalValues - 1));

  if (expectedDisagreement === 0) {
    return observedDisagreement === 0 ? 1 : 0;
  }

  return 1 - observedDisagreement / expectedDisagreement;
}

/**
 * Computes Gwet's AC1 statistic for nominal paired ratings.
 * Unlike Cohen's kappa and Krippendorff's alpha, Gwet's AC1 resists
 * the Prevalence Paradox when one class dominates the marginals.
 */
export function gwetAc1Nominal(
  pairs: ReadonlyArray<readonly [string, string]>,
): number {
  const nUnits = pairs.length;
  if (nUnits === 0) {
    return 1;
  }

  let agreementCount = 0;
  const categoryCounts = new Map<string, number>();

  for (const [r1, r2] of pairs) {
    if (r1 === r2) {
      agreementCount++;
    }
    categoryCounts.set(r1, (categoryCounts.get(r1) ?? 0) + 1);
    categoryCounts.set(r2, (categoryCounts.get(r2) ?? 0) + 1);
  }

  const observedAgreement = agreementCount / nUnits;
  const numCategories = categoryCounts.size;

  if (numCategories <= 1) {
    return 1;
  }

  const totalValues = 2 * nUnits;
  let sumSquaredProps = 0;
  for (const count of categoryCounts.values()) {
    const prop = count / totalValues;
    sumSquaredProps += prop * prop;
  }

  const expectedChanceAgreement = (1 - sumSquaredProps) / (numCategories - 1);

  if (expectedChanceAgreement >= 1) {
    return observedAgreement;
  }

  return (observedAgreement - expectedChanceAgreement) / (1 - expectedChanceAgreement);
}

/**
 * Computes sensitivity (TPR) and specificity (TNR) between human reference labels
 * and judge predictions.
 */
export function sensitivitySpecificity(
  pairs: ReadonlyArray<{ humanRight: boolean; judgeRight: boolean }>,
): SensitivitySpecificityResult {
  let positives = 0;
  let negatives = 0;
  let truePositives = 0;
  let trueNegatives = 0;

  for (const { humanRight, judgeRight } of pairs) {
    if (humanRight) {
      positives++;
      if (judgeRight) {
        truePositives++;
      }
    } else {
      negatives++;
      if (!judgeRight) {
        trueNegatives++;
      }
    }
  }

  const tpr = positives > 0 ? truePositives / positives : 1;
  const tnr = negatives > 0 ? trueNegatives / negatives : 1;

  return {
    tpr,
    tnr,
    positives,
    negatives,
  };
}
