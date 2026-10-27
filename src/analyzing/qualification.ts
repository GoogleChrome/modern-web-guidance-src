/**
 * Authoritative qualification and shipping lists for analyzer rules.
 * Derived from the canonical RULE_REGISTRY in rules/index.ts.
 *
 * Rules qualify for default terminal shipping when scored on held-out findings by the multi-judge panel:
 * - Static Matcher Precision >= 80.0% and Post-Rubric Precision >= 90.0% at n >= 10 findings
 *   (or Static Matcher Precision >= 90.0% at n >= 5 for rare patterns).
 */

export {
  QUALIFIED_GUIDE_IDS,
  SUSPENDED_QUALIFIED_GUIDE_IDS,
} from './rules/index.ts';

import { QUALIFIED_GUIDE_IDS } from './rules/index.ts';

/**
 * Checks whether a guide is qualified for default shipping.
 */
export function isGuideQualified(guideId: string): boolean {
  return QUALIFIED_GUIDE_IDS.includes(guideId);
}
