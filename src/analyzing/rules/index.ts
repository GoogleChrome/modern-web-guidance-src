import type { AnalyzerRule } from '../schema.ts';
import {
  accessibleErrorAnnouncementRule,
  accessibleErrorAnnouncementRules,
} from './accessible-error-announcement.ts';
import {
  animateElementEntryExitRule,
} from './animate-element-entry-exit.ts';
import {
  animateToIntrinsicSizesRule,
  animateToIntrinsicSizesRules,
} from './animate-to-intrinsic-sizes.ts';
import {
  autofillSignInFormRule,
  autofillSignInFormRules,
} from './autofill-sign-in-form.ts';
import {
  brandConsistentFormsRule,
  brandConsistentFormsRules,
} from './brand-consistent-forms.ts';
import {
  breakUpLongTasksRule,
} from './break-up-long-tasks.ts';
import {
  calculateEventDifferentialsRule,
} from './calculate-event-differentials.ts';
import {
  childStateBasedStylingRule,
  childStateBasedStylingRules,
} from './child-state-based-styling.ts';
import {
  coordinateGlobalEventsRule,
} from './coordinate-global-events.ts';
import {
  customizeScrollbarColorAndThicknessRule,
  customizeScrollbarColorAndThicknessRules,
} from './customize-scrollbar-color-and-thickness.ts';
import {
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
  declarativeDialogPopoverControlRules,
} from './declarative-dialog-popover-control.ts';
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
  resilientContextMenusAndNestedDropdownsRule,
  resilientContextMenusAndNestedDropdownsPositioningRule,
  resilientContextMenusAndNestedDropdownsRules,
} from './resilient-context-menus-and-nested-dropdowns.ts';
import {
  stackDrillDownRule,
} from './stack-drill-down.ts';

export * from './accessible-error-announcement.ts';
export * from './animate-element-entry-exit.ts';
export * from './animate-to-intrinsic-sizes.ts';
export * from './autofill-sign-in-form.ts';
export * from './brand-consistent-forms.ts';
export * from './break-up-long-tasks.ts';
export * from './calculate-event-differentials.ts';
export * from './child-state-based-styling.ts';
export * from './coordinate-global-events.ts';
export * from './customize-scrollbar-color-and-thickness.ts';
export * from './declarative-dialog-popover-control.ts';
export * from './form-fields-automatically-fit-contents.ts';
export * from './ime-safe-enter-submit.ts';
export * from './individual-transform-properties.ts';
export * from './resilient-context-menus-and-nested-dropdowns.ts';
export * from './stack-drill-down.ts';

export const PILOT_RULES: readonly AnalyzerRule[] = [
  autofillSignInFormRule,
  animateToIntrinsicSizesRule,
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
  animateElementEntryExitRule,
  coordinateGlobalEventsRule,
  customizeScrollbarColorAndThicknessRule,
  individualTransformPropertiesRule,
  childStateBasedStylingRule,
  accessibleErrorAnnouncementRule,
  breakUpLongTasksRule,
  imeSafeEnterSubmitRule,
  stackDrillDownRule,
  calculateEventDifferentialsRule,
  resilientContextMenusAndNestedDropdownsRule,
  resilientContextMenusAndNestedDropdownsPositioningRule,
  formFieldsAutomaticallyFitContentsRule,
  brandConsistentFormsRule,
];

export const ALL_RULES: readonly AnalyzerRule[] = PILOT_RULES;
