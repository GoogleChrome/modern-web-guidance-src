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
  /\b(?:radio|rating|rate|star|slider|switch|toggle|onoff|nav|menu|btn-check|toggle-btn|toggle-button|show-more|read-more)\b/i;

const DISCLOSURE_OR_TAB_WORD_REGEX = /\b(?:tab|tabs|accordion|collapse|collapsible|drawer)\b/i;
const EXPLICIT_CHECKBOX_BRANCH_REGEX = /(?:checkbox|\.custom-control)/i;
const INPUT_OR_SIBLING_DISCLOSURE_CLASS_REGEX =
  /(?:input|\[type=['"]?checkbox['"]?\])[^\s>+~]*\.(?:accordion|tab|tabs|collapse|collapsible|drawer)\b|[+~]\s*(?:label|span)[^\s>+~]*\.(?:accordion|tab|tabs|collapse|collapsible|drawer)\b/i;

function isExcludedSelectorBranch(branch: string): boolean {
  if (NON_CHECKBOX_SELECTOR_REGEX.test(branch)) {
    return true;
  }
  if (INPUT_OR_SIBLING_DISCLOSURE_CLASS_REGEX.test(branch)) {
    return true;
  }
  if (!EXPLICIT_CHECKBOX_BRANCH_REGEX.test(branch) && DISCLOSURE_OR_TAB_WORD_REGEX.test(branch)) {
    return true;
  }
  return false;
}

const STAR_CONTENT_REGEX = /(?:★|☆|\\2605|\\2606|\\f005|\\f006)/i;
const STAR_OR_RATING_SELECTOR_REGEX = /\b(?:star|rating|rate)\b/i;

const SR_ONLY_REGEX = /\.(?:sr-only|visually-hidden)\b/i;

function getHidingOrStrippingKind(styleRule: CssRuleView): 'opacity' | 'appearance' | null {
  const opacityVal = (styleRule.getPropertyValue('opacity') ?? '').trim();
  if (opacityVal === '0' || opacityVal === '0%') {
    return 'opacity';
  }

  const appearanceVal = (styleRule.getPropertyValue('appearance') ?? '').trim().toLowerCase();
  const webkitAppearanceVal = (
    styleRule.getPropertyValue('-webkit-appearance') ?? ''
  ).trim().toLowerCase();
  if (appearanceVal === 'none' || webkitAppearanceVal === 'none') {
    return 'appearance';
  }

  return null;
}

const TOGGLE_SWITCH_REGEX = /\b(?:switch|toggle|onoff|slider|toggle-btn|btn-check|toggle-button)\b/i;

const CUSTOM_CHECKBOX_WRAPPER_CLASS_REGEX = /\.(?:custom-checkbox|custom-control-input)\b/i;

const CHECKBOX_SIBLING_ELEMENT_REGEX =
  /(?:(?:checkbox|\.custom-checkbox|\.custom-control)[^{};,]*[+~]\s*(?:label|span|i|\.[a-z_-]+)\b|\binput(?::not\([^)]*\)|:(?:checked|focus|disabled|hover))*\s*[+~]\s*(?:label|span)\b|\.checkbox-icon\b)/i;

const CHECKBOX_SIBLING_PSEUDO_BOX_REGEX =
  /(?:(?:checkbox|\.custom-checkbox|\.custom-control)[^{};,]*[+~]\s*(?:label|span|i)\s*::?(?:before|after)\b|\binput(?::not\([^)]*\)|:(?:checked|focus|disabled|hover))*\s*[+~]\s*(?:label|span)\s*::?(?:before|after)\b|\.checkbox-icon\b)/i;

export const checkboxCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['checkbox', ':checked', ':indeterminate'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already defines accent-color, skip
    if (ctx.stylesheetHasProperty('accent-color')) {
      return null;
    }

    if (styleRule.parentAtRule?.toLowerCase().includes('accent-color')) {
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

    const selectorBranches = styleRule.selectorText.split(',').map((s) => s.trim());

    // 5. Case A: Custom checkmark icon on sibling pseudo-elements
    const hasCheckboxIconBranch = selectorBranches.some(
      (b) => CHECKED_PSEUDO_ICON_REGEX.test(b) && !isExcludedSelectorBranch(b),
    );
    if (hasCheckboxIconBranch) {
      return {
        message:
          'CSS rule styles custom checkmark icons on sibling pseudo-elements; modernize using accent-color or appearance: none.',
      };
    }

    // 6. Case B: Hiding or stripping native checkbox controls for a sibling custom box
    if (selectorBranches.some((b) => /\b(?:select|button|textarea)\b/i.test(b))) {
      return null;
    }

    const matchingBranches = selectorBranches.filter(
      (b) =>
        CHECKBOX_TARGET_PATTERNS.some((pattern) => pattern.test(b)) && !isExcludedSelectorBranch(b),
    );
    if (matchingBranches.length === 0) {
      return null;
    }

    const hidingKind = getHidingOrStrippingKind(styleRule);
    if (!hidingKind) {
      return null;
    }

    const isWrapperClass = matchingBranches.some((b) => CUSTOM_CHECKBOX_WRAPPER_CLASS_REGEX.test(b));
    const siblingPattern =
      hidingKind === 'opacity' ? CHECKBOX_SIBLING_ELEMENT_REGEX : CHECKBOX_SIBLING_PSEUDO_BOX_REGEX;

    // Require an actual checkbox sibling custom-box selector (not direct &::before / :indeterminate on the <input> itself, which is the modern appearance: none pattern)
    const hasVisualReplacement =
      isWrapperClass ||
      siblingPattern.test(styleRule.selectorText) ||
      siblingPattern.test(ctx.stylesheetText);
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
  guideHash: '43313f5eb538',
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
