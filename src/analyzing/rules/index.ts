import type { AnalyzerRule } from '../schema.ts';
import { adaptScrollbarToContrastPreferencesRules } from './adapt-scrollbar-to-contrast-preferences.ts';
import { anchorPositioningTabUnderlineRules } from './anchor-positioning-tab-underline.ts';
import { animateElementEntryExitRules } from './animate-element-entry-exit.ts';
import { animateToFromTopLayerRules } from './animate-to-from-top-layer.ts';
import { animateToIntrinsicSizesRules } from './animate-to-intrinsic-sizes.ts';
import { atruleSupportConditionalsRules } from './atrule-support-conditionals.ts';
import { autofillAddressFormRules } from './autofill-address-form.ts';
import { autofillHighlightInputsRules } from './autofill-highlight-inputs.ts';
import { autofillPaymentFormRules } from './autofill-payment-form.ts';
import { autofillSignInFormRules } from './autofill-sign-in-form.ts';
import { batchAnalyticsEventsRules } from './batch-analytics-events.ts';
import { brandConsistentFormsRules } from './brand-consistent-forms.ts';
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
import { formatHumanReadableDurationsRules } from './format-human-readable-durations.ts';
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
import { manageRecurringIntervalsRules } from './manage-recurring-intervals.ts';
import { menuRules } from './menu.ts';
import { navigationDrawerRules } from './navigation-drawer.ts';
import { optimizeImagePriorityRules } from './optimize-image-priority.ts';
import { platformControlsDismissDialogRules } from './platform-controls-dismiss-dialog.ts';
import { positionAwareTooltipsRules } from './position-aware-tooltips.ts';
import { preciseTextAlignmentRules } from './precise-text-alignment.ts';
import { preventPageScrollUnderModalDialogRules } from './prevent-page-scroll-under-modal-dialog.ts';
import { progressRingRules } from './progress-ring.ts';
import { requiredFieldFeedbackRules } from './required-field-feedback.ts';
import { resilientContextMenusAndNestedDropdownsRules } from './resilient-context-menus-and-nested-dropdowns.ts';
import { resolutionOptimizedPseudoElementsRules } from './resolution-optimized-pseudo-elements.ts';
import { responsiveTableRules } from './responsive-table.ts';
import { sanitizeUntrustedHtmlRules } from './sanitize-untrusted-html.ts';
import { scheduleTasksByPriorityRules } from './schedule-tasks-by-priority.ts';
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
import { softEdgeContentFadeRules } from './soft-edge-content-fade.ts';
import { stateAwareStickyHeadersRules } from './state-aware-sticky-headers.ts';
import { stylingWebComponentsRules } from './styling-web-components.ts';
import { supportGlobalCalendarSystemsRules } from './support-global-calendar-systems.ts';
import { switchRules } from './switch.ts';

export * from './adapt-scrollbar-to-contrast-preferences.ts';
export * from './anchor-positioning-tab-underline.ts';
export * from './animate-element-entry-exit.ts';
export * from './animate-to-from-top-layer.ts';
export * from './animate-to-intrinsic-sizes.ts';
export * from './atrule-support-conditionals.ts';
export * from './autofill-address-form.ts';
export * from './autofill-highlight-inputs.ts';
export * from './autofill-payment-form.ts';
export * from './autofill-sign-in-form.ts';
export * from './batch-analytics-events.ts';
export * from './brand-consistent-forms.ts';
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
export * from './format-human-readable-durations.ts';
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
export * from './manage-recurring-intervals.ts';
export * from './menu.ts';
export * from './navigation-drawer.ts';
export * from './optimize-image-priority.ts';
export * from './platform-controls-dismiss-dialog.ts';
export * from './position-aware-tooltips.ts';
export * from './precise-text-alignment.ts';
export * from './prevent-page-scroll-under-modal-dialog.ts';
export * from './progress-ring.ts';
export * from './resilient-context-menus-and-nested-dropdowns.ts';
export * from './resolution-optimized-pseudo-elements.ts';
export * from './responsive-table.ts';
export * from './sanitize-untrusted-html.ts';
export * from './schedule-tasks-by-priority.ts';
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
export * from './soft-edge-content-fade.ts';
export * from './state-aware-sticky-headers.ts';
export * from './styling-web-components.ts';
export * from './support-global-calendar-systems.ts';
export * from './switch.ts';

export const PILOT_RULES: readonly AnalyzerRule[] = [
  // Pilot Batch 1 & Earlier (spread *Rules arrays consistently):
  ...autofillSignInFormRules,
  ...animateToIntrinsicSizesRules,
  ...declarativeDialogPopoverControlRules,
  ...animateElementEntryExitRules,
  ...coordinateGlobalEventsRules,
  ...customizeScrollbarColorAndThicknessRules,
  ...individualTransformPropertiesRules,
  ...childStateBasedStylingRules,
  ...breakUpLongTasksRules,
  ...imeSafeEnterSubmitRules,
  ...calculateEventDifferentialsRules,
  ...resilientContextMenusAndNestedDropdownsRules,
  ...formFieldsAutomaticallyFitContentsRules,
  ...brandConsistentFormsRules,

  // Batch 2 & Reserve:
  ...scrollspyRules,
  ...autofillAddressFormRules,
  ...brandedSelectStylingRules,
  ...adaptScrollbarToContrastPreferencesRules,
  ...checkboxRules,
  ...sizeAwareStylingRules,
  ...deferWorkUntilScrollEndsRules,
  ...scheduleTasksByPriorityRules,
  ...preventPageScrollUnderModalDialogRules,
  ...darkModeRules,
  ...manageRecurringIntervalsRules,

  // Batch 3 Wild-Verified Guides (4 active guides, 6 rules -> 39 rules across 29 feature guides total;
  // model-partial-time-concepts and custom-select-picker-layouts removed per O69 guide mismatch):
  ...dragRules,
  ...formatHumanReadableDurationsRules,
  ...sanitizeUntrustedHtmlRules,
  ...scrollPositionAwareElementsRules,

  // Batch 4 Empirical GitMirror Guides (6 guides, 7 rules -> 46 rules across 35 feature guides total):
  ...autofillHighlightInputsRules,
  ...complexShapesRules,
  ...deliverOptimizedDecorativeImagesRules,
  ...responsiveTableRules,
  ...equalWidthTextLinesRules,
  ...lightDismissADialogRules,

  // Wave 3A Guides (9 guides, 14 rules -> 60 rules across 44 feature guides total):
  ...detectInitialVisibilityStateRules,
  ...resolutionOptimizedPseudoElementsRules,
  ...atruleSupportConditionalsRules,
  ...scrollEntryExitEffectsRules,
  ...languageDetectionRules,
  ...improveNextPageLoadPerformanceRules,
  ...highlightTextRangesRules,
  ...supportGlobalCalendarSystemsRules,
  ...captureLocationAgnosticDataRules,

  // Wave 4A & 4B Ready Guides (5 guides, 6 rules -> 55 rules across 40 feature guides total):
  ...softEdgeContentFadeRules,
  ...switchRules,
  ...optimizeImagePriorityRules,
  ...selectMenuInteractionRules,
  ...lazyLoadVideoAndAudioRules,

  // Wave 2B Guides (18 guides, 26 rules):
  ...stateAwareStickyHeadersRules,
  ...scrollProgressIndicatorRules,
  ...scrollTargetOnLoadRules,
  ...scrollabilityAffordanceHintsRules,
  ...scrollSnapRealtimeFeedbackRules,
  ...scrollSnapStateSyncRules,
  ...preciseTextAlignmentRules,
  ...improveTextLayoutAndLegibilityRules,
  ...requiredFieldFeedbackRules,
  ...exportHtmlMediaFromCanvasRules,
  ...customSelectPickerLayoutsRules,
  ...animateToFromTopLayerRules,
  ...interestTriggeredTooltipsRules,
  ...positionAwareTooltipsRules,
  ...interestTriggeredActionPreviewsRules,
  ...conditionalAsyncDependenciesRules,
  ...batchAnalyticsEventsRules,
  ...interactionsInComplexLayoutsRules,

  // Wave 2C Guides (11 guides, 15 rules):
  ...anchorPositioningTabUnderlineRules,
  ...autofillPaymentFormRules,
  ...stylingWebComponentsRules,
  ...navigationDrawerRules,
  ...progressRingRules,
  ...platformControlsDismissDialogRules,
  ...scrollCompletionEffectsRules,
  ...customTextDecorationsRules,
  ...contrastColorRules,
  ...customButtonActionsRules,
  ...menuRules,
];

export const ALL_RULES: readonly AnalyzerRule[] = PILOT_RULES;

export {
  TERMINAL_QUALIFIED_GUIDE_IDS,
  JSON_QUALIFIED_GUIDE_IDS,
  QUALIFIED_GUIDE_IDS,
  deriveQualifiedGuideIds,
} from '../qualification.ts';

import {
  TERMINAL_QUALIFIED_GUIDE_IDS,
  JSON_QUALIFIED_GUIDE_IDS,
} from '../qualification.ts';

/**
 * Production rules gated to terminal qualified guides only.
 */
export const TERMINAL_QUALIFIED_RULES: readonly AnalyzerRule[] = ALL_RULES.filter((r) =>
  TERMINAL_QUALIFIED_GUIDE_IDS.includes(r.guideId),
);

/**
 * Production rules gated to JSON qualified guides only.
 */
export const JSON_QUALIFIED_RULES: readonly AnalyzerRule[] = ALL_RULES.filter((r) =>
  JSON_QUALIFIED_GUIDE_IDS.includes(r.guideId),
);

/**
 * Production rules gated to qualified guides only (clearing wilson95.lower >= 0.90 on admitted split).
 * All landed guides remain available via ALL_RULES (--experimental / --all-rules).
 */
export const QUALIFIED_RULES: readonly AnalyzerRule[] = TERMINAL_QUALIFIED_RULES;

/**
 * Guides that were tuned after initial held-out inspection (G10 disclosure, R32.4).
 */
export const POST_SELECTION_TUNED_GUIDE_IDS: readonly string[] = [
  'manage-recurring-intervals',
  'calculate-event-differentials',
  'checkbox',
  'declarative-dialog-popover-control',
] as const;
