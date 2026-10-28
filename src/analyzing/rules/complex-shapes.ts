import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const COMPLEX_SHAPES_GUIDE_HASH = '15e7ef5f6ab6';

const WEBKIT_TO_STANDARD_MAP: Readonly<Record<string, string>> = {
  '-webkit-mask': 'mask',
  '-webkit-mask-image': 'mask-image',
  '-webkit-mask-size': 'mask-size',
  '-webkit-mask-repeat': 'mask-repeat',
  '-webkit-mask-position': 'mask-position',
  '-webkit-mask-composite': 'mask-composite',
};

const SAFARI_BORDER_RADIUS_WORKAROUND_REGEX =
  /(?:-webkit-)?radial-gradient\s*\([^)]*white[^)]*black/i;

function isSafariBorderRadiusWorkaround(value: string): boolean {
  return SAFARI_BORDER_RADIUS_WORKAROUND_REGEX.test(value);
}

const complexShapesCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['-webkit-mask'],
  matchRule: (styleRule: CssRuleView, _ctx: CssMatcherContext) => {
    // 1. If rule already provides standard mask shorthand, skip
    if (styleRule.hasProperty('mask')) {
      return null;
    }

    // 2. Collect declared -webkit-mask* properties that are not the Safari compositing workaround
    const activeWebkitProps: string[] = [];
    for (const [webkitProp, standardProp] of Object.entries(WEBKIT_TO_STANDARD_MAP)) {
      if (!styleRule.hasProperty(webkitProp)) {
        continue;
      }
      const val = styleRule.getPropertyValue(webkitProp) ?? '';
      if (
        (webkitProp === '-webkit-mask' || webkitProp === '-webkit-mask-image') &&
        isSafariBorderRadiusWorkaround(val)
      ) {
        continue;
      }
      if (!styleRule.hasProperty(standardProp)) {
        activeWebkitProps.push(webkitProp);
      }
    }

    if (activeWebkitProps.length === 0) {
      return null;
    }

    return {
      message:
        'CSS rule declares vendor-prefixed -webkit-mask properties without standard mask/mask-image; modernize using CSS Masking Module Level 1 standard mask properties.',
    };
  },
};

export const complexShapesRule: AnalyzerRule = {
  id: 'complex-shapes',
  guideId: 'complex-shapes',
  guideHash: COMPLEX_SHAPES_GUIDE_HASH,
  summary:
    'CSS masking using -webkit-mask properties without standard mask/mask-image should be modernized with standard CSS Masking Module Level 1.',
  matcher: complexShapesCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule declares -webkit-mask, -webkit-mask-image, -webkit-mask-size, or other -webkit-mask-* properties without declaring the corresponding standard unprefixed mask or mask-image property.',
      'An element is clipped to an image, gradient, or SVG mask using only legacy WebKit mask properties.',
    ],
    dropWhen: [
      'The rule already declares standard mask or mask-image alongside -webkit-mask for progressive enhancement.',
      'The declaration is the legacy Safari border-radius and overflow: hidden compositing bug workaround using -webkit-mask-image: -webkit-radial-gradient(white, black) or radial-gradient(circle, white 100%, black 100%).',
      'The styling uses CSS clip-path or inline SVG <mask id="..."> definitions rather than CSS mask properties.',
    ],
  },
};

export default [complexShapesRule] satisfies readonly AnalyzerRule[];
