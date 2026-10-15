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
import { customizeScrollbarColorAndThicknessRule } from './customize-scrollbar-color-and-thickness.ts';
import { darkModeRules } from './dark-mode.ts';
import {
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
} from './declarative-dialog-popover-control.ts';
import { deferWorkUntilScrollEndsRule } from './defer-work-until-scroll-ends.ts';
import { detectInitialVisibilityStateRule } from './detect-initial-visibility-state.ts';
import { formFieldsAutomaticallyFitContentsRule } from './form-fields-automatically-fit-contents.ts';
import { imeSafeEnterSubmitRule } from './ime-safe-enter-submit.ts';
import { individualTransformPropertiesRule } from './individual-transform-properties.ts';
import { manageRecurringIntervalsRules } from './manage-recurring-intervals.ts';
import { preventPageScrollUnderModalDialogRules } from './prevent-page-scroll-under-modal-dialog.ts';
import {
  resilientContextMenusAndNestedDropdownsRule,
  resilientContextMenusAndNestedDropdownsPositioningRule,
} from './resilient-context-menus-and-nested-dropdowns.ts';
import { scheduleTasksByPriorityRule } from './schedule-tasks-by-priority.ts';
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
export * from './customize-scrollbar-color-and-thickness.ts';
export * from './dark-mode.ts';
export * from './declarative-dialog-popover-control.ts';
export * from './defer-work-until-scroll-ends.ts';
export * from './detect-initial-visibility-state.ts';
export * from './form-fields-automatically-fit-contents.ts';
export * from './ime-safe-enter-submit.ts';
export * from './individual-transform-properties.ts';
export * from './manage-recurring-intervals.ts';
export * from './prevent-page-scroll-under-modal-dialog.ts';
export * from './resilient-context-menus-and-nested-dropdowns.ts';
export * from './schedule-tasks-by-priority.ts';
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

  // Batch 2 & Reserve (13 guides, 17 rules -> 36 rules across 29 landed feature guides total):
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
];

export const ALL_RULES: readonly AnalyzerRule[] = PILOT_RULES;

/**
 * Tier 1: Proven high-N qualified guides (n >= 8, 210/212 = 99.1% precision).
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
 * Tier 2: Zero-FP low-N qualified guides (n < 8, 35/35 = 100.0% precision).
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
 * The 25 guides that cleared the held-out precision bar under Milestone 3 verification.
 */
export const QUALIFIED_GUIDE_IDS: readonly string[] = [
  ...TIER_1_GUIDE_IDS,
  ...TIER_2_GUIDE_IDS,
] as const;

/**
 * Production rules gated to qualified guides only (Tier 1 + Tier 2 per G11 / G16 / O22).
 * Excludes 4 unqualified/experimental guides.
 */
export const QUALIFIED_RULES: readonly AnalyzerRule[] = [
  ...TIER_1_RULES,
  ...TIER_2_RULES,
];

/**
 * Guides that were tuned after initial held-out inspection (G10 disclosure).
 */
export const POST_SELECTION_TUNED_GUIDE_IDS: readonly string[] = [
  'manage-recurring-intervals',
  'calculate-event-differentials',
] as const;
