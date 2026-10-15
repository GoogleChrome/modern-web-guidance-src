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
    guideId: 'customize-scrollbar-color-and-thickness',
    guideHash: '6797d5c85622',
    classification: 'detectable',
    brownfieldTarget:
      'Vendor-prefixed ::-webkit-scrollbar pseudo-elements should be modernized using standard CSS scrollbar-color and scrollbar-width properties.',
    reason:
      'Vendor-prefixed scrollbar pseudo-elements are deterministically detectable via CSS stylesheet AST.',
  },
  {
    guideId: 'individual-transform-properties',
    guideHash: '42af807594e8',
    classification: 'detectable',
    brownfieldTarget:
      'Compound CSS transform properties combining single operations (e.g. transform: rotate(...) or transform: scale(...)) should use modern individual transform properties (rotate, scale, translate).',
    reason:
      'Isolated single transform functions in CSS stylesheets and animations are deterministically detectable via CSS scanner.',
  },
  {
    guideId: 'child-state-based-styling',
    guideHash: '70dc57b74e35',
    classification: 'detectable',
    brownfieldTarget:
      'Pre-modern sibling combinator hacks (e.g. input:checked ~ label) or JavaScript class toggling simulating parent-child styling should be modernized using the CSS :has() relational pseudo-class.',
    reason:
      'Sibling combinator selectors conditioned on child pseudo-classes are statically detectable in CSS.',
  },
  {
    guideId: 'accessible-error-announcement',
    guideHash: 'b89c17bead92',
    classification: 'detectable',
    brownfieldTarget:
      'Flag manual error container DOM injection, innerHTML alert insertions, or imperative error text toggling lacking role="alert" or aria-live="polite".',
    reason:
      'Imperative error message DOM nodes and alert containers missing live region attributes are detectable via DOM and AST scanners.',
  },
  {
    guideId: 'break-up-long-tasks',
    guideHash: '18330b20e496',
    classification: 'detectable',
    brownfieldTarget:
      'Manual main thread yielding via setTimeout(..., 0), setImmediate, or MessageChannel postMessage should be modernized with scheduler.yield() or scheduler.postTask().',
    reason:
      'Timer and zero-delay message channel yielding patterns are deterministically detectable via JS AST matching.',
  },
  {
    guideId: 'ime-safe-enter-submit',
    guideHash: 'bd5e1488af32',
    classification: 'detectable',
    brownfieldTarget:
      'Keydown event listeners checking for Enter key submission without guarding against IME composition (isComposing or keyCode 229) should check e.isComposing to prevent premature form submission during CJK/IME input.',
    reason:
      'Keyboard event listeners checking Enter key without isComposing guards are statically detectable in JS/TS AST.',
  },
  {
    guideId: 'stack-drill-down',
    guideHash: 'c3b9a4677d1b',
    classification: 'detectable',
    brownfieldTarget:
      'Manual regex parsing of Error.prototype.stack or arguments.callee caller traversal to identify calling functions or file locations should be modernized with native Error.captureStackTrace or standard CallSite inspection.',
    reason:
      'Error stack string splitting and caller traversal expressions are deterministically detectable in AST.',
  },
  {
    guideId: 'calculate-event-differentials',
    guideHash: 'ee7112b330c4',
    classification: 'detectable',
    brownfieldTarget:
      'Manual Date subtraction, getTime() arithmetic, or millisecond division to compute durations or intervals between timestamps should be modernized using Temporal API (Temporal.Duration / Temporal.Instant).',
    reason:
      'Date arithmetic expressions and getTime difference calculations are statically detectable via AST.',
  },
  {
    guideId: 'resilient-context-menus-and-nested-dropdowns',
    guideHash: '9152c0b12710',
    classification: 'detectable',
    brownfieldTarget:
      'Legacy Bootstrap dropdown triggers should be modernized with native popover and CSS Anchor Positioning.',
    reason:
      'Bootstrap dropdown toggle attributes and imperative Popper/dropdown positioning calls are detectable via DOM and AST scanners.',
  },
  {
    guideId: 'form-fields-automatically-fit-contents',
    guideHash: '54a6341c988f',
    classification: 'detectable',
    brownfieldTarget:
      'JavaScript auto-expanding textarea hacks measuring scrollHeight, hidden mirror elements, or CSS width/height hacks should be modernized using CSS field-sizing: content.',
    reason:
      'ScrollHeight input measurement listeners and textarea auto-resize helpers are detectable via JS/TS AST.',
  },
  {
    guideId: 'brand-consistent-forms',
    guideHash: 'a040352d2507',
    classification: 'detectable',
    brownfieldTarget:
      'Custom form control styling hacks using hidden native checkboxes/radios with CSS sibling hacks (e.g. input[type="checkbox"] + span) or heavy UI component libraries should use standard CSS accent-color.',
    reason:
      'Visually hidden inputs followed by styled custom indicator sibling elements are deterministically detectable in CSS.',
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
