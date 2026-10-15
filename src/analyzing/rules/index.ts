import type { AnalyzerRule } from '../schema.ts';
import {
  accessibleErrorAnnouncementRule,
  accessibleErrorAnnouncementRules,
} from './accessible-error-announcement.ts';
import {
  adaptScrollbarToContrastPreferencesRule,
  adaptScrollbarToContrastPreferencesRules,
} from './adapt-scrollbar-to-contrast-preferences.ts';
import {
  animateElementEntryExitRule,
} from './animate-element-entry-exit.ts';
import {
  animateToIntrinsicSizesRule,
  animateToIntrinsicSizesRules,
} from './animate-to-intrinsic-sizes.ts';
import {
  autofillAddressFormRule,
  autofillAddressFormRules,
} from './autofill-address-form.ts';
import {
  autofillSignInFormRule,
  autofillSignInFormRules,
} from './autofill-sign-in-form.ts';
import {
  brandConsistentFormsRule,
  brandConsistentFormsRules,
} from './brand-consistent-forms.ts';
import {
  brandedSelectStylingRule,
  brandedSelectStylingJsRule,
  brandedSelectStylingRules,
} from './branded-select-styling.ts';
import {
  breakUpLongTasksRule,
} from './break-up-long-tasks.ts';
import {
  calculateEventDifferentialsRule,
} from './calculate-event-differentials.ts';
import {
  checkboxRule,
  checkboxRules,
} from './checkbox.ts';
import {
  childStateBasedStylingRule,
  childStateBasedStylingJsParentClassRule,
  childStateBasedStylingRules,
} from './child-state-based-styling.ts';
import {
  coordinateGlobalEventsRule,
} from './coordinate-global-events.ts';
import {
  copyButtonRule,
} from './copy-button.ts';
import {
  cssLayoutRule,
  cssLayoutRules,
} from './css-layout.ts';
import {
  customizeScrollbarColorAndThicknessRule,
  customizeScrollbarColorAndThicknessRules,
} from './customize-scrollbar-color-and-thickness.ts';
import {
  darkModeCssRule,
  darkModeJsMatchMediaRule,
  darkModeRules,
} from './dark-mode.ts';
import {
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
  declarativeDialogPopoverControlRules,
} from './declarative-dialog-popover-control.ts';
import {
  deferWorkUntilScrollEndsRule,
} from './defer-work-until-scroll-ends.ts';
import {
  detectInitialVisibilityStateRule,
} from './detect-initial-visibility-state.ts';
import {
  dialogRule,
  dialogRules,
} from './dialog.ts';
import {
  formFieldsAutomaticallyFitContentsRule,
  formFieldsAutomaticallyFitContentsRules,
} from './form-fields-automatically-fit-contents.ts';
import {
  imeSafeEnterSubmitRule,
} from './ime-safe-enter-submit.ts';
import {
  individualTransformPropertiesRule,
  individualTransformPropertiesRules,
} from './individual-transform-properties.ts';
import {
  manageRecurringIntervalsRule,
  manageRecurringIntervalsRules,
} from './manage-recurring-intervals.ts';
import {
  preventPageScrollUnderModalDialogRule,
  preventPageScrollUnderModalDialogCssRule,
  preventPageScrollUnderModalDialogRules,
} from './prevent-page-scroll-under-modal-dialog.ts';
import {
  resilientContextMenusAndNestedDropdownsRule,
  resilientContextMenusAndNestedDropdownsPositioningRule,
  resilientContextMenusAndNestedDropdownsRules,
} from './resilient-context-menus-and-nested-dropdowns.ts';
import {
  scheduleTasksByPriorityRule,
} from './schedule-tasks-by-priority.ts';
import {
  scrollspyRule,
  scrollspyJsRule,
  scrollspyRules,
} from './scrollspy.ts';
import {
  shadowDomRule,
  shadowDomJsRule,
  shadowDomRules,
} from './shadow-dom.ts';
import {
  sizeAwareStylingRule,
  sizeAwareStylingRules,
} from './size-aware-styling.ts';
import {
  stackDrillDownRule,
} from './stack-drill-down.ts';

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
export * from './copy-button.ts';
export * from './css-layout.ts';
export * from './customize-scrollbar-color-and-thickness.ts';
export * from './dark-mode.ts';
export * from './declarative-dialog-popover-control.ts';
export * from './defer-work-until-scroll-ends.ts';
export * from './detect-initial-visibility-state.ts';
export * from './dialog.ts';
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
  // Pilot Batch 1 & Earlier (16 guides):
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

  // Batch 2 & Reserve (16 guides, 32 guides total):
  ...dialogRules,
  ...scrollspyRules,
  ...autofillAddressFormRules,
  ...shadowDomRules,
  ...brandedSelectStylingRules,
  ...cssLayoutRules,
  ...adaptScrollbarToContrastPreferencesRules,
  ...checkboxRules,
  ...sizeAwareStylingRules,
  copyButtonRule,
  deferWorkUntilScrollEndsRule,
  detectInitialVisibilityStateRule,
  scheduleTasksByPriorityRule,
  ...preventPageScrollUnderModalDialogRules,
  ...darkModeRules,
  ...manageRecurringIntervalsRules,
];

export const ALL_RULES: readonly AnalyzerRule[] = PILOT_RULES;
