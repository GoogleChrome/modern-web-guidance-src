import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const WEBKIT_SCROLLBAR_REGEX = /:{1,2}-webkit-scrollbar(-thumb|-track)?\b/i;

const REQUIRED_SCROLLBAR_PROPERTIES = [
  'width',
  'height',
  'background',
  'background-color',
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

    // 2. Selector must target WebKit scrollbar pseudo-elements (scrollbar, thumb, or track)
    if (!WEBKIT_SCROLLBAR_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    // 3. Skip rules inside CSS reset stylesheets
    const lowerFilePath = ctx.filePath.toLowerCase();
    if (
      lowerFilePath.includes('reset') ||
      lowerFilePath.includes('normalize') ||
      lowerFilePath.includes('reboot')
    ) {
      return null;
    }

    // 4. Skip rules inside @supports not (scrollbar-width: ...) or (scrollbar-color: ...)
    if (styleRule.parentAtRule) {
      const atRuleLower = styleRule.parentAtRule.toLowerCase();
      if (
        atRuleLower.includes('@supports not') &&
        (atRuleLower.includes('scrollbar-width') || atRuleLower.includes('scrollbar-color'))
      ) {
        return null;
      }
    }

    // 5. Skip rules used purely to hide scrollbars (display: none)
    const displayValue = (styleRule.getPropertyValue('display') ?? '').toLowerCase();
    if (displayValue === 'none') {
      return null;
    }

    // 6. Must customize scrollbar geometry or color (width, height, background, or background-color)
    const hasRequiredProperty = REQUIRED_SCROLLBAR_PROPERTIES.some((prop) =>
      styleRule.hasProperty(prop),
    );
    if (!hasRequiredProperty) {
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
      'The CSS rule uses vendor pseudo-elements (::-webkit-scrollbar, ::-webkit-scrollbar-thumb, or ::-webkit-scrollbar-track) declaring width, height, background, or background-color to customize scrollbar dimensions or colors.',
      'The custom scrollbar appearance is implemented without declaring standard scrollbar-color or scrollbar-width CSS properties.',
    ],
    dropWhen: [
      'The stylesheet already defines standard scrollbar-width or scrollbar-color properties.',
      'The rule exclusively hides scrollbars using display: none.',
      'The rule only declares border-radius or box-shadow without customizing width, height, background, or background-color.',
      'The rule is inside a CSS reset stylesheet or an @supports not (scrollbar-width: ...) fallback block.',
    ],
  },
};

export const customizeScrollbarColorAndThicknessRules: readonly AnalyzerRule[] = [
  customizeScrollbarColorAndThicknessRule,
];
