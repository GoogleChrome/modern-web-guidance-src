import type { AnalyzerRule } from '../schema.ts';

import animateToIntrinsicSizes from './animate-to-intrinsic-sizes.ts';
import autofillAddressForm from './autofill-address-form.ts';
import autofillPaymentForm from './autofill-payment-form.ts';
import autofillSignInForm from './autofill-sign-in-form.ts';
import autofillSignUpForm from './autofill-sign-up-form.ts';
import calculateEventDifferentials from './calculate-event-differentials.ts';
import checkbox from './checkbox.ts';
import childStateBasedStyling from './child-state-based-styling.ts';
import customTextDecorations from './custom-text-decorations.ts';
import customizeScrollbarColorAndThickness from './customize-scrollbar-color-and-thickness.ts';
import darkMode from './dark-mode.ts';
import darkModeToggle from './dark-mode-toggle.ts';
import declarativeDialogPopoverControl from './declarative-dialog-popover-control.ts';
import deliverOptimizedDecorativeImages from './deliver-optimized-decorative-images.ts';
import dynamicSiblingAnimations from './dynamic-sibling-animations.ts';
import equalWidthTextLines from './equal-width-text-lines.ts';
import flickerFreeClientSideAbTesting from './flicker-free-client-side-ab-testing.ts';
import formFieldsAutomaticallyFitContents from './form-fields-automatically-fit-contents.ts';
import icons from './icons.ts';
import imeSafeEnterSubmit from './ime-safe-enter-submit.ts';
import improveTextLayoutAndLegibility from './improve-text-layout-and-legibility.ts';
import interestTriggeredTooltips from './interest-triggered-tooltips.ts';
import lightDismissADialog from './light-dismiss-a-dialog.ts';
import progress from './progress.ts';
import sanitizeUntrustedHtml from './sanitize-untrusted-html.ts';
import scrollEntryExitEffects from './scroll-entry-exit-effects.ts';
import scrollspy from './scrollspy.ts';
import secureExternalSubresources from './secure-external-subresources.ts';
import selectMenuInteraction from './select-menu-interaction.ts';
import slider from './slider.ts';
import softEdgeContentFade from './soft-edge-content-fade.ts';
import stylingWebComponents from './styling-web-components.ts';
import validateInputAfterInteraction from './validate-input-after-interaction.ts';

export const RULE_MODULES: readonly (readonly AnalyzerRule[])[] = [
  animateToIntrinsicSizes,
  autofillAddressForm,
  autofillPaymentForm,
  autofillSignInForm,
  autofillSignUpForm,
  calculateEventDifferentials,
  checkbox,
  childStateBasedStyling,
  customTextDecorations,
  customizeScrollbarColorAndThickness,
  darkMode,
  darkModeToggle,
  declarativeDialogPopoverControl,
  deliverOptimizedDecorativeImages,
  dynamicSiblingAnimations,
  equalWidthTextLines,
  flickerFreeClientSideAbTesting,
  formFieldsAutomaticallyFitContents,
  icons,
  imeSafeEnterSubmit,
  improveTextLayoutAndLegibility,
  interestTriggeredTooltips,
  lightDismissADialog,
  progress,
  sanitizeUntrustedHtml,
  scrollEntryExitEffects,
  scrollspy,
  secureExternalSubresources,
  selectMenuInteraction,
  slider,
  softEdgeContentFade,
  stylingWebComponents,
  validateInputAfterInteraction,
];

/**
 * Qualified default-shipping rules.
 *
 * Rules qualify for default terminal shipping when scored on held-out findings by the multi-judge panel:
 * - Post-Verifier Precision >= 90% and either Static Matcher Precision >= 80% at n >= 10,
 *   or >= 90% at n >= 5 for rare patterns.
 */
export const QUALIFIED_RULES: readonly AnalyzerRule[] = RULE_MODULES.flat();

/**
 * Alias for callers in `src/analyzing/eval/` that iterate over all public rules.
 */
export const ALL_RULES: readonly AnalyzerRule[] = QUALIFIED_RULES;

/**
 * Sorted list of guide IDs that have at least one qualified rule.
 */
export const QUALIFIED_GUIDE_IDS: readonly string[] = Array.from(
  new Set(QUALIFIED_RULES.map((r) => r.guideId)),
).sort();
