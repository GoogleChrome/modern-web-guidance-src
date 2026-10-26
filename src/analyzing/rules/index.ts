import type { AnalyzerRule } from '../schema.ts';

import { anchorPositioningTabUnderlineRules } from './anchor-positioning-tab-underline.ts';
import { animateElementEntryExitRules } from './animate-element-entry-exit.ts';
import { animateToFromTopLayerRules } from './animate-to-from-top-layer.ts';
import { animateToIntrinsicSizesRules } from './animate-to-intrinsic-sizes.ts';
import { atruleSupportConditionalsRules } from './atrule-support-conditionals.ts';
import { autofillAddressFormRules } from './autofill-address-form.ts';
import { autofillPaymentFormRules } from './autofill-payment-form.ts';
import { autofillSignInFormRules } from './autofill-sign-in-form.ts';
import { autofillSignUpFormRules } from './autofill-sign-up-form.ts';
import { batchAnalyticsEventsRules } from './batch-analytics-events.ts';
import { brandedSelectStylingRules } from './branded-select-styling.ts';
import { breakUpLongTasksRules } from './break-up-long-tasks.ts';
import { calculateEventDifferentialsRules } from './calculate-event-differentials.ts';
import { captureLocationAgnosticDataRules } from './capture-location-agnostic-data.ts';
import { checkboxRules } from './checkbox.ts';
import { childStateBasedStylingRules } from './child-state-based-styling.ts';
import { complexShapesRules } from './complex-shapes.ts';
import { conditionalAsyncDependenciesRules } from './conditional-async-dependencies.ts';
import { contrastColorRules } from './contrast-color.ts';
import { coordinateGlobalEventsRules } from './coordinate-global-events.ts';
import { customButtonActionsRules } from './custom-button-actions.ts';
import { customSelectPickerLayoutsRules } from './custom-select-picker-layouts.ts';
import { customTextDecorationsRules } from './custom-text-decorations.ts';
import { customizeScrollbarColorAndThicknessRules } from './customize-scrollbar-color-and-thickness.ts';
import { darkModeRules } from './dark-mode.ts';
import { declarativeDialogPopoverControlRules } from './declarative-dialog-popover-control.ts';
import { deferWorkUntilScrollEndsRules } from './defer-work-until-scroll-ends.ts';
import { deliverOptimizedDecorativeImagesRules } from './deliver-optimized-decorative-images.ts';
import { detectInitialVisibilityStateRules } from './detect-initial-visibility-state.ts';
import { dragRules } from './drag.ts';
import { equalWidthTextLinesRules } from './equal-width-text-lines.ts';
import { exportHtmlMediaFromCanvasRules } from './export-html-media-from-canvas.ts';
import { formFieldsAutomaticallyFitContentsRules } from './form-fields-automatically-fit-contents.ts';
import { highlightTextRangesRules } from './highlight-text-ranges.ts';
import { imeSafeEnterSubmitRules } from './ime-safe-enter-submit.ts';
import { improveNextPageLoadPerformanceRules } from './improve-next-page-load-performance.ts';
import { improveTextLayoutAndLegibilityRules } from './improve-text-layout-and-legibility.ts';
import { individualTransformPropertiesRules } from './individual-transform-properties.ts';
import { interactionsInComplexLayoutsRules } from './interactions-in-complex-layouts.ts';
import { interestTriggeredActionPreviewsRules } from './interest-triggered-action-previews.ts';
import { interestTriggeredTooltipsRules } from './interest-triggered-tooltips.ts';
import { languageDetectionRules } from './language-detection.ts';
import { lazyLoadVideoAndAudioRules } from './lazy-load-video-and-audio.ts';
import { lightDismissADialogRules } from './light-dismiss-a-dialog.ts';
import { menuRules } from './menu.ts';
import { navigationDrawerRules } from './navigation-drawer.ts';
import { optimizeImagePriorityRules } from './optimize-image-priority.ts';
import { persistentToastNotificationsRules } from './persistent-toast-notifications.ts';
import { physicsBasedEasingRules } from './physics-based-easing.ts';
import { platformControlsDismissDialogRules } from './platform-controls-dismiss-dialog.ts';
import { positionAwareTooltipsRules } from './position-aware-tooltips.ts';
import { preciseTextAlignmentRules } from './precise-text-alignment.ts';
import { preventPageScrollUnderModalDialogRules } from './prevent-page-scroll-under-modal-dialog.ts';
import { progressRingRules } from './progress-ring.ts';
import { requiredFieldFeedbackRules } from './required-field-feedback.ts';
import { resolutionOptimizedPseudoElementsRules } from './resolution-optimized-pseudo-elements.ts';
import { responsiveTableRules } from './responsive-table.ts';
import { sanitizeUntrustedHtmlRules } from './sanitize-untrusted-html.ts';
import { scrollCompletionEffectsRules } from './scroll-completion-effects.ts';
import { scrollEntryExitEffectsRules } from './scroll-entry-exit-effects.ts';
import { scrollPositionAwareElementsRules } from './scroll-position-aware-elements.ts';
import { scrollProgressIndicatorRules } from './scroll-progress-indicator.ts';
import { scrollSnapRealtimeFeedbackRules } from './scroll-snap-realtime-feedback.ts';
import { scrollSnapStateSyncRules } from './scroll-snap-state-sync.ts';
import { scrollTargetOnLoadRules } from './scroll-target-on-load.ts';
import { scrollabilityAffordanceHintsRules } from './scrollability-affordance-hints.ts';
import { scrollspyRules } from './scrollspy.ts';
import { selectMenuInteractionRules } from './select-menu-interaction.ts';
import { sizeAwareStylingRules } from './size-aware-styling.ts';
import { sliderRules } from './slider.ts';
import { smsOtpFormRules } from './sms-otp-form.ts';
import { softEdgeContentFadeRules } from './soft-edge-content-fade.ts';
import { stateAwareStickyHeadersRules } from './state-aware-sticky-headers.ts';
import { stylingWebComponentsRules } from './styling-web-components.ts';
import { supportGlobalCalendarSystemsRules } from './support-global-calendar-systems.ts';
import { switchRules } from './switch.ts';

export * from './anchor-positioning-tab-underline.ts';
export * from './animate-element-entry-exit.ts';
export * from './animate-to-from-top-layer.ts';
export * from './animate-to-intrinsic-sizes.ts';
export * from './atrule-support-conditionals.ts';
export * from './autofill-address-form.ts';
export * from './autofill-payment-form.ts';
export * from './autofill-sign-in-form.ts';
export * from './autofill-sign-up-form.ts';
export * from './batch-analytics-events.ts';
export * from './branded-select-styling.ts';
export * from './break-up-long-tasks.ts';
export * from './calculate-event-differentials.ts';
export * from './capture-location-agnostic-data.ts';
export * from './checkbox.ts';
export * from './child-state-based-styling.ts';
export * from './complex-shapes.ts';
export * from './conditional-async-dependencies.ts';
export * from './contrast-color.ts';
export * from './coordinate-global-events.ts';
export * from './custom-button-actions.ts';
export * from './custom-select-picker-layouts.ts';
export * from './custom-text-decorations.ts';
export * from './customize-scrollbar-color-and-thickness.ts';
export * from './dark-mode.ts';
export * from './declarative-dialog-popover-control.ts';
export * from './defer-work-until-scroll-ends.ts';
export * from './deliver-optimized-decorative-images.ts';
export * from './detect-initial-visibility-state.ts';
export * from './drag.ts';
export * from './equal-width-text-lines.ts';
export * from './export-html-media-from-canvas.ts';
export * from './form-fields-automatically-fit-contents.ts';
export * from './highlight-text-ranges.ts';
export * from './ime-safe-enter-submit.ts';
export * from './improve-next-page-load-performance.ts';
export * from './improve-text-layout-and-legibility.ts';
export * from './individual-transform-properties.ts';
export * from './interactions-in-complex-layouts.ts';
export * from './interest-triggered-action-previews.ts';
export * from './interest-triggered-tooltips.ts';
export * from './language-detection.ts';
export * from './lazy-load-video-and-audio.ts';
export * from './light-dismiss-a-dialog.ts';
export * from './menu.ts';
export * from './navigation-drawer.ts';
export * from './optimize-image-priority.ts';
export * from './persistent-toast-notifications.ts';
export * from './physics-based-easing.ts';
export * from './platform-controls-dismiss-dialog.ts';
export * from './position-aware-tooltips.ts';
export * from './precise-text-alignment.ts';
export * from './prevent-page-scroll-under-modal-dialog.ts';
export * from './progress-ring.ts';
export * from './required-field-feedback.ts';
export * from './resolution-optimized-pseudo-elements.ts';
export * from './responsive-table.ts';
export * from './sanitize-untrusted-html.ts';
export * from './scroll-completion-effects.ts';
export * from './scroll-entry-exit-effects.ts';
export * from './scroll-position-aware-elements.ts';
export * from './scroll-progress-indicator.ts';
export * from './scroll-snap-realtime-feedback.ts';
export * from './scroll-snap-state-sync.ts';
export * from './scroll-target-on-load.ts';
export * from './scrollability-affordance-hints.ts';
export * from './scrollspy.ts';
export * from './select-menu-interaction.ts';
export * from './size-aware-styling.ts';
export * from './slider.ts';
export * from './sms-otp-form.ts';
export * from './soft-edge-content-fade.ts';
export * from './state-aware-sticky-headers.ts';
export * from './styling-web-components.ts';
export * from './support-global-calendar-systems.ts';
export * from './switch.ts';

export type RuleLifecycle =
  | { readonly status: 'qualified' }
  | { readonly status: 'experimental' }
  | { readonly status: 'suspended'; readonly reason: string }
  | { readonly status: 'retired'; readonly reason: string };

export interface RuleRegistryEntry {
  readonly guideId: string;
  readonly lifecycle: RuleLifecycle;
  readonly rules: readonly AnalyzerRule[];
  readonly postSelectionTuned?: boolean;
}

/**
 * Hand-curated canonical rule registry keyed by guideId.
 * Single source of truth for rule lifecycle, existence, and tuning state.
 */
export const RULE_REGISTRY: readonly RuleRegistryEntry[] = [
  {
    guideId: 'anchor-positioning-tab-underline',
    lifecycle: { status: 'experimental' },
    rules: anchorPositioningTabUnderlineRules,
  },
  {
    guideId: 'animate-element-entry-exit',
    lifecycle: { status: 'experimental' },
    rules: animateElementEntryExitRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'animate-to-from-top-layer',
    lifecycle: { status: 'experimental' },
    rules: animateToFromTopLayerRules,
  },
  {
    guideId: 'animate-to-intrinsic-sizes',
    lifecycle: { status: 'experimental' },
    rules: animateToIntrinsicSizesRules,
  },
  {
    guideId: 'atrule-support-conditionals',
    lifecycle: { status: 'experimental' },
    rules: atruleSupportConditionalsRules,
  },
  {
    guideId: 'autofill-address-form',
    lifecycle: { status: 'qualified' },
    rules: autofillAddressFormRules,
  },
  {
    guideId: 'autofill-payment-form',
    lifecycle: { status: 'experimental' },
    rules: autofillPaymentFormRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'autofill-sign-in-form',
    lifecycle: { status: 'qualified' },
    rules: autofillSignInFormRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'autofill-sign-up-form',
    lifecycle: { status: 'experimental' },
    rules: autofillSignUpFormRules,
  },
  {
    guideId: 'batch-analytics-events',
    lifecycle: { status: 'experimental' },
    rules: batchAnalyticsEventsRules,
  },
  {
    guideId: 'branded-select-styling',
    lifecycle: { status: 'experimental' },
    rules: brandedSelectStylingRules,
  },
  {
    guideId: 'break-up-long-tasks',
    lifecycle: { status: 'experimental' },
    rules: breakUpLongTasksRules,
  },
  {
    guideId: 'calculate-event-differentials',
    lifecycle: { status: 'experimental' },
    rules: calculateEventDifferentialsRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'capture-location-agnostic-data',
    lifecycle: { status: 'experimental' },
    rules: captureLocationAgnosticDataRules,
  },
  {
    guideId: 'checkbox',
    lifecycle: { status: 'experimental' },
    rules: checkboxRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'child-state-based-styling',
    lifecycle: { status: 'experimental' },
    rules: childStateBasedStylingRules,
  },
  {
    guideId: 'complex-shapes',
    lifecycle: { status: 'suspended', reason: "Failed precision threshold in held-out validation; 0 human blind spot-check cards" },
    rules: complexShapesRules,
  },
  {
    guideId: 'conditional-async-dependencies',
    lifecycle: { status: 'experimental' },
    rules: conditionalAsyncDependenciesRules,
  },
  {
    guideId: 'contrast-color',
    lifecycle: { status: 'experimental' },
    rules: contrastColorRules,
  },
  {
    guideId: 'coordinate-global-events',
    lifecycle: { status: 'experimental' },
    rules: coordinateGlobalEventsRules,
  },
  {
    guideId: 'custom-button-actions',
    lifecycle: { status: 'experimental' },
    rules: customButtonActionsRules,
  },
  {
    guideId: 'custom-select-picker-layouts',
    lifecycle: { status: 'experimental' },
    rules: customSelectPickerLayoutsRules,
  },
  {
    guideId: 'custom-text-decorations',
    lifecycle: { status: 'experimental' },
    rules: customTextDecorationsRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'customize-scrollbar-color-and-thickness',
    lifecycle: { status: 'experimental' },
    rules: customizeScrollbarColorAndThicknessRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'dark-mode',
    lifecycle: { status: 'experimental' },
    rules: darkModeRules,
  },
  {
    guideId: 'declarative-dialog-popover-control',
    lifecycle: { status: 'experimental' },
    rules: declarativeDialogPopoverControlRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'defer-work-until-scroll-ends',
    lifecycle: { status: 'experimental' },
    rules: deferWorkUntilScrollEndsRules,
  },
  {
    guideId: 'deliver-optimized-decorative-images',
    lifecycle: { status: 'experimental' },
    rules: deliverOptimizedDecorativeImagesRules,
  },
  {
    guideId: 'detect-initial-visibility-state',
    lifecycle: { status: 'experimental' },
    rules: detectInitialVisibilityStateRules,
  },
  {
    guideId: 'drag',
    lifecycle: { status: 'experimental' },
    rules: dragRules,
  },
  {
    guideId: 'equal-width-text-lines',
    lifecycle: { status: 'experimental' },
    rules: equalWidthTextLinesRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'export-html-media-from-canvas',
    lifecycle: { status: 'experimental' },
    rules: exportHtmlMediaFromCanvasRules,
  },
  {
    guideId: 'form-fields-automatically-fit-contents',
    lifecycle: { status: 'qualified' },
    rules: formFieldsAutomaticallyFitContentsRules,
  },
  {
    guideId: 'highlight-text-ranges',
    lifecycle: { status: 'experimental' },
    rules: highlightTextRangesRules,
  },
  {
    guideId: 'ime-safe-enter-submit',
    lifecycle: { status: 'experimental' },
    rules: imeSafeEnterSubmitRules,
  },
  {
    guideId: 'improve-next-page-load-performance',
    lifecycle: { status: 'experimental' },
    rules: improveNextPageLoadPerformanceRules,
  },
  {
    guideId: 'improve-text-layout-and-legibility',
    lifecycle: { status: 'experimental' },
    rules: improveTextLayoutAndLegibilityRules,
  },
  {
    guideId: 'individual-transform-properties',
    lifecycle: { status: 'experimental' },
    rules: individualTransformPropertiesRules,
  },
  {
    guideId: 'interactions-in-complex-layouts',
    lifecycle: { status: 'suspended', reason: "Zero denominator (n = 0) on held-out corpus" },
    rules: interactionsInComplexLayoutsRules,
  },
  {
    guideId: 'interest-triggered-action-previews',
    lifecycle: { status: 'experimental' },
    rules: interestTriggeredActionPreviewsRules,
  },
  {
    guideId: 'interest-triggered-tooltips',
    lifecycle: { status: 'experimental' },
    rules: interestTriggeredTooltipsRules,
  },
  {
    guideId: 'language-detection',
    lifecycle: { status: 'suspended', reason: "Zero denominator (n = 0) on held-out corpus" },
    rules: languageDetectionRules,
  },
  {
    guideId: 'lazy-load-video-and-audio',
    lifecycle: { status: 'experimental' },
    rules: lazyLoadVideoAndAudioRules,
  },
  {
    guideId: 'light-dismiss-a-dialog',
    lifecycle: { status: 'experimental' },
    rules: lightDismissADialogRules,
  },
  {
    guideId: 'menu',
    lifecycle: { status: 'experimental' },
    rules: menuRules,
  },
  {
    guideId: 'navigation-drawer',
    lifecycle: { status: 'experimental' },
    rules: navigationDrawerRules,
  },
  {
    guideId: 'optimize-image-priority',
    lifecycle: { status: 'experimental' },
    rules: optimizeImagePriorityRules,
  },
  {
    guideId: 'persistent-toast-notifications',
    lifecycle: { status: 'experimental' },
    rules: persistentToastNotificationsRules,
  },
  {
    guideId: 'physics-based-easing',
    lifecycle: { status: 'experimental' },
    rules: physicsBasedEasingRules,
  },
  {
    guideId: 'platform-controls-dismiss-dialog',
    lifecycle: { status: 'experimental' },
    rules: platformControlsDismissDialogRules,
  },
  {
    guideId: 'position-aware-tooltips',
    lifecycle: { status: 'experimental' },
    rules: positionAwareTooltipsRules,
  },
  {
    guideId: 'precise-text-alignment',
    lifecycle: { status: 'experimental' },
    rules: preciseTextAlignmentRules,
  },
  {
    guideId: 'prevent-page-scroll-under-modal-dialog',
    lifecycle: { status: 'experimental' },
    rules: preventPageScrollUnderModalDialogRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'progress-ring',
    lifecycle: { status: 'experimental' },
    rules: progressRingRules,
  },
  {
    guideId: 'required-field-feedback',
    lifecycle: { status: 'experimental' },
    rules: requiredFieldFeedbackRules,
  },
  {
    guideId: 'resolution-optimized-pseudo-elements',
    lifecycle: { status: 'experimental' },
    rules: resolutionOptimizedPseudoElementsRules,
  },
  {
    guideId: 'responsive-table',
    lifecycle: { status: 'qualified' },
    rules: responsiveTableRules,
  },
  {
    guideId: 'sanitize-untrusted-html',
    lifecycle: { status: 'experimental' },
    rules: sanitizeUntrustedHtmlRules,
  },
  {
    guideId: 'scroll-completion-effects',
    lifecycle: { status: 'experimental' },
    rules: scrollCompletionEffectsRules,
  },
  {
    guideId: 'scroll-entry-exit-effects',
    lifecycle: { status: 'qualified' },
    rules: scrollEntryExitEffectsRules,
  },
  {
    guideId: 'scroll-position-aware-elements',
    lifecycle: { status: 'experimental' },
    rules: scrollPositionAwareElementsRules,
  },
  {
    guideId: 'scroll-progress-indicator',
    lifecycle: { status: 'experimental' },
    rules: scrollProgressIndicatorRules,
  },
  {
    guideId: 'scroll-snap-realtime-feedback',
    lifecycle: { status: 'experimental' },
    rules: scrollSnapRealtimeFeedbackRules,
  },
  {
    guideId: 'scroll-snap-state-sync',
    lifecycle: { status: 'experimental' },
    rules: scrollSnapStateSyncRules,
  },
  {
    guideId: 'scroll-target-on-load',
    lifecycle: { status: 'experimental' },
    rules: scrollTargetOnLoadRules,
  },
  {
    guideId: 'scrollability-affordance-hints',
    lifecycle: { status: 'experimental' },
    rules: scrollabilityAffordanceHintsRules,
  },
  {
    guideId: 'scrollspy',
    lifecycle: { status: 'qualified' },
    rules: scrollspyRules,
  },
  {
    guideId: 'select-menu-interaction',
    lifecycle: { status: 'experimental' },
    rules: selectMenuInteractionRules,
  },
  {
    guideId: 'size-aware-styling',
    lifecycle: { status: 'experimental' },
    rules: sizeAwareStylingRules,
  },
  {
    guideId: 'slider',
    lifecycle: { status: 'experimental' },
    rules: sliderRules,
  },
  {
    guideId: 'sms-otp-form',
    lifecycle: { status: 'experimental' },
    rules: smsOtpFormRules,
  },
  {
    guideId: 'soft-edge-content-fade',
    lifecycle: { status: 'experimental' },
    rules: softEdgeContentFadeRules,
  },
  {
    guideId: 'state-aware-sticky-headers',
    lifecycle: { status: 'experimental' },
    rules: stateAwareStickyHeadersRules,
  },
  {
    guideId: 'styling-web-components',
    lifecycle: { status: 'experimental' },
    rules: stylingWebComponentsRules,
    postSelectionTuned: true,
  },
  {
    guideId: 'support-global-calendar-systems',
    lifecycle: { status: 'experimental' },
    rules: supportGlobalCalendarSystemsRules,
  },
  {
    guideId: 'switch',
    lifecycle: { status: 'experimental' },
    rules: switchRules,
  },
  {
    guideId: 'adapt-scrollbar-to-contrast-preferences',
    lifecycle: { status: 'retired', reason: "No client-side legacy pattern; applicability depends on visual/semantic judgment" },
    rules: [],
  },
  {
    guideId: 'autofill-highlight-inputs',
    lifecycle: {
      status: 'retired',
      reason: 'Swapping :-webkit-autofill for :autofill is a no-op in all current browser engines',
    },
    rules: [],
  },
  {
    guideId: 'brand-consistent-forms',
    lifecycle: { status: 'retired', reason: "Contradicts checkbox guide, 0/111 genuine like-for-like" },
    rules: [],
  },
  {
    guideId: 'schedule-tasks-by-priority',
    lifecycle: { status: 'retired', reason: "rIC has deadline/timeout semantics, not 1:1 with postTask" },
    rules: [],
  },
  {
    guideId: 'format-human-readable-durations',
    lifecycle: { status: 'retired', reason: "Consolidated into calculate-event-differentials" },
    rules: [],
  },
  {
    guideId: 'manage-recurring-intervals',
    lifecycle: { status: 'retired', reason: "Consolidated into capture-location-agnostic-data" },
    rules: [],
    postSelectionTuned: true,
  },
  {
    guideId: 'visually-stable-font-fallbacks',
    lifecycle: { status: 'retired', reason: "WebFont.load calls in real code load runtime/canvas fonts, not fallback metrics; sampled hits were all false alarms." },
    rules: [],
  },
  {
    guideId: 'client-side-encryption',
    lifecycle: { status: 'retired', reason: "Legacy algorithms (RC4, DES) and CryptoJS key derivation have no in-place Web Crypto equivalent without breaking ciphertext compatibility." },
    rules: [],
  },
  {
    guideId: 'digital-signatures',
    lifecycle: { status: 'retired', reason: "Web Crypto signatures need exact key and encoding alignment (DER vs raw), so this isn't a safe in-place change." },
    rules: [],
  },
  {
    guideId: 'resilient-context-menus-and-nested-dropdowns',
    lifecycle: {
      status: 'retired',
      reason: 'Guide renamed to viewport-aware-dropdowns; the old Bootstrap dropdown-toggle rule was removed.',
    },
    rules: [],
  },
  {
    guideId: 'shadow-dom',
    lifecycle: {
      status: 'retired',
      reason: "Removed: string templates in script tags aren't Shadow DOM targets.",
    },
    rules: [],
  },
  {
    guideId: 'copy-button',
    lifecycle: {
      status: 'retired',
      reason: "Guide is still a stub on this branch; restore the rule once the guide's content merges.",
    },
    rules: [],
  },
  {
    guideId: 'accessible-error-announcement',
    lifecycle: {
      status: 'retired',
      reason: "Removed: static CSS selectors can't detect missing live-region announcements.",
    },
    rules: [],
  },
];

export const RULE_REGISTRY_BY_GUIDE_ID: ReadonlyMap<string, RuleRegistryEntry> = new Map(
  RULE_REGISTRY.map((e) => [e.guideId, e]),
);

/**
 * Production shipping qualified guide IDs (6 guides clearing precision threshold).
 */
export const QUALIFIED_GUIDE_IDS: readonly string[] = RULE_REGISTRY
  .filter((e) => e.lifecycle.status === 'qualified')
  .map((e) => e.guideId);

/**
 * Candidate guides temporarily suspended from default shipping qualification pending human spot-checks.
 */
export const SUSPENDED_QUALIFIED_GUIDE_IDS: readonly string[] = RULE_REGISTRY
  .filter((e) => e.lifecycle.status === 'suspended')
  .map((e) => e.guideId);

/**
 * Guides that were tuned after initial held-out inspection.
 */
export const POST_SELECTION_TUNED_GUIDE_IDS: readonly string[] = RULE_REGISTRY
  .filter((e) => Boolean(e.postSelectionTuned))
  .map((e) => e.guideId);

/**
 * Production rules gated to qualified guides only.
 */
export const QUALIFIED_RULES: readonly AnalyzerRule[] = RULE_REGISTRY
  .filter((e) => e.lifecycle.status === 'qualified')
  .flatMap((e) => e.rules);

/**
 * All active rules across qualified, experimental, and suspended guides.
 */
export const ALL_RULES: readonly AnalyzerRule[] = RULE_REGISTRY
  .filter((e) => e.lifecycle.status !== 'retired')
  .flatMap((e) => e.rules);
