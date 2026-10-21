import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const SOFT_EDGE_CONTENT_FADE_GUIDE_HASH = '2f9aef74b480';

const LINEAR_GRADIENT_MASK_REGEX =
  /(?:^|[^a-zA-Z0-9_-])(?:-webkit-|-moz-|-o-)?linear-gradient\s*\(|-webkit-gradient\s*\(\s*linear\b/i;

export const softEdgeContentFadeCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['-webkit-mask-image', '-webkit-mask'],
  matchRule: (styleRule: CssRuleView, _ctx: CssMatcherContext) => {
    if (styleRule.hasProperty('mask-image') || styleRule.hasProperty('mask')) {
      return null;
    }

    const webkitMaskImage = styleRule.getPropertyValue('-webkit-mask-image');
    const webkitMask = styleRule.getPropertyValue('-webkit-mask');

    const hasLinearGradientMask =
      (webkitMaskImage !== null &&
        LINEAR_GRADIENT_MASK_REGEX.test(webkitMaskImage)) ||
      (webkitMask !== null && LINEAR_GRADIENT_MASK_REGEX.test(webkitMask));

    if (!hasLinearGradientMask) {
      return null;
    }

    return {
      message:
        'CSS rule declares vendor-prefixed -webkit-mask-image with a linear gradient without standard mask-image; add standard mask-image: linear-gradient(...) for soft-edge content fading.',
    };
  },
};

export const softEdgeContentFadeRule: AnalyzerRule = {
  id: 'soft-edge-content-fade',
  guideId: 'soft-edge-content-fade',
  guideHash: SOFT_EDGE_CONTENT_FADE_GUIDE_HASH,
  summary:
    'CSS rules with -webkit-mask-image: linear-gradient(...) without standard mask-image should include unprefixed mask-image: linear-gradient(...).',
  matcher: softEdgeContentFadeCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'A CSS rule declares -webkit-mask-image or -webkit-mask with linear-gradient(...) or -webkit-gradient(linear, ...) without declaring standard unprefixed mask-image or mask.',
      'Absolute positioned overlay divs with linear-gradient backgrounds and pointer-events: none fade out scroll container edges.',
    ],
    dropWhen: [
      'The CSS rule already declares standard mask-image: linear-gradient(...) or mask alongside -webkit-mask-image.',
      'The rule uses SVG clipping paths (clip-path) or canvas blend modes rather than gradient edge fading.',
    ],
  },
};

export const softEdgeContentFadeRules: readonly AnalyzerRule[] = [
  softEdgeContentFadeRule,
];
