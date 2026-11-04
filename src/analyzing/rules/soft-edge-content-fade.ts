import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const SOFT_EDGE_CONTENT_FADE_GUIDE_HASH = '2f9aef74b480';

const LINEAR_GRADIENT_MASK_REGEX =
  /(?:^|[^a-zA-Z0-9_-])(?:-webkit-|-moz-|-o-)?linear-gradient\s*\(|-webkit-gradient\s*\(\s*linear\b/i;

const TRANSPARENT_COLOR_STOP_REGEX =
  /\btransparent\b|(?:rgba|hsla)\s*\([^)]*,\s*0(?:\.0+)?%?\s*\)|(?:rgb|hsl|oklch|lch|lab|oklab|color)\s*\([^)]*\/\s*0(?:\.0+)?%?\s*\)|#(?:[0-9a-f]{3}0|[0-9a-f]{6}00)\b/i;

function isLinearFadeGradientMask(value: string | null): boolean {
  if (value === null || !LINEAR_GRADIENT_MASK_REGEX.test(value)) {
    return false;
  }
  return TRANSPARENT_COLOR_STOP_REGEX.test(value);
}

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
      isLinearFadeGradientMask(webkitMaskImage) ||
      isLinearFadeGradientMask(webkitMask);

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
  verifierRubric: {
    keepWhen: [
      'A CSS rule declares -webkit-mask-image or -webkit-mask with linear-gradient(...) or -webkit-gradient(linear, ...) transitioning to transparent (or alpha 0) without declaring standard unprefixed mask-image or mask.',
      'Absolute positioned overlay divs with linear-gradient backgrounds and pointer-events: none fade out scroll container edges.',
    ],
    dropWhen: [
      'The CSS rule already declares standard mask-image: linear-gradient(...) or mask alongside -webkit-mask-image.',
      'The gradient has uniform non-zero opacity stops (e.g. from(rgba(0,0,0,0.7)), to(rgba(0,0,0,0.7))) used for flat dark-mode image dimming rather than edge fading.',
      'The rule uses SVG clipping paths (clip-path) or canvas blend modes rather than gradient edge fading.',
    ],
  },
};

export default [
  softEdgeContentFadeRule,
] satisfies readonly AnalyzerRule[];
