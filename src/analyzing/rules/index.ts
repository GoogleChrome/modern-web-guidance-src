import type { AnalyzerRule } from '../schema.ts';
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
  coordinateGlobalEventsRule,
} from './coordinate-global-events.ts';
import {
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
  declarativeDialogPopoverControlRules,
} from './declarative-dialog-popover-control.ts';

export * from './animate-element-entry-exit.ts';
export * from './animate-to-intrinsic-sizes.ts';
export * from './autofill-sign-in-form.ts';
export * from './coordinate-global-events.ts';
export * from './declarative-dialog-popover-control.ts';

export const PILOT_RULES: readonly AnalyzerRule[] = [
  autofillSignInFormRule,
  animateToIntrinsicSizesRule,
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
  animateElementEntryExitRule,
  coordinateGlobalEventsRule,
];

export const ALL_RULES: readonly AnalyzerRule[] = PILOT_RULES;
