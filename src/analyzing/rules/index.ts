import type { AnalyzerRule } from '../schema.ts';
import { adaptScrollbarToContrastPreferencesRules } from './adapt-scrollbar-to-contrast-preferences.ts';
import { animateElementEntryExitRule } from './animate-element-entry-exit.ts';
import { animateToIntrinsicSizesRule } from './animate-to-intrinsic-sizes.ts';
import { autofillAddressFormRules } from './autofill-address-form.ts';
import { autofillHighlightInputsRules } from './autofill-highlight-inputs.ts';
import { autofillSignInFormRule } from './autofill-sign-in-form.ts';
import { brandConsistentFormsRule } from './brand-consistent-forms.ts';
import { brandedSelectStylingRules } from './branded-select-styling.ts';
import { breakUpLongTasksRule } from './break-up-long-tasks.ts';
import { calculateEventDifferentialsRule } from './calculate-event-differentials.ts';
import { checkboxRules } from './checkbox.ts';
import {
  childStateBasedStylingRule,
  childStateBasedStylingJsParentClassRule,
} from './child-state-based-styling.ts';
import { complexShapesRules } from './complex-shapes.ts';
import { coordinateGlobalEventsRule } from './coordinate-global-events.ts';
import { customizeScrollbarColorAndThicknessRule } from './customize-scrollbar-color-and-thickness.ts';
import { darkModeRules } from './dark-mode.ts';
import {
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
} from './declarative-dialog-popover-control.ts';
import { deferWorkUntilScrollEndsRule } from './defer-work-until-scroll-ends.ts';
import { deliverOptimizedDecorativeImagesRules } from './deliver-optimized-decorative-images.ts';
import { dragRules } from './drag.ts';
import { equalWidthTextLinesRules } from './equal-width-text-lines.ts';
import { formFieldsAutomaticallyFitContentsRule } from './form-fields-automatically-fit-contents.ts';
import { formatHumanReadableDurationsRules } from './format-human-readable-durations.ts';
import { imeSafeEnterSubmitRule } from './ime-safe-enter-submit.ts';
import { individualTransformPropertiesRule } from './individual-transform-properties.ts';
import { lightDismissADialogRules } from './light-dismiss-a-dialog.ts';
import { manageRecurringIntervalsRules } from './manage-recurring-intervals.ts';
import { preventPageScrollUnderModalDialogRules } from './prevent-page-scroll-under-modal-dialog.ts';
import {
  resilientContextMenusAndNestedDropdownsRule,
  resilientContextMenusAndNestedDropdownsPositioningRule,
} from './resilient-context-menus-and-nested-dropdowns.ts';
import { responsiveTableRules } from './responsive-table.ts';
import { sanitizeUntrustedHtmlRules } from './sanitize-untrusted-html.ts';
import { scheduleTasksByPriorityRule } from './schedule-tasks-by-priority.ts';
import { scrollPositionAwareElementsRules } from './scroll-position-aware-elements.ts';
import { scrollspyRules } from './scrollspy.ts';
import { shrinkingHeaderOnScrollRules } from './shrinking-header-on-scroll.ts';
import { sizeAwareStylingRules } from './size-aware-styling.ts';

export * from './adapt-scrollbar-to-contrast-preferences.ts';
export * from './animate-element-entry-exit.ts';
export * from './animate-to-intrinsic-sizes.ts';
export * from './autofill-address-form.ts';
export * from './autofill-highlight-inputs.ts';
export * from './autofill-sign-in-form.ts';
export * from './brand-consistent-forms.ts';
export * from './branded-select-styling.ts';
export * from './break-up-long-tasks.ts';
export * from './calculate-event-differentials.ts';
export * from './checkbox.ts';
export * from './child-state-based-styling.ts';
export * from './complex-shapes.ts';
export * from './coordinate-global-events.ts';
export * from './customize-scrollbar-color-and-thickness.ts';
export * from './dark-mode.ts';
export * from './declarative-dialog-popover-control.ts';
export * from './defer-work-until-scroll-ends.ts';
export * from './deliver-optimized-decorative-images.ts';
export * from './drag.ts';
export * from './equal-width-text-lines.ts';
export * from './form-fields-automatically-fit-contents.ts';
export * from './format-human-readable-durations.ts';
export * from './ime-safe-enter-submit.ts';
export * from './individual-transform-properties.ts';
export * from './light-dismiss-a-dialog.ts';
export * from './manage-recurring-intervals.ts';
export * from './prevent-page-scroll-under-modal-dialog.ts';
export * from './resilient-context-menus-and-nested-dropdowns.ts';
export * from './responsive-table.ts';
export * from './sanitize-untrusted-html.ts';
export * from './schedule-tasks-by-priority.ts';
export * from './scroll-position-aware-elements.ts';
export * from './scrollspy.ts';
export * from './shrinking-header-on-scroll.ts';
export * from './size-aware-styling.ts';

export const PILOT_RULES: readonly AnalyzerRule[] = [
  // Pilot Batch 1 & Earlier (14 guides, 17 rules; accessible-error-announcement and stack-drill-down retired per Gate 0 / O38):
  autofillSignInFormRule,
  animateToIntrinsicSizesRule,
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
  animateElementEntryExitRule,
  coordinateGlobalEventsRule,
  customizeScrollbarColorAndThicknessRule,
  individualTransformPropertiesRule,
  childStateBasedStylingRule,
  childStateBasedStylingJsParentClassRule,
  breakUpLongTasksRule,
  imeSafeEnterSubmitRule,
  calculateEventDifferentialsRule,
  resilientContextMenusAndNestedDropdownsRule,
  resilientContextMenusAndNestedDropdownsPositioningRule,
  formFieldsAutomaticallyFitContentsRule,
  brandConsistentFormsRule,

  // Batch 2 & Reserve (11 guides, 16 rules -> 33 rules across 25 landed feature guides; shadow-dom and detect-initial-visibility-state retired):
  ...scrollspyRules,
  ...autofillAddressFormRules,
  ...brandedSelectStylingRules,
  ...adaptScrollbarToContrastPreferencesRules,
  ...checkboxRules,
  ...sizeAwareStylingRules,
  deferWorkUntilScrollEndsRule,
  scheduleTasksByPriorityRule,
  ...preventPageScrollUnderModalDialogRules,
  ...darkModeRules,
  ...manageRecurringIntervalsRules,

  // Batch 3 Wild-Verified Guides (4 active guides, 7 rules -> 40 rules across 29 feature guides total;
  // model-partial-time-concepts and custom-select-picker-layouts removed per O69 guide mismatch):
  ...dragRules,
  ...formatHumanReadableDurationsRules,
  ...sanitizeUntrustedHtmlRules,
  ...scrollPositionAwareElementsRules,

  // Batch 4 Empirical GitMirror Guides (7 guides, 10 rules -> 50 rules across 36 feature guides total):
  ...autofillHighlightInputsRules,
  ...complexShapesRules,
  ...deliverOptimizedDecorativeImagesRules,
  ...responsiveTableRules,
  ...shrinkingHeaderOnScrollRules,
  ...equalWidthTextLinesRules,
  ...lightDismissADialogRules,
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
