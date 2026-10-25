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
];

/**
 * Production shipping qualified guide list representing default terminal shipped guides (D-048).
 * Contains the 37 guides currently active for default terminal shipping.
 */
export const QUALIFIED_GUIDE_IDS: readonly string[] = [
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

/**
 * Checks whether a guide is qualified for default shipping.
 */
export function isGuideQualified(guideId: string): boolean {
  return QUALIFIED_GUIDE_IDS.includes(guideId);
}
