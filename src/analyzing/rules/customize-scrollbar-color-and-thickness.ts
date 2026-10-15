import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const WEBKIT_SCROLLBAR_REGEX = /:{1,2}-webkit-scrollbar(-thumb|-track|-track-piece|-corner)?\b/i;

const SCROLLBAR_STYLE_PROPERTIES = [
  'width',
  'height',
  'background',
  'background-color',
  'border',
  'border-color',
  'border-radius',
  'box-shadow',
  'color',
] as const;

const customizeScrollbarColorAndThicknessCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['-webkit-scrollbar'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet already defines standard scrollbar properties, skip
    if (
      ctx.stylesheetHasProperty('scrollbar-width') ||
      ctx.stylesheetHasProperty('scrollbar-color')
    ) {
      return null;
    }

    // 2. Selector must target WebKit scrollbar pseudo-elements
    if (!WEBKIT_SCROLLBAR_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    // 3. Skip rules used purely to hide scrollbars (display: none)
    const displayValue = (styleRule.getPropertyValue('display') ?? '').toLowerCase();
    if (displayValue === 'none') {
      return null;
    }

    // 4. Must customize scrollbar geometry, background, thumb, or track styling
    const hasStylingProperty = SCROLLBAR_STYLE_PROPERTIES.some((prop) =>
      styleRule.hasProperty(prop),
    );
    if (!hasStylingProperty && styleRule.declarations.length === 0) {
      return null;
    }

    return {
      message:
        'CSS rule uses vendor ::-webkit-scrollbar pseudo-elements to customize scrollbar appearance; modernize with standard scrollbar-color and scrollbar-width.',
    };
  },
};

export const customizeScrollbarColorAndThicknessRule: AnalyzerRule = {
  id: 'customize-scrollbar-color-and-thickness',
  guideId: 'customize-scrollbar-color-and-thickness',
  guideHash: '6797d5c85622',
  summary:
    'Vendor ::-webkit-scrollbar pseudo-elements customize scrollbar appearance; use standard scrollbar-color and scrollbar-width instead.',
  matcher: customizeScrollbarColorAndThicknessCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule uses vendor pseudo-elements (::-webkit-scrollbar, ::-webkit-scrollbar-thumb, or ::-webkit-scrollbar-track) to customize scrollbar dimensions, track/thumb colors, borders, or styling.',
      'The custom scrollbar appearance is implemented without declaring standard scrollbar-color or scrollbar-width CSS properties.',
    ],
    dropWhen: [
      'The stylesheet already defines standard scrollbar-width or scrollbar-color properties.',
      'The rule exclusively hides scrollbars using display: none (handled by scrollbar-width: none or intentional layout hiding).',
      'The selector is inside a fallback stylesheet that pairs vendor pseudo-elements with standard scrollbar properties.',
    ],
  },
};

export const customizeScrollbarColorAndThicknessRules: readonly AnalyzerRule[] = [
  customizeScrollbarColorAndThicknessRule,
];
