import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const MS_SCROLLBAR_PROPERTIES = [
  '-ms-scrollbar-face-color',
  '-ms-scrollbar-track-color',
  '-ms-scrollbar-arrow-color',
  '-ms-scrollbar-shadow-color',
  '-ms-scrollbar-highlight-color',
  '-ms-scrollbar-3dlight-color',
  '-ms-scrollbar-darkshadow-color',
  '-ms-overflow-style',
] as const;

const adaptScrollbarToContrastPreferencesCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['-ms-scrollbar', '-ms-overflow-style'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. If stylesheet defines standard scrollbar properties, skip
    if (
      ctx.stylesheetHasProperty('scrollbar-width') ||
      ctx.stylesheetHasProperty('scrollbar-color')
    ) {
      return null;
    }

    // 2. Check if rule declares proprietary Microsoft scrollbar properties
    // OR ::-webkit-scrollbar inside a contrast / theme media query
    const hasMsProp = MS_SCROLLBAR_PROPERTIES.some((prop) =>
      styleRule.hasProperty(prop),
    );

    const isContrastWebkitScrollbar =
      styleRule.selectorText.includes('::-webkit-scrollbar') &&
      Boolean(
        styleRule.parentAtRule &&
          /(?:prefers-contrast|forced-colors|-ms-high-contrast)/i.test(
            styleRule.parentAtRule,
          ),
      );

    if (!hasMsProp && !isContrastWebkitScrollbar) {
      return null;
    }

    return {
      message:
        'CSS rule declares legacy proprietary Microsoft scrollbar properties; modernize with standard scrollbar-color and scrollbar-width (and prefers-contrast media queries).',
    };
  },
};

export const adaptScrollbarToContrastPreferencesRule: AnalyzerRule = {
  id: 'adapt-scrollbar-to-contrast-preferences',
  guideId: 'adapt-scrollbar-to-contrast-preferences',
  guideHash: '55a05ba9d96e',
  summary:
    'Legacy Microsoft scrollbar properties (-ms-scrollbar-*, -ms-overflow-style) should be replaced with standard scrollbar-color, scrollbar-width, and prefers-contrast queries.',
  matcher: adaptScrollbarToContrastPreferencesCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'The CSS rule declares legacy IE/Edge proprietary scrollbar properties (-ms-scrollbar-* or -ms-overflow-style) without declaring standard scrollbar-color or scrollbar-width.',
      'The custom scrollbar styling lacks standard adaptation for contrast preferences or modern cross-browser scrollbar controls.',
    ],
    dropWhen: [
      'The stylesheet already defines standard scrollbar-color or scrollbar-width properties.',
      'The rule is inside a fallback block guarded by @supports not (scrollbar-width: ...) or modern CSS feature queries.',
      'The rule is within a legacy browser-specific stylesheet strictly targeting Internet Explorer embedded webviews.',
    ],
  },
};

export const adaptScrollbarToContrastPreferencesRules: readonly AnalyzerRule[] = [];
