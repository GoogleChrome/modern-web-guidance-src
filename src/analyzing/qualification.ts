/**
 * Authoritative qualification and shipping lists for analyzer rules.
 * Derived from the canonical RULE_REGISTRY in rules/index.ts.
 *
 * Rules qualify for default terminal shipping under the Static Matcher precision standard:
 * - Static Matcher precision >= 90.0% at n >= 20 findings on held-out evaluation (precision before LLM Verifier).
 * When `gd analyze` runs in a terminal without an LLM, >= 90% of findings are legit (as scored by an LLM judge, not human-graded).
 */

export {
  QUALIFIED_GUIDE_IDS,
  SUSPENDED_QUALIFIED_GUIDE_IDS,
  POST_SELECTION_TUNED_GUIDE_IDS,
} from './rules/index.ts';

import { QUALIFIED_GUIDE_IDS } from './rules/index.ts';

/**
 * Checks whether a guide is qualified for default shipping.
 */
export function isGuideQualified(guideId: string): boolean {
  return QUALIFIED_GUIDE_IDS.includes(guideId);
}
