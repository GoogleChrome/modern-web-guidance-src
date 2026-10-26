/**
 * Authoritative qualification and shipping lists for analyzer rules.
 *
 * Rules qualify for default terminal shipping under the Static Matcher precision standard:
 * - Static Matcher precision >= 90.0% at n >= 20 findings on held-out GitMirror (precision before LLM Verifier).
 * When `gd analyze` runs in a terminal without an LLM, >= 90% of findings are legit.
 */

/**
 * Candidate guides temporarily suspended from default shipping qualification pending human spot-checks.
 */
export const SUSPENDED_QUALIFIED_GUIDE_IDS: readonly string[] = [
  'autofill-highlight-inputs',
  'complex-shapes',
  'interactions-in-complex-layouts',
  'language-detection',
];

/**
 * Production shipping qualified guide list representing default terminal shipped guides.
 * Contains the 6 guides currently meeting Static Matcher precision >= 90.0% at n >= 20
 * on held-out GitMirror evaluation.
 */
export const QUALIFIED_GUIDE_IDS: readonly string[] = [
  'autofill-address-form',
  'autofill-sign-in-form',
  'form-fields-automatically-fit-contents',
  'responsive-table',
  'scroll-entry-exit-effects',
  'scrollspy',
];

/**
 * Checks whether a guide is qualified for default shipping.
 */
export function isGuideQualified(guideId: string): boolean {
  return QUALIFIED_GUIDE_IDS.includes(guideId);
}
