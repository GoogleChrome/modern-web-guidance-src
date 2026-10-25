import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const CHECKBOX_TARGET_PATTERNS = [
  /input\[type=['"]?checkbox['"]?\]/i,
  /\[type=['"]?checkbox['"]?\]/i,
  /\.checkbox\b[^{,]*input/i,
  /\binput\b[^{,]*\.checkbox\b/i,
  /\.custom-checkbox\b/i,
  /\.custom-control-input\b/i,
  /input:checked\s*[+~]\s*(?:label|span)\b/i,
];

const CHECKED_PSEUDO_ICON_REGEX =
  /:checked\s*[+~]\s*(?:label|span)::(?:before|after)\b/i;

const NON_CHECKBOX_SELECTOR_REGEX =
  /\b(?:radio|rating|rate|star|slider|switch|toggle|onoff|nav|menu|panel|accordion)\b/i;

const STAR_CONTENT_REGEX = /(?:★|☆|\\2605|\\2606|\\f005|\\f006)/i;
const STAR_OR_RATING_SELECTOR_REGEX = /\b(?:star|rating|rate)\b/i;

const SR_ONLY_REGEX = /\.(?:sr-only|visually-hidden)\b/i;

function hasHidingOrStrippingDeclaration(styleRule: CssRuleView): boolean {
  const opacityVal = (styleRule.getPropertyValue('opacity') ?? '').trim();
  if (opacityVal === '0' || opacityVal === '0%') {
    return true;
  }

  // appearance: none directly on an input is the modern technique recommended by the checkbox guide!
  // Only flag appearance: none on custom checkbox replacement class selectors (e.g. .custom-checkbox)
  const isInputSelector = /\binput\b/i.test(styleRule.selectorText);
  if (!isInputSelector) {
    const appearanceVal = (styleRule.getPropertyValue('appearance') ?? '').trim().toLowerCase();
    const webkitAppearanceVal = (
      styleRule.getPropertyValue('-webkit-appearance') ?? ''
    ).trim().toLowerCase();
    if (appearanceVal === 'none' || webkitAppearanceVal === 'none') {
      return true;
    }
  }

  return false;
}

const TOGGLE_SWITCH_REGEX = /\b(?:switch|toggle)\b/i;

const SIBLING_CUSTOM_BOX_REGEX =
  /(?:[+~]\s*(?:label|span)|::?(?:before|after)|\.custom-checkbox|\.custom-control|:indeterminate)/i;

export const checkboxCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['checkbox', ':checked', ':indeterminate'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already defines accent-color, skip
    if (ctx.stylesheetHasProperty('accent-color')) {
      return null;
    }

    // 2. Skip screen-reader accessibility utility classes
    if (SR_ONLY_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    // 3. Skip custom toggle-switch components (.switch, .toggle, role="switch")
    if (TOGGLE_SWITCH_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    // 4. Skip star rating widgets (.star, .rating, .rate, or Unicode star content)
    if (STAR_OR_RATING_SELECTOR_REGEX.test(styleRule.selectorText)) {
      return null;
    }
    const contentProperty = styleRule.getPropertyValue('content') ?? '';
    if (STAR_CONTENT_REGEX.test(contentProperty)) {
      return null;
    }

    // 5. Case A: Custom checkmark icon on sibling pseudo-elements
    if (CHECKED_PSEUDO_ICON_REGEX.test(styleRule.selectorText)) {
      if (NON_CHECKBOX_SELECTOR_REGEX.test(styleRule.selectorText)) {
        return null;
      }
      return {
        message:
          'CSS rule styles custom checkmark icons on sibling pseudo-elements; modernize using accent-color or appearance: none.',
      };
    }

    // 5. Case B: Hiding or stripping native checkbox controls (R32.4)
    const matchesTarget = CHECKBOX_TARGET_PATTERNS.some((pattern) =>
      pattern.test(styleRule.selectorText),
    );
    if (!matchesTarget) {
      return null;
    }

    if (NON_CHECKBOX_SELECTOR_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    if (!hasHidingOrStrippingDeclaration(styleRule)) {
      return null;
    }

    // Require sibling/custom-box selector, custom checkmark pseudo-element, or :indeterminate styling in stylesheet
    const hasVisualReplacement =
      SIBLING_CUSTOM_BOX_REGEX.test(styleRule.selectorText) ||
      SIBLING_CUSTOM_BOX_REGEX.test(ctx.stylesheetText);
    if (!hasVisualReplacement) {
      return null;
    }

    return {
      message:
        'CSS rule hides or strips native checkbox appearance; modernize using accent-color or appearance: none.',
    };
  },
};

export const checkboxRule: AnalyzerRule = {
  id: 'checkbox',
  guideId: 'checkbox',
  guideHash: '1b9c35459943',
  summary:
    'Hiding or stripping native checkboxes with opacity: 0, appearance: none, or custom sibling pseudo-elements should be replaced with native accent-color.',
  matcher: checkboxCssMatcher,
  verifierRubric: {
    keepWhen: [
      'The CSS rule targets checkboxes (input[type="checkbox"], .custom-checkbox, .custom-control-input) and hides or strips native appearance (opacity: 0, appearance: none) alongside sibling custom-box selectors (+ label, ~ label, + span, ::before, ::after) or custom checkbox styling.',
      'The CSS rule styles custom checkbox checkmark icons on sibling pseudo-elements (:checked + label::before / :checked + span::before) without using accent-color.',
    ],
    dropWhen: [
      'Bare utility rules setting display: none or opacity: 0 on inputs with no sibling/custom-box visual replacement.',
      'Custom toggle-switch components (role="switch", .switch, .toggle) designed as sliding toggles rather than standard checkboxes.',
      'Full design-system form resets that strip appearance across inputs without custom checkmark pseudo-elements or indeterminate styling.',
      'The stylesheet already defines standard accent-color property declarations.',
      'The selector is an accessible screen-reader utility class (.sr-only or .visually-hidden) that preserves keyboard accessibility and element geometry.',
      'The rule is within a fallback stylesheet guarded by @supports (accent-color: red).',
    ],
  },
};

export const checkboxRules: readonly AnalyzerRule[] = [checkboxRule];
