import type { AnalyzerRule } from '../schema.ts';
import { accessibleErrorAnnouncementRule } from './accessible-error-announcement.ts';
import { adaptScrollbarToContrastPreferencesRules } from './adapt-scrollbar-to-contrast-preferences.ts';
import { animateElementEntryExitRule } from './animate-element-entry-exit.ts';
import { animateToIntrinsicSizesRule } from './animate-to-intrinsic-sizes.ts';
import { autofillAddressFormRules } from './autofill-address-form.ts';
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
import { coordinateGlobalEventsRule } from './coordinate-global-events.ts';
import { customSelectPickerLayoutsRules } from './custom-select-picker-layouts.ts';
import { customizeScrollbarColorAndThicknessRule } from './customize-scrollbar-color-and-thickness.ts';
import { darkModeRules } from './dark-mode.ts';
import {
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
} from './declarative-dialog-popover-control.ts';
import { deferWorkUntilScrollEndsRule } from './defer-work-until-scroll-ends.ts';
import { detectInitialVisibilityStateRule } from './detect-initial-visibility-state.ts';
import { dragRules } from './drag.ts';
import { formFieldsAutomaticallyFitContentsRule } from './form-fields-automatically-fit-contents.ts';
import { formatHumanReadableDurationsRules } from './format-human-readable-durations.ts';
import { imeSafeEnterSubmitRule } from './ime-safe-enter-submit.ts';
import { individualTransformPropertiesRule } from './individual-transform-properties.ts';
import { manageRecurringIntervalsRules } from './manage-recurring-intervals.ts';
import { modelPartialTimeConceptsRules } from './model-partial-time-concepts.ts';
import { preventPageScrollUnderModalDialogRules } from './prevent-page-scroll-under-modal-dialog.ts';
import {
  resilientContextMenusAndNestedDropdownsRule,
  resilientContextMenusAndNestedDropdownsPositioningRule,
} from './resilient-context-menus-and-nested-dropdowns.ts';
import { sanitizeUntrustedHtmlRules } from './sanitize-untrusted-html.ts';
import { scheduleTasksByPriorityRule } from './schedule-tasks-by-priority.ts';
import { scrollPositionAwareElementsRules } from './scroll-position-aware-elements.ts';
import { scrollspyRules } from './scrollspy.ts';
import { shadowDomRules } from './shadow-dom.ts';
import { sizeAwareStylingRules } from './size-aware-styling.ts';
import { stackDrillDownRule } from './stack-drill-down.ts';

export * from './accessible-error-announcement.ts';
export * from './adapt-scrollbar-to-contrast-preferences.ts';
export * from './animate-element-entry-exit.ts';
export * from './animate-to-intrinsic-sizes.ts';
export * from './autofill-address-form.ts';
export * from './autofill-sign-in-form.ts';
export * from './brand-consistent-forms.ts';
export * from './branded-select-styling.ts';
export * from './break-up-long-tasks.ts';
export * from './calculate-event-differentials.ts';
export * from './checkbox.ts';
export * from './child-state-based-styling.ts';
export * from './coordinate-global-events.ts';
export * from './custom-select-picker-layouts.ts';
export * from './customize-scrollbar-color-and-thickness.ts';
export * from './dark-mode.ts';
export * from './declarative-dialog-popover-control.ts';
export * from './defer-work-until-scroll-ends.ts';
export * from './detect-initial-visibility-state.ts';
export * from './drag.ts';
export * from './form-fields-automatically-fit-contents.ts';
export * from './format-human-readable-durations.ts';
export * from './ime-safe-enter-submit.ts';
export * from './individual-transform-properties.ts';
export * from './manage-recurring-intervals.ts';
export * from './model-partial-time-concepts.ts';
export * from './prevent-page-scroll-under-modal-dialog.ts';
export * from './resilient-context-menus-and-nested-dropdowns.ts';
export * from './sanitize-untrusted-html.ts';
export * from './schedule-tasks-by-priority.ts';
export * from './scroll-position-aware-elements.ts';
export * from './scrollspy.ts';
export * from './shadow-dom.ts';
export * from './size-aware-styling.ts';
export * from './stack-drill-down.ts';

export const PILOT_RULES: readonly AnalyzerRule[] = [
  // Pilot Batch 1 & Earlier (16 guides, 19 rules):
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
  accessibleErrorAnnouncementRule,
  breakUpLongTasksRule,
  imeSafeEnterSubmitRule,
  stackDrillDownRule,
  calculateEventDifferentialsRule,
  resilientContextMenusAndNestedDropdownsRule,
  resilientContextMenusAndNestedDropdownsPositioningRule,
  formFieldsAutomaticallyFitContentsRule,
  brandConsistentFormsRule,

  // Batch 2 & Reserve (13 guides, 17 rules -> 36 rules across 29 landed feature guides):
  ...scrollspyRules,
  ...autofillAddressFormRules,
  ...shadowDomRules,
  ...brandedSelectStylingRules,
  ...adaptScrollbarToContrastPreferencesRules,
  ...checkboxRules,
  ...sizeAwareStylingRules,
  deferWorkUntilScrollEndsRule,
  detectInitialVisibilityStateRule,
  scheduleTasksByPriorityRule,
  ...preventPageScrollUnderModalDialogRules,
  ...darkModeRules,
  ...manageRecurringIntervalsRules,

  // Batch 3 Wild-Verified Guides (6 guides, 12 rules -> 48 rules across 35 feature guides total):
  ...dragRules,
  ...formatHumanReadableDurationsRules,
  ...modelPartialTimeConceptsRules,
  ...sanitizeUntrustedHtmlRules,
  ...customSelectPickerLayoutsRules,
  ...scrollPositionAwareElementsRules,
];

export const ALL_RULES: readonly AnalyzerRule[] = PILOT_RULES;

/**
 * Tier 1: Proven high-N qualified guides.
 */
export const TIER_1_GUIDE_IDS: readonly string[] = [
  'autofill-sign-in-form',
  'declarative-dialog-popover-control',
  'animate-element-entry-exit',
  'individual-transform-properties',
  'child-state-based-styling',
  'resilient-context-menus-and-nested-dropdowns',
  'shadow-dom',
] as const;

/**
 * Production rules for Tier 1 proven-high-N guides.
 */
export const TIER_1_RULES: readonly AnalyzerRule[] = ALL_RULES.filter((r) =>
  TIER_1_GUIDE_IDS.includes(r.guideId),
);

/**
 * Tier 2: Guides unmeasured under high-N threshold (too few findings: n < 8, lower bound unmeasured per R20).
 */
export const TIER_2_GUIDE_IDS: readonly string[] = [
  'animate-to-intrinsic-sizes',
  'coordinate-global-events',
  'accessible-error-announcement',
  'ime-safe-enter-submit',
  'stack-drill-down',
  'calculate-event-differentials',
  'form-fields-automatically-fit-contents',
  'brand-consistent-forms',
  'autofill-address-form',
  'branded-select-styling',
  'adapt-scrollbar-to-contrast-preferences',
  'checkbox',
  'prevent-page-scroll-under-modal-dialog',
  'dark-mode',
  'manage-recurring-intervals',
  'customize-scrollbar-color-and-thickness',
  'break-up-long-tasks',
  'detect-initial-visibility-state',
] as const;

/**
 * Production rules for Tier 2 zero-FP low-N guides.
 */
export const TIER_2_RULES: readonly AnalyzerRule[] = ALL_RULES.filter((r) =>
  TIER_2_GUIDE_IDS.includes(r.guideId),
);

/**
 * Strict qualified guides clearing the held-out precision bar (wilson95.lower >= 0.90 at n >= 35) per R10, R32.5, R33, O40, O60.
 *
 * NOTE (O60): No guides have been measured on an untuned final split yet.
 * On held-out local-93 tuning repos, 'animate-element-entry-exit' clears the bar provisionally.
 * 'individual-transform-properties' scored 57/59 (wilson95.lower = 0.885 < 0.90) and is excluded.
 */
export const TERMINAL_QUALIFIED_GUIDE_IDS: readonly string[] = [
  'animate-element-entry-exit',
] as const;

export const JSON_QUALIFIED_GUIDE_IDS: readonly string[] = [
  'animate-element-entry-exit',
] as const;

export const QUALIFIED_GUIDE_IDS: readonly string[] = TERMINAL_QUALIFIED_GUIDE_IDS;

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
 * Production rules gated to qualified guides only (clearing wilson95.lower >= 0.90).
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
