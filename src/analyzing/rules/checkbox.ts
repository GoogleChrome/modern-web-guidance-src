import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const CHECKED_PSEUDO_ICON_REGEX =
  /:checked\s*[+~]\s*(?:label|span)::?(?:before|after)\b/i;

const NON_CHECKBOX_SELECTOR_REGEX =
  /\b(?:radio|rating|rate|star|slider|switch|toggle|onoff|nav|menu|btn-check|toggle-btn|toggle-button|show-more|read-more)\b/i;

const DISCLOSURE_OR_TAB_WORD_REGEX =
  /\b(?:tab|tabs|accordion|collapse|collapsible|drawer|arrow|foldable|expandable)\b/i;
const EXPLICIT_CHECKBOX_BRANCH_REGEX = /(?:checkbox|\.custom-control)/i;
const INPUT_OR_SIBLING_DISCLOSURE_CLASS_REGEX =
  /(?:(?:input|\[type=['"]?checkbox['"]?\])[^\s>+~]*\.(?:accordion|tab|tabs|collapse|collapsible|drawer|arrow|foldable|expandable)\b|\.(?:accordion|tab|tabs|collapse|collapsible|drawer|arrow|foldable|expandable)\b[^\s>+~]*\[type=['"]?checkbox['"]?\]|[+~]\s*(?:label|span)[^\s>+~]*\.(?:accordion|tab|tabs|collapse|collapsible|drawer|arrow|foldable|expandable)\b)/i;

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

const TOGGLE_SWITCH_REGEX = /\b(?:switch|toggle|onoff|slider|toggle-btn|btn-check|toggle-button)\b/i;

const CUSTOM_CHECKBOX_WRAPPER_CLASS_REGEX = /\.(?:custom-checkbox|custom-control-input)\b/i;

const PSEUDO_ELEMENT_REGEX =
  /::?(?:before|after|placeholder|selection|backdrop|marker|file-selector-button)\b/i;

function extractSubjectCompoundSelector(branch: string): string {
  const trimmed = branch.trim();
  let bracketDepth = 0;
  let parenDepth = 0;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const ch = trimmed[i];
    if (ch === ']') bracketDepth++;
    else if (ch === '[') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (ch === ')') parenDepth++;
    else if (ch === '(') parenDepth = Math.max(0, parenDepth - 1);
    else if (
      bracketDepth === 0 &&
      parenDepth === 0 &&
      (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '>' || ch === '+' || ch === '~')
    ) {
      return trimmed.slice(i + 1);
    }
  }
  return trimmed;
}

function isCheckboxSubjectBranch(branch: string): boolean {
  if (isExcludedSelectorBranch(branch) || PSEUDO_ELEMENT_REGEX.test(branch)) {
    return false;
  }
  const subject = extractSubjectCompoundSelector(branch);
  if (!subject || /^(?:label|span|div|p|a|li|ul)\b/i.test(subject)) {
    return false;
  }
  if (/\[type=['"]?checkbox['"]?\]/i.test(subject)) {
    return true;
  }
  if (/^input\b/i.test(subject) && /\.checkbox\b/i.test(branch)) {
    return true;
  }
  if (CUSTOM_CHECKBOX_WRAPPER_CLASS_REGEX.test(subject)) {
    return true;
  }
  return false;
}

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

const CHECKBOX_SIBLING_ELEMENT_REGEX =
  /(?:(?:checkbox|\.custom-checkbox|\.custom-control)[^{};,]*[+~]\s*(?:label|span|i|\.[a-z_-]+)\b|\binput(?::not\([^)]*\)|:(?:checked|focus|disabled|hover))*\s*[+~]\s*(?:label|span)\b|\.checkbox-icon\b)/i;

const CHECKBOX_SIBLING_PSEUDO_BOX_REGEX =
  /(?:(?:checkbox|\.custom-checkbox|\.custom-control)[^{};,]*[+~]\s*(?:label|span|i)\s*::?(?:before|after)\b|\binput(?::not\([^)]*\)|:(?:checked|focus|disabled|hover))*\s*[+~]\s*(?:label|span)\s*::?(?:before|after)\b|\.checkbox-icon\b)/i;

function hasValidSiblingSelectorInRules(
  ctx: CssMatcherContext,
  siblingPattern: RegExp,
): boolean {
  if (!ctx.styleRules) {
    return false;
  }
  for (const rule of ctx.styleRules) {
    if (
      SR_ONLY_REGEX.test(rule.selectorText) ||
      TOGGLE_SWITCH_REGEX.test(rule.selectorText) ||
      STAR_OR_RATING_SELECTOR_REGEX.test(rule.selectorText)
    ) {
      continue;
    }
    const contentVal = rule.getPropertyValue('content') ?? '';
    if (STAR_CONTENT_REGEX.test(contentVal)) {
      continue;
    }
    const branches = rule.selectorText.split(',');
    for (const rawBranch of branches) {
      const b = rawBranch.trim();
      if (
        !isExcludedSelectorBranch(b) &&
        !TOGGLE_SWITCH_REGEX.test(b) &&
        !STAR_OR_RATING_SELECTOR_REGEX.test(b) &&
        siblingPattern.test(b)
      ) {
        return true;
      }
    }
  }
  return false;
}

export const checkboxCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [
    ['checkbox', 'Checkbox', 'custom-control-input', 'custom-checkbox', ':checked'],
    ['checkbox', 'Checkbox', 'custom-control-input', 'custom-checkbox', ':before', ':after'],
    ['checkbox', 'Checkbox', 'custom-control-input', 'custom-checkbox', 'label', 'span'],
    ['opacity:', 'appearance:', ':checked'],
    ['opacity: 0', 'opacity:0', 'appearance: none', 'appearance:none', ':before', ':after'],
  ],
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
          'CSS rule styles custom checkmark icons on sibling pseudo-elements; modernize using accent-color or appearance: none directly on the checkbox input.',
      };
    }

    // 6. Case B: Hiding or stripping native checkbox controls for a sibling custom box
    if (selectorBranches.some((b) => /\b(?:select|button|textarea)\b/i.test(b))) {
      return null;
    }

    const matchingBranches = selectorBranches.filter((b) => isCheckboxSubjectBranch(b));
    if (matchingBranches.length === 0) {
      return null;
    }

    const hidingKind = getHidingOrStrippingKind(styleRule);
    if (!hidingKind) {
      return null;
    }

    const isWrapperClass = matchingBranches.some((b) =>
      CUSTOM_CHECKBOX_WRAPPER_CLASS_REGEX.test(extractSubjectCompoundSelector(b)),
    );
    const siblingPattern =
      hidingKind === 'opacity' ? CHECKBOX_SIBLING_ELEMENT_REGEX : CHECKBOX_SIBLING_PSEUDO_BOX_REGEX;

    // Require an actual non-excluded checkbox sibling custom-box rule in ctx.styleRules
    const hasVisualReplacement =
      isWrapperClass || hasValidSiblingSelectorInRules(ctx, siblingPattern);
    if (!hasVisualReplacement) {
      return null;
    }

    return {
      message:
        'CSS rule hides or strips native checkbox appearance for a sibling replacement; modernize using accent-color or appearance: none directly on the checkbox input.',
    };
  },
};

export const checkboxRule: AnalyzerRule = {
  id: 'checkbox',
  guideId: 'checkbox',
  guideHash: '43313f5eb538',
  summary:
    'Hiding native checkboxes with opacity: 0 or drawing replacement boxes on sibling label/span pseudo-elements should be modernized with native accent-color or appearance: none directly on <input type="checkbox">.',
  matcher: checkboxCssMatcher,
  verifierRubric: {
    keepWhen: [
      'The CSS rule hides or strips a checkbox input (opacity: 0 or appearance: none on input[type="checkbox"], .custom-checkbox, or .custom-control-input) to delegate box rendering to a sibling (+ label, ~ label, + span, ::before, ::after) rather than styling the <input> directly.',
      'The CSS rule styles custom checkbox checkmark icons on sibling pseudo-elements (:checked + label::before / :checked + span::before) without using accent-color or direct input appearance: none.',
    ],
    dropWhen: [
      'Modern custom checkboxes applying appearance: none directly on input[type="checkbox"] (styling &::before / :indeterminate::before on the input itself with no fake sibling box).',
      'Bare utility rules setting opacity: 0 or form resets stripping appearance across inputs with no sibling custom-box visual replacement.',
      'Custom toggle-switch components (role="switch", .switch, .toggle), star ratings, or CSS-only accordion/tab/disclosure hacks using :checked + label.',
      'The stylesheet already defines standard accent-color property declarations or guards the rule inside @supports (accent-color: ...).',
      'The selector is an accessible screen-reader utility class (.sr-only or .visually-hidden) that preserves keyboard accessibility and element geometry.',
    ],
  },
};

export default [checkboxRule] satisfies readonly AnalyzerRule[];
