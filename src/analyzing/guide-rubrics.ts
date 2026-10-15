import type { Gate0Entry } from './schema.ts';

export const PILOT_GATE0_ENTRIES: readonly Gate0Entry[] = [
  {
    guideId: 'autofill-sign-in-form',
    guideHash: '93a1df14cafc',
    classification: 'detectable',
    brownfieldTarget:
      'Flag password inputs lacking autocomplete attribute or using autocomplete="off" on credentials, preventing browser autofill and password manager integrations.',
    reason:
      'Universal web pattern; password inputs lacking autocomplete are deterministically detectable via HTML and JSX scanners.',
  },
  {
    guideId: 'animate-to-intrinsic-sizes',
    guideHash: '290b14ca7ee4',
    classification: 'detectable',
    brownfieldTarget:
      'Flag JavaScript height measurement or max-height hacks: e.g. CSS transition: max-height (0 to 500px/1000px) or reading scrollHeight/offsetHeight to animate accordion expansion before calc-size() and interpolate-size: allow-keywords.',
    reason:
      'Ubiquitous CSS max-height transition hack and JS scrollHeight measurement accordion logic detectable via CSSOM and AST.',
  },
  {
    guideId: 'declarative-dialog-popover-control',
    guideHash: '87f6a7ad8849',
    classification: 'detectable',
    brownfieldTarget:
      'Flag imperative button click listeners calling .showModal(), or jQuery Bootstrap $(...).modal("show"), before declarative Invoker Commands (commandfor, command="show-modal") and popovertarget.',
    reason:
      'Imperative button click triggers calling dialog modal methods or Bootstrap modal plugins are statically detectable in AST.',
  },
  {
    guideId: 'animate-element-entry-exit',
    guideHash: '21cc4d2bf21c',
    classification: 'detectable',
    brownfieldTarget:
      'Flag imperative animation libraries and hacks: e.g. jQuery .fadeIn(), .fadeOut(), .slideDown(), .slideUp(), transitionend/animationend listeners setting display: none, or manual setTimeout/requestAnimationFrame display toggling to animate element entry/exit before CSS @starting-style and transition-behavior: allow-discrete.',
    reason:
      'Transition/animation end listeners coordinating display: none removal and setTimeout class toggles are detectable in AST.',
  },
  {
    guideId: 'coordinate-global-events',
    guideHash: '253dec2c89a2',
    classification: 'detectable',
    brownfieldTarget:
      'Flag legacy timezone libraries and manual offset math: e.g. moment-timezone, date-fns-tz, Luxon timezone conversions, or manual getTimezoneOffset() arithmetic before standard Temporal.ZonedDateTime.',
    reason:
      'Timezone library imports and Date.prototype.getTimezoneOffset() call expressions are cleanly detectable via AST and package dependencies.',
  },
  {
    guideId: 'navigation-drawer',
    guideHash: '3481f6feb2e8',
    classification: 'ui-recipe-multi-part',
    brownfieldTarget:
      'Flag custom JS touch drag handling (touchstart/touchmove/touchend), backdrop overlays, and manual focus trapping for sidebars/drawers before native popover, CSS scroll-driven animations, and inert.',
    reason:
      'Complex multi-file UI recipe spanning gesture math, backdrop DOM, and focus trapping without a single reliable static hook; isolated in UI Recipe bucket per D-005.',
  },
  {
    guideId: 'language-model',
    guideHash: 'a403caa42655',
    classification: 'skip-no-old-way',
    brownfieldTarget:
      'Brand-new platform capability (Prompt API / Gemini Nano) without a legacy web platform workaround.',
    reason:
      'Brand-new browser capability with 0 hits in corpus and negligible web presence; no pre-standard workaround to detect.',
  },
];

export const BROWNFIELD_GUIDE_RUBRIC: Readonly<Record<string, string>> = {
  'child-state-based-styling':
    'Flag pre-modern workarounds for styling based on child state: e.g. CSS sibling hacks (`input:checked ~ .label`, `input:checked + .label`), or JS listeners toggling modifier classes on parent containers because CSS lacked `:has()`.',
  'shadow-dom':
    'Flag pre-modern client-side HTML templating workarounds: e.g. `<script type="text/template">`, `<script type="text/html">`, `<script type="text/x-handlebars-template">`, or manual DOM cloning used to hold markup templates before native `<template>` and Web Components.',
  'customize-scrollbar-color-and-thickness':
    'Flag pre-standard scrollbar styling: e.g. `::-webkit-scrollbar`, `::-webkit-scrollbar-thumb`, `::-webkit-scrollbar-track` vendor pseudo-elements used to color or size scrollbars before standard `scrollbar-width` and `scrollbar-color`.',
  'detect-initial-visibility-state':
    'Flag pre-standard page visibility checks: e.g. `document.webkitHidden`, `document.msHidden`, `document.hidden`, or manual visibility polling before modern VisibilityStateEntry and standard Visibility API.',
  'branded-select-styling':
    'Flag custom dropdown replacement libraries: e.g. jQuery Chosen (`.chosen()`), Select2, or custom div-based select widgets built because native `<select>` was not styleable.',
  'animate-element-entry-exit':
    'Flag imperative animation libraries and hacks: e.g. jQuery `.fadeIn()`, `.fadeOut()`, `.slideDown()`, `.slideUp()`, `transitionend`/`animationend` listeners setting `display: none`, or manual setTimeout/rAF display toggling to animate element entry/exit before CSS `@starting-style` and `transition-behavior: allow-discrete`.',
  'calculate-event-differentials':
    'Flag manual Date subtraction and timestamp math: e.g. `(d1 - d2)`, `d1.getTime() - d2.getTime()`, millisecond division math before the Temporal API.',
  'capture-location-agnostic-data':
    'Flag using timezone-dependent `Date` objects or ISO strings for location-agnostic calendar dates/birthdays before Temporal.PlainDate.',
  'break-up-long-tasks':
    'Flag manual event loop yielding hacks: e.g. `setTimeout(..., 0)`, `setImmediate()`, or rAF-then-setTimeout before `scheduler.yield()`.',
  'resilient-context-menus-and-nested-dropdowns':
    'Flag floating UI libraries or manual tethering: e.g. Popper.js, Floating UI, Bootstrap dropdown JS, or manual coordinate calculations before Popover and Anchor Positioning.',
  'animate-to-intrinsic-sizes':
    'Flag JavaScript height measurement or max-height hacks: e.g. CSS `transition: max-height` (0 to 500px/1000px) or reading `scrollHeight`/`offsetHeight` to animate accordion expansion before `calc-size()` and `interpolate-size: allow-keywords`.',
  'schedule-tasks-by-priority':
    'Flag manual task prioritization hacks: e.g. setTimeout(0) queues or priority arrays before `scheduler.postTask()`. (Do NOT flag MessageChannel used for real cross-context message passing).',
  'autofill-sign-in-form':
    'Flag password inputs lacking `autocomplete` attribute or using `autocomplete="off"` on credentials, preventing browser autofill and password manager integrations.',
  'declarative-dialog-popover-control':
    'Flag imperative button click listeners calling `.showModal()`, or jQuery Bootstrap `$(...).modal("show")`, before declarative Invoker Commands (`commandfor`, `command="show-modal"`) and `popovertarget`.',
  'coordinate-global-events':
    'Flag legacy timezone libraries and manual offset math: e.g. `moment-timezone`, `date-fns-tz`, Luxon timezone conversions, or manual `getTimezoneOffset()` arithmetic before standard `Temporal.ZonedDateTime`.',
  'navigation-drawer':
    'Flag custom JS touch drag handling (`touchstart`/`touchmove`/`touchend`), backdrop overlays, and manual focus trapping for sidebars/drawers before native `popover`, CSS scroll-driven animations, and `inert`.',
  'language-model':
    'Brand-new platform capability (Prompt API / Gemini Nano) without a legacy web platform workaround.',
};

export function getGate0Entry(guideId: string): Gate0Entry | undefined {
  return PILOT_GATE0_ENTRIES.find((entry) => entry.guideId === guideId);
}

export function getBrownfieldRubric(guideId: string): string | undefined {
  return BROWNFIELD_GUIDE_RUBRIC[guideId];
}
