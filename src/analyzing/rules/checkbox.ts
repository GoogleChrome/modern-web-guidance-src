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

const SR_ONLY_REGEX = /\.(?:sr-only|visually-hidden)\b/i;

function hasHidingOrStrippingDeclaration(styleRule: CssRuleView): boolean {
  const displayVal = (styleRule.getPropertyValue('display') ?? '').trim().toLowerCase();
  if (displayVal === 'none') {
    return true;
  }

  const visibilityVal = (styleRule.getPropertyValue('visibility') ?? '').trim().toLowerCase();
  if (visibilityVal === 'hidden') {
    return true;
  }

  const opacityVal = (styleRule.getPropertyValue('opacity') ?? '').trim();
  const positionVal = (styleRule.getPropertyValue('position') ?? '').trim().toLowerCase();
  if ((opacityVal === '0' || opacityVal === '0%') && positionVal === 'absolute') {
    return true;
  }

  const appearanceVal = (styleRule.getPropertyValue('appearance') ?? '').trim().toLowerCase();
  const webkitAppearanceVal = (
    styleRule.getPropertyValue('-webkit-appearance') ?? ''
  ).trim().toLowerCase();
  if (appearanceVal === 'none' || webkitAppearanceVal === 'none') {
    return true;
  }

  return false;
}

const checkboxCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['checkbox', ':checked'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already defines accent-color, skip
    if (ctx.stylesheetHasProperty('accent-color')) {
      return null;
    }

    // 2. Skip screen-reader accessibility utility classes
    if (SR_ONLY_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    // 3. Case A: Custom checkmark icon on sibling pseudo-elements
    if (CHECKED_PSEUDO_ICON_REGEX.test(styleRule.selectorText)) {
      return {
        message:
          'CSS rule styles custom checkmark icons on sibling pseudo-elements; modernize using accent-color or appearance: none.',
      };
    }

    // 4. Case B: Hiding or stripping native checkbox controls
    const matchesTarget = CHECKBOX_TARGET_PATTERNS.some((pattern) =>
      pattern.test(styleRule.selectorText),
    );
    if (!matchesTarget) {
      return null;
    }

    if (!hasHidingOrStrippingDeclaration(styleRule)) {
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
    'Hiding or stripping native checkboxes with display: none, opacity: 0, or custom sibling pseudo-elements should be replaced with native accent-color.',
  matcher: checkboxCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule targets checkboxes (input[type="checkbox"], .checkbox input, .custom-checkbox, .custom-control-input) and hides or strips native appearance using display: none, opacity: 0, visibility: hidden, or appearance: none.',
      'The CSS rule styles custom checkbox checkmark icons on sibling pseudo-elements (:checked + label::before / :checked + span::before) without using accent-color.',
    ],
    dropWhen: [
      'The stylesheet already defines standard accent-color property declarations.',
      'The selector is an accessible screen-reader utility class (.sr-only or .visually-hidden) that preserves keyboard accessibility and element geometry.',
      'The rule is within a fallback stylesheet guarded by @supports (accent-color: red).',
    ],
  },
};

export const checkboxRules: readonly AnalyzerRule[] = [checkboxRule];
