import type { AnalyzerRule } from '../schema.ts';

import anchorPositioningTabUnderline from './anchor-positioning-tab-underline.ts';
import animateElementEntryExit from './animate-element-entry-exit.ts';
import animateToFromTopLayer from './animate-to-from-top-layer.ts';
import animateToIntrinsicSizes from './animate-to-intrinsic-sizes.ts';
import atruleSupportConditionals from './atrule-support-conditionals.ts';
import autofillAddressForm from './autofill-address-form.ts';
import autofillHighlightInputs from './autofill-highlight-inputs.ts';
import autofillPaymentForm from './autofill-payment-form.ts';
import autofillSignInForm from './autofill-sign-in-form.ts';
import autofillSignUpForm from './autofill-sign-up-form.ts';
import batchAnalyticsEvents from './batch-analytics-events.ts';
import brandedSelectStyling from './branded-select-styling.ts';
import breakUpLongTasks from './break-up-long-tasks.ts';
import calculateEventDifferentials from './calculate-event-differentials.ts';
import captureLocationAgnosticData from './capture-location-agnostic-data.ts';
import checkbox from './checkbox.ts';
import childStateBasedStyling from './child-state-based-styling.ts';
import clientSideEncryption from './client-side-encryption.ts';
import complexShapes from './complex-shapes.ts';
import conditionalAsyncDependencies from './conditional-async-dependencies.ts';
import contrastColor from './contrast-color.ts';
import coordinateGlobalEvents from './coordinate-global-events.ts';
import customButtonActions from './custom-button-actions.ts';
import customSelectPickerLayouts from './custom-select-picker-layouts.ts';
import customTextDecorations from './custom-text-decorations.ts';
import customizeScrollbarColorAndThickness from './customize-scrollbar-color-and-thickness.ts';
import darkMode from './dark-mode.ts';
import declarativeDialogPopoverControl from './declarative-dialog-popover-control.ts';
import deferWorkUntilScrollEnds from './defer-work-until-scroll-ends.ts';
import deliverOptimizedDecorativeImages from './deliver-optimized-decorative-images.ts';
import detectInitialVisibilityState from './detect-initial-visibility-state.ts';
import digitalSignatures from './digital-signatures.ts';
import drag from './drag.ts';
import equalWidthTextLines from './equal-width-text-lines.ts';
import exportHtmlMediaFromCanvas from './export-html-media-from-canvas.ts';
import formFieldsAutomaticallyFitContents from './form-fields-automatically-fit-contents.ts';
import highlightTextRanges from './highlight-text-ranges.ts';
import imeSafeEnterSubmit from './ime-safe-enter-submit.ts';
import improveNextPageLoadPerformance from './improve-next-page-load-performance.ts';
import improveTextLayoutAndLegibility from './improve-text-layout-and-legibility.ts';
import individualTransformProperties from './individual-transform-properties.ts';
import interactionsInComplexLayouts from './interactions-in-complex-layouts.ts';
import interestTriggeredActionPreviews from './interest-triggered-action-previews.ts';
import interestTriggeredTooltips from './interest-triggered-tooltips.ts';
import languageDetection from './language-detection.ts';
import lazyLoadVideoAndAudio from './lazy-load-video-and-audio.ts';
import lightDismissADialog from './light-dismiss-a-dialog.ts';
import menu from './menu.ts';
import navigationDrawer from './navigation-drawer.ts';
import optimizeImagePriority from './optimize-image-priority.ts';
import persistentToastNotifications from './persistent-toast-notifications.ts';
import physicsBasedEasing from './physics-based-easing.ts';
import platformControlsDismissDialog from './platform-controls-dismiss-dialog.ts';
import positionAwareTooltips from './position-aware-tooltips.ts';
import preciseTextAlignment from './precise-text-alignment.ts';
import preventPageScrollUnderModalDialog from './prevent-page-scroll-under-modal-dialog.ts';
import progressRing from './progress-ring.ts';
import requiredFieldFeedback from './required-field-feedback.ts';
import resolutionOptimizedPseudoElements from './resolution-optimized-pseudo-elements.ts';
import responsiveTable from './responsive-table.ts';
import sanitizeUntrustedHtml from './sanitize-untrusted-html.ts';
import scrollCompletionEffects from './scroll-completion-effects.ts';
import scrollEntryExitEffects from './scroll-entry-exit-effects.ts';
import scrollPositionAwareElements from './scroll-position-aware-elements.ts';
import scrollProgressIndicator from './scroll-progress-indicator.ts';
import scrollSnapRealtimeFeedback from './scroll-snap-realtime-feedback.ts';
import scrollSnapStateSync from './scroll-snap-state-sync.ts';
import scrollTargetOnLoad from './scroll-target-on-load.ts';
import scrollabilityAffordanceHints from './scrollability-affordance-hints.ts';
import scrollspy from './scrollspy.ts';
import selectMenuInteraction from './select-menu-interaction.ts';
import sizeAwareStyling from './size-aware-styling.ts';
import slider from './slider.ts';
import smsOtpForm from './sms-otp-form.ts';
import softEdgeContentFade from './soft-edge-content-fade.ts';
import stateAwareStickyHeaders from './state-aware-sticky-headers.ts';
import stylingWebComponents from './styling-web-components.ts';
import supportGlobalCalendarSystems from './support-global-calendar-systems.ts';
import switchRuleModule from './switch.ts';
import visuallyStableFontFallbacks from './visually-stable-font-fallbacks.ts';

export const RULE_MODULES: readonly (readonly AnalyzerRule[])[] = [
  anchorPositioningTabUnderline,
  animateElementEntryExit,
  animateToFromTopLayer,
  animateToIntrinsicSizes,
  atruleSupportConditionals,
  autofillAddressForm,
  autofillHighlightInputs,
  autofillPaymentForm,
  autofillSignInForm,
  autofillSignUpForm,
  batchAnalyticsEvents,
  brandedSelectStyling,
  breakUpLongTasks,
  calculateEventDifferentials,
  captureLocationAgnosticData,
  checkbox,
  childStateBasedStyling,
  clientSideEncryption,
  complexShapes,
  conditionalAsyncDependencies,
  contrastColor,
  coordinateGlobalEvents,
  customButtonActions,
  customSelectPickerLayouts,
  customTextDecorations,
  customizeScrollbarColorAndThickness,
  darkMode,
  declarativeDialogPopoverControl,
  deferWorkUntilScrollEnds,
  deliverOptimizedDecorativeImages,
  detectInitialVisibilityState,
  digitalSignatures,
  drag,
  equalWidthTextLines,
  exportHtmlMediaFromCanvas,
  formFieldsAutomaticallyFitContents,
  highlightTextRanges,
  imeSafeEnterSubmit,
  improveNextPageLoadPerformance,
  improveTextLayoutAndLegibility,
  individualTransformProperties,
  interactionsInComplexLayouts,
  interestTriggeredActionPreviews,
  interestTriggeredTooltips,
  languageDetection,
  lazyLoadVideoAndAudio,
  lightDismissADialog,
  menu,
  navigationDrawer,
  optimizeImagePriority,
  persistentToastNotifications,
  physicsBasedEasing,
  platformControlsDismissDialog,
  positionAwareTooltips,
  preciseTextAlignment,
  preventPageScrollUnderModalDialog,
  progressRing,
  requiredFieldFeedback,
  resolutionOptimizedPseudoElements,
  responsiveTable,
  sanitizeUntrustedHtml,
  scrollCompletionEffects,
  scrollEntryExitEffects,
  scrollPositionAwareElements,
  scrollProgressIndicator,
  scrollSnapRealtimeFeedback,
  scrollSnapStateSync,
  scrollTargetOnLoad,
  scrollabilityAffordanceHints,
  scrollspy,
  selectMenuInteraction,
  sizeAwareStyling,
  slider,
  smsOtpForm,
  softEdgeContentFade,
  stateAwareStickyHeaders,
  stylingWebComponents,
  supportGlobalCalendarSystems,
  switchRuleModule,
  visuallyStableFontFallbacks,
];

export type RuleStatusValue = 'qualified' | 'experimental';

/**
 * Per-rule lifecycle status map keyed by `AnalyzerRule['id']`.
 *
 * Rules qualify for default terminal shipping when scored on held-out findings by the multi-judge panel:
 * - Static Matcher Precision >= 80.0% and Post-Rubric Precision >= 90.0% at n >= 10 findings
 *   (or Static Matcher Precision >= 90.0% at n >= 5 for rare patterns).
 */
export const STATUS: Readonly<Record<string, RuleStatusValue>> = {
  'anchor-positioning-tab-underline': 'experimental',
  'animate-element-entry-exit': 'experimental',
  'animate-to-from-top-layer': 'experimental',
  'animate-to-intrinsic-sizes': 'experimental',
  'atrule-support-conditionals/js-modernizr': 'experimental',
  'autofill-address-form': 'qualified',
  'autofill-highlight-inputs': 'experimental',
  'autofill-payment-form': 'qualified',
  'autofill-sign-in-form': 'qualified',
  'autofill-sign-up-form': 'experimental',
  'batch-analytics-events': 'experimental',
  'branded-select-styling': 'experimental',
  'branded-select-styling/js': 'experimental',
  'break-up-long-tasks': 'experimental',
  'calculate-event-differentials': 'experimental',
  'format-human-readable-durations/package-duration-formatter': 'experimental',
  'format-human-readable-durations/js-duration-formatter': 'experimental',
  'capture-location-agnostic-data/package-iso-lookup': 'experimental',
  'capture-location-agnostic-data/js-iso-lookup': 'experimental',
  'manage-recurring-intervals': 'experimental',
  'checkbox': 'qualified',
  'child-state-based-styling': 'experimental',
  'child-state-based-styling/js-parent-class': 'experimental',
  'client-side-encryption/js-crypto': 'experimental',
  'complex-shapes': 'experimental',
  'conditional-async-dependencies/package-script-loader': 'experimental',
  'conditional-async-dependencies/js-script-loader': 'experimental',
  'contrast-color/js': 'experimental',
  'contrast-color/css': 'experimental',
  'coordinate-global-events': 'experimental',
  'custom-button-actions': 'experimental',
  'custom-select-picker-layouts/js-custom-select': 'experimental',
  'custom-text-decorations': 'qualified',
  'customize-scrollbar-color-and-thickness': 'experimental',
  'dark-mode': 'experimental',
  'dark-mode/js-match-media': 'experimental',
  'declarative-dialog-popover-control': 'experimental',
  'declarative-dialog-popover-control/click-listener': 'experimental',
  'defer-work-until-scroll-ends': 'experimental',
  'deliver-optimized-decorative-images': 'experimental',
  'detect-initial-visibility-state': 'experimental',
  'digital-signatures/js-signature': 'experimental',
  'drag/package-drag-drop': 'experimental',
  'drag/js-mouse-touch-drag': 'experimental',
  'equal-width-text-lines/package-fittext': 'experimental',
  'equal-width-text-lines/js-fittext': 'experimental',
  'export-html-media-from-canvas/package-canvas-recorder': 'experimental',
  'export-html-media-from-canvas/js-canvas-recorder': 'experimental',
  'form-fields-automatically-fit-contents': 'qualified',
  'highlight-text-ranges/package-markjs': 'experimental',
  'highlight-text-ranges/js-markjs': 'experimental',
  'ime-safe-enter-submit': 'experimental',
  'improve-next-page-load-performance/package-prefetch': 'experimental',
  'improve-next-page-load-performance/js-quicklink': 'experimental',
  'improve-text-layout-and-legibility/package-text-balance': 'experimental',
  'improve-text-layout-and-legibility/js-text-balance': 'experimental',
  'individual-transform-properties': 'experimental',
  'individual-transform-properties/standalone-chain': 'experimental',
  'individual-transform-properties/single-function-state': 'experimental',
  'interactions-in-complex-layouts/package-fastdom': 'experimental',
  'interactions-in-complex-layouts/js-fastdom': 'experimental',
  'interest-triggered-action-previews/package-hoverintent': 'experimental',
  'interest-triggered-action-previews/js-hover-preview': 'experimental',
  'interest-triggered-tooltips/js-tooltip': 'qualified',
  'language-detection/package-lang-detect': 'experimental',
  'language-detection/js-lang-detect': 'experimental',
  'lazy-load-video-and-audio/js-media-observer': 'experimental',
  'lazy-load-video-and-audio/package-lazyload': 'experimental', // package.json matches are mostly lazy-loading images rather than video/audio
  'light-dismiss-a-dialog': 'experimental',
  'menu/js': 'experimental',
  'menu/dom': 'experimental',
  'navigation-drawer': 'experimental',
  'navigation-drawer/dom': 'experimental',
  'optimize-image-priority': 'experimental',
  'persistent-toast-notifications/js-toast': 'experimental',
  'physics-based-easing/js-spring': 'experimental',
  'platform-controls-dismiss-dialog': 'experimental',
  'position-aware-tooltips/js-popper-tooltip': 'experimental',
  'precise-text-alignment/package-capsize': 'experimental',
  'precise-text-alignment/js-capsize': 'experimental',
  'precise-text-alignment/css-leading-trim': 'experimental',
  'prevent-page-scroll-under-modal-dialog/package-scroll-lock': 'experimental',
  'prevent-page-scroll-under-modal-dialog': 'experimental',
  'prevent-page-scroll-under-modal-dialog/css': 'experimental',
  'progress-ring': 'experimental',
  'progress-ring/dom': 'experimental',
  'required-field-feedback/css-required-invalid': 'experimental',
  'required-field-feedback/js-blur-dirty-class': 'experimental',
  'resolution-optimized-pseudo-elements': 'experimental',
  'responsive-table/package-responsive-table': 'experimental',
  'responsive-table/css-data-label-table': 'experimental',
  'sanitize-untrusted-html/js-dompurify-innerhtml': 'experimental',
  'scroll-completion-effects': 'experimental',
  'scroll-entry-exit-effects/package-scroll-reveal': 'qualified',
  'scroll-entry-exit-effects/js-scroll-reveal': 'qualified',
  'scroll-position-aware-elements/js-scroll-listener': 'experimental',
  'scroll-progress-indicator': 'experimental',
  'scroll-snap-realtime-feedback': 'experimental',
  'scroll-snap-state-sync': 'experimental',
  'scroll-target-on-load': 'experimental',
  'scrollability-affordance-hints': 'experimental',
  'scrollspy': 'qualified',
  'scrollspy/js': 'experimental', // CSS scroll-target-group / :target-current is not yet Baseline
  'select-menu-interaction/css-select-invalid': 'experimental',
  'select-menu-interaction/js-select-interaction': 'experimental',
  'size-aware-styling': 'experimental',
  'slider/js-slider': 'experimental',
  'sms-otp-form': 'experimental',
  'soft-edge-content-fade': 'experimental',
  'state-aware-sticky-headers': 'experimental',
  'styling-web-components': 'qualified',
  'support-global-calendar-systems/package-calendar': 'experimental',
  'support-global-calendar-systems/js-calendar': 'experimental',
  'switch': 'experimental',
  'visually-stable-font-fallbacks/package-font-loader': 'experimental',
  'visually-stable-font-fallbacks/js-font-loader': 'experimental',
};

/**
 * Retired guides that have no active rule module on disk.
 */
export const RETIRED: Readonly<Record<string, string>> = {
  'adapt-scrollbar-to-contrast-preferences':
    'No client-side legacy pattern; applicability depends on visual/semantic judgment',
  'brand-consistent-forms':
    'Flags the appearance:none technique recommended by the checkbox guide',
  'schedule-tasks-by-priority':
    'requestIdleCallback has IdleDeadline/timeout semantics not 1:1 with scheduler.postTask',
  'format-human-readable-durations':
    'Consolidated into calculate-event-differentials',
  'manage-recurring-intervals':
    'Consolidated into capture-location-agnostic-data',
  'resilient-context-menus-and-nested-dropdowns':
    'Guide renamed to viewport-aware-dropdowns; the old Bootstrap dropdown-toggle rule was removed',
  'shadow-dom':
    "Removed: string templates in script tags aren't Shadow DOM targets",
  'copy-button':
    "Guide is still a stub on this branch; restore the rule once the guide's content merges",
  'accessible-error-announcement':
    "Removed: static CSS selectors can't detect missing live-region announcements",
};

export type RuleLifecycle =
  | { readonly status: 'qualified' }
  | { readonly status: 'experimental' }
  | { readonly status: 'retired'; readonly reason: string };

export interface RuleRegistryEntry {
  readonly guideId: string;
  readonly lifecycle: RuleLifecycle;
  readonly rules: readonly AnalyzerRule[];
}

function deriveModuleLifecycle(rules: readonly AnalyzerRule[]): RuleLifecycle {
  if (rules.some((rule) => STATUS[rule.id] === 'qualified')) {
    return { status: 'qualified' };
  }
  return { status: 'experimental' };
}

/**
 * Canonical rule registry derived from `RULE_MODULES`, `STATUS`, and `RETIRED`.
 */
export const RULE_REGISTRY: readonly RuleRegistryEntry[] = [
  ...RULE_MODULES.map((rules): RuleRegistryEntry => ({
    guideId: rules[0].guideId,
    lifecycle: deriveModuleLifecycle(rules),
    rules,
  })),
  ...Object.entries(RETIRED).map(([guideId, reason]): RuleRegistryEntry => ({
    guideId,
    lifecycle: { status: 'retired', reason },
    rules: [],
  })),
];

export const RULE_REGISTRY_BY_GUIDE_ID: ReadonlyMap<string, RuleRegistryEntry> = new Map(
  RULE_REGISTRY.map((e) => [e.guideId, e]),
);

/**
 * All active rules across qualified and experimental rules.
 */
export const ALL_RULES: readonly AnalyzerRule[] = RULE_MODULES.flat();

/**
 * Production rules gated to qualified status in `STATUS`.
 */
export const QUALIFIED_RULES: readonly AnalyzerRule[] = ALL_RULES.filter(
  (rule) => STATUS[rule.id] === 'qualified',
);

/**
 * Guide IDs that have at least one qualified rule in `STATUS`.
 */
export const QUALIFIED_GUIDE_IDS: readonly string[] = RULE_REGISTRY
  .filter((e) => e.lifecycle.status === 'qualified')
  .map((e) => e.guideId);
