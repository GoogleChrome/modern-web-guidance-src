import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const AUTOFILL_HIGHLIGHT_INPUTS_GUIDE_HASH = 'd419b7428879';

const STANDARD_AUTOFILL_REGEX = /:autofill\b/;
const WEBKIT_AUTOFILL_REGEX = /(^|[^\w-])-webkit-autofill\b/;

function getRawSelectorText(styleRule: CssRuleView): string {
  if (
    typeof styleRule === 'object' &&
    styleRule !== null &&
    'rule' in styleRule
  ) {
    const internalRule = styleRule.rule;
    if (
      typeof internalRule === 'object' &&
      internalRule !== null &&
      '_selectorText' in internalRule &&
      typeof internalRule._selectorText === 'string'
    ) {
      return internalRule._selectorText;
    }
  }
  return styleRule.selectorText;
}

const autofillHighlightInputsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['-webkit-autofill'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. Selector must target vendor-prefixed :-webkit-autofill
    const selector = getRawSelectorText(styleRule);
    if (!WEBKIT_AUTOFILL_REGEX.test(selector)) {
      return null;
    }

    // 2. If selector already includes standard :autofill, skip
    if (STANDARD_AUTOFILL_REGEX.test(selector)) {
      return null;
    }

    // 3. If stylesheet already defines standard :autofill anywhere, skip
    if (STANDARD_AUTOFILL_REGEX.test(ctx.stylesheetText)) {
      return null;
    }

    return {
      message:
        'CSS rule uses vendor-prefixed :-webkit-autofill without standard :autofill; modernize using :autofill pseudo-class for form control highlights.',
    };
  },
};

export const autofillHighlightInputsRule: AnalyzerRule = {
  id: 'autofill-highlight-inputs',
  guideId: 'autofill-highlight-inputs',
  guideHash: AUTOFILL_HIGHLIGHT_INPUTS_GUIDE_HASH,
  summary:
    'Form field autofill styling using :-webkit-autofill without standard :autofill should be modernized with native CSS :autofill pseudo-class.',
  matcher: autofillHighlightInputsCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'A CSS rule targets :-webkit-autofill to style autofilled inputs, textareas, or selects without providing standard :autofill.',
      'A CSS rule overrides default autofill background using inset box-shadow and -webkit-text-fill-color on :-webkit-autofill without standard :autofill.',
    ],
    dropWhen: [
      'The stylesheet or rule already includes the standard :autofill pseudo-class (e.g. :is(:autofill, :-webkit-autofill) or paired selectors).',
      'The selector uses CSS grid :auto-fill keyword rather than form control autofill pseudo-classes.',
      'The rule is part of a third-party autocomplete or typeahead dropdown component rather than browser form autofill styling.',
    ],
  },
};

export const autofillHighlightInputsRules: readonly AnalyzerRule[] = [
  autofillHighlightInputsRule,
];
