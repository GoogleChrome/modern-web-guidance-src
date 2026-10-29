import type { AnalyzerRule } from '../schema.ts';

import accessibleWebComponents from './accessible-web-components.ts';
import anchorPositioningTabUnderline from './anchor-positioning-tab-underline.ts';
import animateElementEntryExit from './animate-element-entry-exit.ts';
import animateToFromTopLayer from './animate-to-from-top-layer.ts';
import animateToIntrinsicSizes from './animate-to-intrinsic-sizes.ts';
import atruleSupportConditionals from './atrule-support-conditionals.ts';
import autofillAddressForm from './autofill-address-form.ts';
import autofillPaymentForm from './autofill-payment-form.ts';
import autofillSignInForm from './autofill-sign-in-form.ts';
import autofillSignUpForm from './autofill-sign-up-form.ts';
import batchAnalyticsEvents from './batch-analytics-events.ts';
import brandedSelectStyling from './branded-select-styling.ts';
import breakUpLongTasks from './break-up-long-tasks.ts';
import calculateEventDifferentials from './calculate-event-differentials.ts';
import calculateTotalForegroundTime from './calculate-total-foreground-time.ts';
import captureLocationAgnosticData from './capture-location-agnostic-data.ts';
import card from './card.ts';
import carouselSlideEffects from './carousel-slide-effects.ts';
import carouselSnapHighlights from './carousel-snap-highlights.ts';
import checkbox from './checkbox.ts';
import childStateBasedStyling from './child-state-based-styling.ts';
import clientSideEncryption from './client-side-encryption.ts';
import complexShapes from './complex-shapes.ts';
import componentSpecificLightDarkTheme from './component-specific-light-dark-theme.ts';
import conditionalAsyncDependencies from './conditional-async-dependencies.ts';
import contentBasedStyling from './content-based-styling.ts';
import contrastColor from './contrast-color.ts';
import coordinateGlobalEvents from './coordinate-global-events.ts';
import crossDocumentTransitions from './cross-document-transitions.ts';
import customButtonActions from './custom-button-actions.ts';
import customSelectPickerLayouts from './custom-select-picker-layouts.ts';
import customTextDecorations from './custom-text-decorations.ts';
import customizeScrollbarColorAndThickness from './customize-scrollbar-color-and-thickness.ts';
import darkMode from './dark-mode.ts';
import darkModeToggle from './dark-mode-toggle.ts';
import declarativeDialogPopoverControl from './declarative-dialog-popover-control.ts';
import deferRenderingHeavyContent from './defer-rendering-heavy-content.ts';
import deferWorkUntilScrollEnds from './defer-work-until-scroll-ends.ts';
import deliverOptimizedDecorativeImages from './deliver-optimized-decorative-images.ts';
import deprioritizeBackgroundFetches from './deprioritize-background-fetches.ts';
import detectInitialVisibilityState from './detect-initial-visibility-state.ts';
import digitalSignatures from './digital-signatures.ts';
import directionalNavigationTransitions from './directional-navigation-transitions.ts';
import drag from './drag.ts';
import dynamicSiblingAnimations from './dynamic-sibling-animations.ts';
import dynamicSiblingStyling from './dynamic-sibling-styling.ts';
import efficientBackgroundProcessing from './efficient-background-processing.ts';
import equalWidthTextLines from './equal-width-text-lines.ts';
import exportHtmlMediaFromCanvas from './export-html-media-from-canvas.ts';
import fasterSpaViewTransitions from './faster-spa-view-transitions.ts';
import flickerFreeClientSideAbTesting from './flicker-free-client-side-ab-testing.ts';
import fluidScaling from './fluid-scaling.ts';
import formAssociatedCustomElements from './form-associated-custom-elements.ts';
import formFieldsAutomaticallyFitContents from './form-fields-automatically-fit-contents.ts';
import fullSessionAnalytics from './full-session-analytics.ts';
import groupElementTransitions from './group-element-transitions.ts';
import highlightTextRanges from './highlight-text-ranges.ts';
import icons from './icons.ts';
import imeSafeEnterSubmit from './ime-safe-enter-submit.ts';
import improveNextPageLoadPerformance from './improve-next-page-load-performance.ts';
import improveTextLayoutAndLegibility from './improve-text-layout-and-legibility.ts';
import individualTransformProperties from './individual-transform-properties.ts';
import interactionsInComplexLayouts from './interactions-in-complex-layouts.ts';
import interactiveContentReveal from './interactive-content-reveal.ts';
import interestTriggeredActionPreviews from './interest-triggered-action-previews.ts';
import interestTriggeredTooltips from './interest-triggered-tooltips.ts';
import languageDetection from './language-detection.ts';
import lazyLoadVideoAndAudio from './lazy-load-video-and-audio.ts';
import lightDismissADialog from './light-dismiss-a-dialog.ts';
import menu from './menu.ts';
import navigationDrawer from './navigation-drawer.ts';
import optimizeImagePriority from './optimize-image-priority.ts';
import optimizePreloadPriority from './optimize-preload-priority.ts';
import optimizeScriptPriority from './optimize-script-priority.ts';
import parallaxScrollEffects from './parallax-scroll-effects.ts';
import persistentAppTours from './persistent-app-tours.ts';
import persistentToastNotifications from './persistent-toast-notifications.ts';
import physicsBasedEasing from './physics-based-easing.ts';
import platformControlsDismissDialog from './platform-controls-dismiss-dialog.ts';
import positionAwareTooltips from './position-aware-tooltips.ts';
import preciseTextAlignment from './precise-text-alignment.ts';
import prerenderingCustomElements from './prerendering-custom-elements.ts';
import preventPageScrollUnderModalDialog from './prevent-page-scroll-under-modal-dialog.ts';
import progress from './progress.ts';
import progressRing from './progress-ring.ts';
import pullToReveal from './pull-to-reveal.ts';
import requiredFieldFeedback from './required-field-feedback.ts';
import resolutionOptimizedPseudoElements from './resolution-optimized-pseudo-elements.ts';
import responsiveTable from './responsive-table.ts';
import sanitizeUntrustedHtml from './sanitize-untrusted-html.ts';
import scopedComponentTransitions from './scoped-component-transitions.ts';
import scrollCompletionEffects from './scroll-completion-effects.ts';
import scrollEntryExitEffects from './scroll-entry-exit-effects.ts';
import scrollPositionAwareElements from './scroll-position-aware-elements.ts';
import scrollProgressIndicator from './scroll-progress-indicator.ts';
import scrollSnapRealtimeFeedback from './scroll-snap-realtime-feedback.ts';
import scrollSnapStateSync from './scroll-snap-state-sync.ts';
import scrollTargetOnLoad from './scroll-target-on-load.ts';
import scrollabilityAffordanceHints from './scrollability-affordance-hints.ts';
import scrollytelling from './scrollytelling.ts';
import scrollspy from './scrollspy.ts';
import searchHiddenContent from './search-hidden-content.ts';
import secureExternalSubresources from './secure-external-subresources.ts';
import selectMenuInteraction from './select-menu-interaction.ts';
import sizeAwareStyling from './size-aware-styling.ts';
import slider from './slider.ts';
import smsOtpForm from './sms-otp-form.ts';
import softEdgeContentFade from './soft-edge-content-fade.ts';
import sortHighPrecisionTimestamps from './sort-high-precision-timestamps.ts';
import spatialNavigation from './spatial-navigation.ts';
import spinner from './spinner.ts';
import stateAwareStickyHeaders from './state-aware-sticky-headers.ts';
import stylingWebComponents from './styling-web-components.ts';
import supportGlobalCalendarSystems from './support-global-calendar-systems.ts';
import swipeToRemove from './swipe-to-remove.ts';
import swipeToReveal from './swipe-to-reveal.ts';
import switchRuleModule from './switch.ts';
import validateInputAfterInteraction from './validate-input-after-interaction.ts';
import validateOrigins from './validate-origins.ts';
import viewportAwareDropdowns from './viewport-aware-dropdowns.ts';
import visuallyStableFontFallbacks from './visually-stable-font-fallbacks.ts';

export const RULE_MODULES: readonly (readonly AnalyzerRule[])[] = [
  accessibleWebComponents,
  anchorPositioningTabUnderline,
  animateElementEntryExit,
  animateToFromTopLayer,
  animateToIntrinsicSizes,
  atruleSupportConditionals,
  autofillAddressForm,
  autofillPaymentForm,
  autofillSignInForm,
  autofillSignUpForm,
  batchAnalyticsEvents,
  brandedSelectStyling,
  breakUpLongTasks,
  calculateEventDifferentials,
  calculateTotalForegroundTime,
  captureLocationAgnosticData,
  card,
  carouselSlideEffects,
  carouselSnapHighlights,
  checkbox,
  childStateBasedStyling,
  clientSideEncryption,
  complexShapes,
  componentSpecificLightDarkTheme,
  conditionalAsyncDependencies,
  contentBasedStyling,
  contrastColor,
  coordinateGlobalEvents,
  crossDocumentTransitions,
  customButtonActions,
  customSelectPickerLayouts,
  customTextDecorations,
  customizeScrollbarColorAndThickness,
  darkMode,
  darkModeToggle,
  declarativeDialogPopoverControl,
  deferRenderingHeavyContent,
  deferWorkUntilScrollEnds,
  deliverOptimizedDecorativeImages,
  deprioritizeBackgroundFetches,
  detectInitialVisibilityState,
  digitalSignatures,
  directionalNavigationTransitions,
  drag,
  dynamicSiblingAnimations,
  dynamicSiblingStyling,
  efficientBackgroundProcessing,
  equalWidthTextLines,
  exportHtmlMediaFromCanvas,
  fasterSpaViewTransitions,
  flickerFreeClientSideAbTesting,
  fluidScaling,
  formAssociatedCustomElements,
  formFieldsAutomaticallyFitContents,
  fullSessionAnalytics,
  groupElementTransitions,
  highlightTextRanges,
  icons,
  imeSafeEnterSubmit,
  improveNextPageLoadPerformance,
  improveTextLayoutAndLegibility,
  individualTransformProperties,
  interactionsInComplexLayouts,
  interactiveContentReveal,
  interestTriggeredActionPreviews,
  interestTriggeredTooltips,
  languageDetection,
  lazyLoadVideoAndAudio,
  lightDismissADialog,
  menu,
  navigationDrawer,
  optimizeImagePriority,
  optimizePreloadPriority,
  optimizeScriptPriority,
  parallaxScrollEffects,
  persistentAppTours,
  persistentToastNotifications,
  physicsBasedEasing,
  platformControlsDismissDialog,
  positionAwareTooltips,
  preciseTextAlignment,
  prerenderingCustomElements,
  preventPageScrollUnderModalDialog,
  progress,
  progressRing,
  pullToReveal,
  requiredFieldFeedback,
  resolutionOptimizedPseudoElements,
  responsiveTable,
  sanitizeUntrustedHtml,
  scopedComponentTransitions,
  scrollCompletionEffects,
  scrollEntryExitEffects,
  scrollPositionAwareElements,
  scrollProgressIndicator,
  scrollSnapRealtimeFeedback,
  scrollSnapStateSync,
  scrollTargetOnLoad,
  scrollabilityAffordanceHints,
  scrollytelling,
  scrollspy,
  searchHiddenContent,
  secureExternalSubresources,
  selectMenuInteraction,
  sizeAwareStyling,
  slider,
  smsOtpForm,
  softEdgeContentFade,
  sortHighPrecisionTimestamps,
  spatialNavigation,
  spinner,
  stateAwareStickyHeaders,
  stylingWebComponents,
  supportGlobalCalendarSystems,
  swipeToRemove,
  swipeToReveal,
  switchRuleModule,
  validateInputAfterInteraction,
  validateOrigins,
  viewportAwareDropdowns,
  visuallyStableFontFallbacks,
];

export type RuleStatusValue = 'qualified' | 'experimental';

/**
 * Per-rule lifecycle status map keyed by `AnalyzerRule['id']`.
 *
 * Rules qualify for default terminal shipping when scored on held-out findings by the multi-judge panel:
 * - Post-Verifier Precision >= 90% and either Static Matcher Precision >= 80% at n >= 10,
 *   or >= 90% at n >= 5 for rare patterns.
 */
export const STATUS: Readonly<Record<string, RuleStatusValue>> = {
  'accessible-web-components': 'experimental',
  'anchor-positioning-tab-underline': 'experimental',
  'animate-element-entry-exit': 'experimental',
  'animate-to-from-top-layer': 'experimental',
  'animate-to-intrinsic-sizes': 'qualified',
  'atrule-support-conditionals/js-modernizr': 'experimental',
  'autofill-address-form': 'qualified',
  'autofill-payment-form': 'qualified',
  'autofill-sign-in-form': 'qualified',
  'autofill-sign-up-form': 'qualified',
  'batch-analytics-events': 'experimental',
  'branded-select-styling': 'experimental',
  'branded-select-styling/js': 'experimental',
  'break-up-long-tasks': 'experimental',
  'calculate-event-differentials': 'experimental',
  'calculate-total-foreground-time': 'experimental',
  'format-human-readable-durations/package-duration-formatter': 'experimental',
  'format-human-readable-durations/js-duration-formatter': 'qualified',
  'capture-location-agnostic-data/package-iso-lookup': 'experimental',
  'capture-location-agnostic-data/js-iso-lookup': 'experimental',
  'carousel-slide-effects': 'experimental',
  'carousel-snap-highlights': 'experimental',
  'manage-recurring-intervals': 'experimental',
  'card': 'experimental',
  'checkbox': 'qualified',
  'child-state-based-styling/js-parent-class': 'qualified',
  'client-side-encryption/js-crypto': 'experimental',
  'complex-shapes': 'experimental',
  'component-specific-light-dark-theme': 'experimental',
  'conditional-async-dependencies/package-script-loader': 'experimental',
  'conditional-async-dependencies/js-script-loader': 'experimental',
  'content-based-styling': 'experimental',
  'contrast-color/js': 'experimental',
  'contrast-color/css': 'experimental',
  'coordinate-global-events': 'experimental',
  'cross-document-transitions/package-page-transition': 'experimental',
  'cross-document-transitions': 'experimental',
  'cross-document-transitions/dom-meta': 'experimental',
  'custom-button-actions': 'experimental',
  'custom-select-picker-layouts/js-custom-select': 'experimental',
  'custom-text-decorations': 'qualified',
  'customize-scrollbar-color-and-thickness': 'experimental',
  'dark-mode': 'qualified',
  'dark-mode/js-match-media': 'experimental',
  'dark-mode-toggle': 'qualified',
  'declarative-dialog-popover-control': 'experimental',
  'declarative-dialog-popover-control/click-listener': 'qualified',
  'defer-rendering-heavy-content': 'experimental',
  'defer-work-until-scroll-ends': 'experimental',
  'deliver-optimized-decorative-images': 'qualified',
  'deprioritize-background-fetches': 'experimental',
  'detect-initial-visibility-state': 'experimental',
  'digital-signatures/js-signature': 'experimental',
  'directional-navigation-transitions': 'experimental',
  'directional-navigation-transitions/css': 'experimental',
  'drag/package-drag-drop': 'experimental',
  'drag/js-mouse-touch-drag': 'experimental',
  'dynamic-sibling-animations': 'qualified',
  'dynamic-sibling-animations/js': 'experimental',
  'dynamic-sibling-styling': 'experimental',
  'dynamic-sibling-styling/css': 'experimental',
  'efficient-background-processing': 'experimental',
  'equal-width-text-lines/package-fittext': 'experimental',
  'equal-width-text-lines/js-fittext': 'experimental',
  'export-html-media-from-canvas/package-canvas-recorder': 'experimental',
  'export-html-media-from-canvas/js-canvas-recorder': 'experimental',
  'faster-spa-view-transitions': 'experimental',
  'faster-spa-view-transitions/css': 'experimental',
  'flicker-free-client-side-ab-testing': 'experimental',
  'fluid-scaling': 'experimental',
  'form-associated-custom-elements': 'experimental',
  'form-fields-automatically-fit-contents': 'qualified',
  'full-session-analytics': 'experimental',
  'group-element-transitions': 'experimental',
  'highlight-text-ranges/package-markjs': 'experimental',
  'highlight-text-ranges/js-markjs': 'experimental',
  'icons': 'experimental',
  'ime-safe-enter-submit': 'qualified',
  'improve-next-page-load-performance/package-prefetch': 'experimental',
  'improve-next-page-load-performance/js-quicklink': 'experimental',
  'improve-text-layout-and-legibility/package-text-balance': 'qualified',
  'improve-text-layout-and-legibility/js-text-balance': 'experimental',
  'individual-transform-properties': 'experimental',
  'individual-transform-properties/standalone-chain': 'experimental',
  'individual-transform-properties/single-function-state': 'experimental',
  'interactions-in-complex-layouts/package-fastdom': 'experimental',
  'interactions-in-complex-layouts/js-fastdom': 'experimental',
  'interactive-content-reveal': 'experimental',
  'interest-triggered-action-previews/package-hoverintent': 'experimental',
  'interest-triggered-action-previews/js-hover-preview': 'experimental',
  'interest-triggered-tooltips/js-tooltip': 'qualified',
  'language-detection/package-lang-detect': 'experimental',
  'language-detection/js-lang-detect': 'experimental',
  'lazy-load-video-and-audio/js-media-observer': 'experimental',
  'lazy-load-video-and-audio/package-lazyload': 'experimental', // package.json matches are mostly lazy-loading images rather than video/audio
  'light-dismiss-a-dialog': 'qualified',
  'menu/js': 'experimental',
  'menu/dom': 'experimental',
  'navigation-drawer': 'experimental',
  'navigation-drawer/dom': 'experimental',
  'optimize-image-priority': 'experimental',
  'optimize-preload-priority': 'experimental',
  'optimize-script-priority': 'experimental',
  'parallax-scroll-effects': 'experimental',
  'persistent-app-tours/package-tour': 'experimental',
  'persistent-app-tours': 'experimental',
  'persistent-toast-notifications/js-toast': 'experimental',
  'physics-based-easing/js-spring': 'experimental',
  'platform-controls-dismiss-dialog': 'experimental',
  'position-aware-tooltips/js-popper-tooltip': 'experimental',
  'precise-text-alignment/package-capsize': 'experimental',
  'precise-text-alignment/js-capsize': 'experimental',
  'precise-text-alignment/css-leading-trim': 'experimental',
  'prerendering-custom-elements': 'experimental',
  'prevent-page-scroll-under-modal-dialog/package-scroll-lock': 'experimental',
  'prevent-page-scroll-under-modal-dialog': 'experimental',
  'prevent-page-scroll-under-modal-dialog/css': 'experimental',
  'progress': 'qualified',
  'progress-ring': 'experimental',
  'progress-ring/dom': 'experimental',
  'pull-to-reveal': 'experimental',
  'required-field-feedback/css-required-invalid': 'experimental',
  'required-field-feedback/js-blur-dirty-class': 'experimental',
  'resolution-optimized-pseudo-elements': 'experimental',
  'responsive-table/package-responsive-table': 'experimental',
  'responsive-table/css-data-label-table': 'experimental',
  'sanitize-untrusted-html/js-dompurify-innerhtml': 'qualified',
  'scoped-component-transitions': 'experimental',
  'scroll-completion-effects': 'experimental',
  'scroll-entry-exit-effects/package-scroll-reveal': 'qualified',
  'scroll-entry-exit-effects/js-scroll-reveal': 'qualified',
  'scroll-position-aware-elements/js-scroll-listener': 'experimental',
  'scroll-progress-indicator': 'experimental',
  'scroll-snap-realtime-feedback': 'experimental',
  'scroll-snap-state-sync': 'experimental',
  'scroll-target-on-load': 'experimental',
  'scrollability-affordance-hints': 'experimental',
  'scrollytelling/package-scrollytelling': 'experimental',
  'scrollytelling': 'experimental',
  'scrollspy': 'qualified',
  'scrollspy/js': 'experimental', // CSS scroll-target-group / :target-current is not yet Baseline
  'search-hidden-content': 'experimental',
  'secure-external-subresources': 'qualified',
  'select-menu-interaction/css-select-invalid': 'qualified',
  'select-menu-interaction/js-select-interaction': 'experimental',
  'size-aware-styling': 'experimental',
  'slider/js-slider': 'experimental',
  'sms-otp-form': 'experimental',
  'soft-edge-content-fade': 'qualified',
  'sort-high-precision-timestamps': 'experimental',
  'spatial-navigation': 'experimental',
  'spinner/package-spinner': 'experimental',
  'spinner': 'experimental',
  'spinner/dom': 'experimental',
  'state-aware-sticky-headers': 'experimental',
  'styling-web-components': 'qualified',
  'support-global-calendar-systems/package-calendar': 'experimental',
  'support-global-calendar-systems/js-calendar': 'experimental',
  'swipe-to-remove': 'experimental',
  'swipe-to-reveal': 'experimental',
  'switch': 'experimental',
  'validate-input-after-interaction': 'qualified',
  'validate-origins': 'experimental',
  'viewport-aware-dropdowns': 'experimental',
  'visually-stable-font-fallbacks/package-font-loader': 'experimental',
  'visually-stable-font-fallbacks/js-font-loader': 'experimental',
};

/**
 * Guides retired and removed from active scanning (no active rule module on disk).
 */
export const RETIRED_GUIDES: Readonly<Record<string, string>> = {
  'adapt-scrollbar-to-contrast-preferences':
    'No client-side legacy pattern; applicability depends on visual/semantic judgment',
  'autofill-highlight-inputs':
    'No payoff: browsers already alias :-webkit-autofill to :autofill, so the rewrite is a no-op',
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

/**
 * Individual rules retired from guides that retain other active rules on disk.
 * Keyed by `AnalyzerRule['id']`.
 */
export const RETIRED_RULES: Readonly<Record<string, string>> = {
  'child-state-based-styling':
    'Syntax-only swap: rewriting working +/~ sibling combinators into :has() is more expensive in Chromium',
};

/**
 * Combined map of retired guide IDs and retired rule IDs.
 */
export const RETIRED: Readonly<Record<string, string>> = {
  ...RETIRED_GUIDES,
  ...RETIRED_RULES,
};

export type RuleLifecycle =
  | { readonly status: 'qualified' }
  | { readonly status: 'experimental' }
  | { readonly status: 'retired'; readonly reason: string };

export interface RuleRegistryEntry {
  readonly guideId: string;
  readonly lifecycle: RuleLifecycle;
  readonly rules: readonly AnalyzerRule[];
  readonly retiredRules?: Readonly<Record<string, string>>;
}

function deriveModuleLifecycle(rules: readonly AnalyzerRule[]): RuleLifecycle {
  if (rules.some((rule) => STATUS[rule.id] === 'qualified')) {
    return { status: 'qualified' };
  }
  return { status: 'experimental' };
}

function deriveRetiredRulesForGuide(
  guideId: string,
): Readonly<Record<string, string>> | undefined {
  const entries = Object.entries(RETIRED_RULES).filter(
    ([ruleId]) => ruleId === guideId || ruleId.startsWith(`${guideId}/`),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Canonical rule registry derived from `RULE_MODULES`, `STATUS`, `RETIRED_GUIDES`, and `RETIRED_RULES`.
 */
export const RULE_REGISTRY: readonly RuleRegistryEntry[] = [
  ...RULE_MODULES.map((rules): RuleRegistryEntry => {
    const guideId = rules[0].guideId;
    const retiredRules = deriveRetiredRulesForGuide(guideId);
    return {
      guideId,
      lifecycle: deriveModuleLifecycle(rules),
      rules,
      ...(retiredRules ? { retiredRules } : {}),
    };
  }),
  ...Object.entries(RETIRED_GUIDES).map(([guideId, reason]): RuleRegistryEntry => ({
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
