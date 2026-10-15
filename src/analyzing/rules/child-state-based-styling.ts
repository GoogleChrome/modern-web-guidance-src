import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const SIBLING_STATE_COMBINATOR_REGEX =
  /(?::(checked|focus|focus-visible|focus-within|valid|invalid)|:not\(\s*:(checked|focus|focus-visible|focus-within|valid|invalid)\s*\))\s*[+~]\s*\S+/i;

const childStateBasedStylingCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [':checked', ':focus', ':valid', ':invalid'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already leverages modern :has(), skip
    if (ctx.stylesheetHasValue(':has(')) {
      return null;
    }

    // 2. Selector must use a sibling combinator (+ or ~) following an input state pseudo-class
    if (!SIBLING_STATE_COMBINATOR_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    return {
      message:
        'CSS rule uses sibling combinators (+ or ~) following input state pseudo-classes to style adjacent elements; modernize using container :has() selector.',
    };
  },
};

export const childStateBasedStylingRule: AnalyzerRule = {
  id: 'child-state-based-styling',
  guideId: 'child-state-based-styling',
  guideHash: '70dc57b74e35',
  summary:
    'Sibling combinators (+ or ~) following form control state pseudo-classes simulate container state styling; replace with container :has() selectors.',
  matcher: childStateBasedStylingCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule uses sibling combinators (+ or ~) following input state pseudo-classes (:checked, :focus, :valid, :invalid) such as input:checked + label or :focus ~ .element to simulate parent or container state styling.',
      'The styling coordinates visual states between a form control and an adjacent element that can be refactored into a parent container styled with :has().',
    ],
    dropWhen: [
      'The stylesheet already uses the :has() selector.',
      'The rule is part of a fallback guarded by @supports not selector(:has(*)).',
      'The sibling element is an inline native replacement box where the input itself is styled independently without container implications.',
    ],
  },
};

export const childStateBasedStylingRules: readonly AnalyzerRule[] = [
  childStateBasedStylingRule,
];
