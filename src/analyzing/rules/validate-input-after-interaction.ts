import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const VALIDATE_INPUT_AFTER_INTERACTION_GUIDE_HASH = '039f2593da67';

const INPUT_OR_TEXTAREA_INVALID_SELECTOR_REGEX =
  /(?:^|[\s>+~,])(?:input|textarea)(?:[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*:invalid(?:[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*(?:\s*$|(?=\s*(?:[,+~]|::)))/i;

const REQUIRED_INVALID_SELECTOR_REGEX =
  /(?:^|[\s>+~,])(?:input|textarea|[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*(?::required|\[required(?:=[^\]]*)?\])(?:[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*:invalid\b|(?:^|[\s>+~,])(?:input|textarea|[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*:invalid(?:[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*(?::required|\[required(?:=[^\]]*)?\])/i;

const TOUCHED_DIRTY_INVALID_SELECTOR_REGEX =
  /(?:[.#[][a-zA-Z0-9_-]*\b(?:is-|ng-|data-)?(?:touched|dirty|interacted|was-validated)\b[^,]*:invalid\b)|(?::invalid\b[^,]*[.#[][a-zA-Z0-9_-]*\b(?:is-|ng-|data-)?(?:touched|dirty|interacted|was-validated)\b)/i;

const TOUCHED_OR_VALIDATED_GATE_REGEX =
  /(?:\.(?:was-validated|is-validated|validated|touched|is-touched|ng-touched|dirty|is-dirty|ng-dirty|interacted|submitted|submission-attempted)\b|\bform\.invalid\b|\[data-(?:touched|dirty|interacted|validated)\b)/i;

const SELECT_INVALID_SELECTOR_REGEX =
  /(?:^|[\s>+~,])select(?:[.#][a-zA-Z0-9_-]+|\[[^\]]*\]|:[a-zA-Z-]+)*:invalid\b/i;

const PLACEHOLDER_PSEUDO_ELEMENT_REGEX =
  /(?:::|:-)(?:webkit-input-|moz-|ms-input-)?placeholder\b/i;

const VISUAL_ERROR_PROPERTIES = new Set([
  'border',
  'border-color',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'background',
  'background-color',
  'background-image',
  'color',
  'box-shadow',
  '-webkit-box-shadow',
  '-moz-box-shadow',
  'outline',
  'outline-color',
]);

const SIBLING_REVEAL_PROPERTIES = new Set([
  'display',
  'visibility',
  'opacity',
]);

const RESET_PROP_VALUES = new Set([
  'none',
  '0',
  '0px',
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
  'revert',
  'normal',
  'auto',
]);

function normalizeCssDeclValue(raw: string): string {
  return raw.replace(/\s*!important\s*$/i, '').trim().toLowerCase();
}

function hasVisualErrorOrSiblingReveal(
  styleRule: CssRuleView,
  selectorWithoutNot: string,
): boolean {
  const hasSiblingCombinatorAfterInvalid = /:invalid\b[^,]*[+~]/.test(
    selectorWithoutNot,
  );

  return styleRule.declarations.some((d) => {
    const prop = d.property.toLowerCase();
    const isVisualProp = VISUAL_ERROR_PROPERTIES.has(prop);
    const isSiblingRevealProp =
      hasSiblingCombinatorAfterInvalid && SIBLING_REVEAL_PROPERTIES.has(prop);
    if (!isVisualProp && !isSiblingRevealProp) {
      return false;
    }
    const val = normalizeCssDeclValue(d.value);
    return Boolean(val && !RESET_PROP_VALUES.has(val));
  });
}

export const validateInputAfterInteractionCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [':invalid'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    const selector = styleRule.selectorText;
    if (
      selector.includes(':user-invalid') ||
      ctx.stylesheetText.includes(':user-invalid')
    ) {
      return null;
    }

    if (
      styleRule.parentAtRule &&
      styleRule.parentAtRule.includes(':user-invalid')
    ) {
      return null;
    }

    if (
      TOUCHED_OR_VALIDATED_GATE_REGEX.test(selector) ||
      PLACEHOLDER_PSEUDO_ELEMENT_REGEX.test(selector)
    ) {
      return null;
    }

    const selectorWithoutNot = selector.replace(/:not\([^)]*\)/gi, '');

    if (!INPUT_OR_TEXTAREA_INVALID_SELECTOR_REGEX.test(selectorWithoutNot)) {
      return null;
    }

    // Carve out rules owned by required-field-feedback or select-menu-interaction,
    // as well as shared :valid + :invalid layout rules.
    if (
      REQUIRED_INVALID_SELECTOR_REGEX.test(selectorWithoutNot) ||
      TOUCHED_DIRTY_INVALID_SELECTOR_REGEX.test(selectorWithoutNot) ||
      SELECT_INVALID_SELECTOR_REGEX.test(selectorWithoutNot) ||
      /:valid\b/i.test(selectorWithoutNot)
    ) {
      return null;
    }

    if (!hasVisualErrorOrSiblingReveal(styleRule, selectorWithoutNot)) {
      return null;
    }

    if (/:not\(\s*:(?:focus|placeholder-shown)\s*\)/i.test(selector)) {
      return {
        message:
          'CSS selector combines :not(:focus) or :not(:placeholder-shown) with :invalid to defer validation styling; modernize with native :user-invalid.',
      };
    }

    return {
      message:
        'CSS selector uses input:invalid or textarea:invalid which applies error styling before user interaction is complete; modernize with :user-invalid.',
    };
  },
};

export const validateInputAfterInteractionRule: AnalyzerRule = {
  id: 'validate-input-after-interaction',
  guideId: 'validate-input-after-interaction',
  guideHash: VALIDATE_INPUT_AFTER_INTERACTION_GUIDE_HASH,
  summary:
    'CSS input:invalid and textarea:invalid error-styling rules (including :not(:focus):invalid and :not(:placeholder-shown):invalid workarounds) without :user-invalid should be modernized with :user-invalid so error feedback appears only after user interaction.',
  matcher: validateInputAfterInteractionCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule uses input:invalid or textarea:invalid (or :not(:focus):invalid / :not(:placeholder-shown):invalid) without :user-invalid to apply error styling (border, border-color, background-color, error text color, or non-none outline/box-shadow) or to reveal an adjacent/sibling error message element.',
    ],
    dropWhen: [
      'The stylesheet already uses :user-invalid or guards :invalid inside @supports not selector(:user-invalid).',
      'The rule only resets browser default :invalid styles (such as box-shadow: none or outline: none with no error border, background, or color).',
      'The selector is already gated by a post-interaction class (.was-validated, .touched, .dirty, .submitted), combines :required:invalid (owned by required-field-feedback), or targets select:invalid (owned by select-menu-interaction).',
    ],
  },
};

export default [
  validateInputAfterInteractionRule,
] satisfies readonly AnalyzerRule[];
