/**
 * Authoritative qualification and shipping lists for analyzer rules.
 *
 * Rules qualify for default terminal shipping under D-048 criteria:
 * - Criterion A: Human precision >= 90% on held-out spot-checks.
 * - Criterion B: Detection Eval Judge consensus >= 90% at n >= 35.
 * - Criterion C: Low matcher misfire rate <= 10% or deterministic package/vendored replacement.
 */

export type QualificationTier = 'A' | 'B' | 'C';

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
 * Production shipping qualified guide list representing default terminal shipped guides (D-048).
 * Contains the 15 guides currently active for default terminal shipping based on post-expansion held-out evaluation.
 */
export const QUALIFIED_GUIDE_IDS: readonly string[] = [
  'autofill-address-form',
  'autofill-payment-form',
  'autofill-sign-in-form',
  'branded-select-styling',
  'checkbox',
  'custom-text-decorations',
  'equal-width-text-lines',
  'form-fields-automatically-fit-contents',
  'ime-safe-enter-submit',
  'prevent-page-scroll-under-modal-dialog',
  'responsive-table',
  'scroll-entry-exit-effects',
  'scrollspy',
  'select-menu-interaction',
  'styling-web-components',
];

/**
 * Checks whether a guide is qualified for default shipping.
 */
export function isGuideQualified(guideId: string): boolean {
  return QUALIFIED_GUIDE_IDS.includes(guideId);
}
