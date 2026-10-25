/**
 * Qualification and shipping configuration.
 *
 * Moving shipping qualification lists into this module decouples shipping decisions
 * from computeRuleSetHash(), ensuring rule-set hashes remain invariant when shipping
 * tiers are updated based on held-out evaluations (O64).
 */

/**
 * Authoritative three-tier qualification classification for shipping analyzer rules (D-048).
 * - `'A'`: Human-verified precision >= 90% on blind held-out spot-checks or blind side-by-side replication decks (R35, R43/R49).
 * - `'B'`: Detection Eval Judge consensus >= 90% legit-modernize-target votes at n >= 35 (<= 2 cards per repo per D-047) on held-out split.
 * - `'C'`: Low matcher misfire rate (not-old-pattern / n) <= 10% (and <= 3 misfires) on held-out samples with >= 1 legit finding, or deterministic single-purpose package/vendored replacement.
 */
export type QualificationTier = 'A' | 'B' | 'C';


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

/**
 * List of candidate guides temporarily suspended from default shipping qualification pending human spot-checks or rule audit remediations.
 */
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
 * Production shipping qualified guide list representing default terminal shipped guides (D-031, D-036, D-041, D-042, D-045, D-048, R35, R37, R50).
 * Populated under D-048 with qualifying guides meeting Criterion A (human precision >= 90%),
 * Criterion B (Detection Eval Judge votes >= 90% at n=35), or Criterion C (low matcher misfire rate <= 10%
 * or deterministic single-purpose package/vendored replacement).
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
