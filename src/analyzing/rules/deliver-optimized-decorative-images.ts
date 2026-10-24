import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const DELIVER_OPTIMIZED_DECORATIVE_IMAGES_GUIDE_HASH = 'ee1e0fbfdbb9';

const TARGET_PROPERTIES = new Set([
  'background',
  'background-image',
  'content',
  'mask',
  'mask-image',
  '-webkit-mask',
  '-webkit-mask-image',
]);

const WEBKIT_IMAGE_SET_TOKEN = '-webkit-image-set(';
const STANDARD_IMAGE_SET_REGEX = /(^|[^-\w])image-set\s*\(/i;

const deliverOptimizedDecorativeImagesCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['-webkit-image-set'],
  matchRule: (styleRule: CssRuleView, _ctx: CssMatcherContext) => {
    // 1. If rule already provides standard image-set(...) in any declaration, skip
    for (const decl of styleRule.declarations) {
      if (STANDARD_IMAGE_SET_REGEX.test(decl.value)) {
        return null;
      }
    }

    // 2. Look for -webkit-image-set( in background, content, or mask properties
    let hasWebkitImageSet = false;
    for (const decl of styleRule.declarations) {
      const prop = decl.property.toLowerCase();
      if (TARGET_PROPERTIES.has(prop) && decl.value.includes(WEBKIT_IMAGE_SET_TOKEN)) {
        hasWebkitImageSet = true;
        break;
      }
    }

    if (!hasWebkitImageSet) {
      return null;
    }

    return {
      message:
        'CSS rule uses vendor-prefixed -webkit-image-set() without standard image-set(); modernize using standard CSS image-set() with resolution and format negotiation.',
    };
  },
};

export const deliverOptimizedDecorativeImagesRule: AnalyzerRule = {
  id: 'deliver-optimized-decorative-images',
  guideId: 'deliver-optimized-decorative-images',
  guideHash: DELIVER_OPTIMIZED_DECORATIVE_IMAGES_GUIDE_HASH,
  summary:
    'CSS background or mask images using -webkit-image-set() without standard image-set() should be modernized with CSS image-set() format and resolution negotiation.',
  matcher: deliverOptimizedDecorativeImagesCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'A CSS rule uses vendor-prefixed -webkit-image-set() on background, background-image, content, or mask properties without providing standard image-set().',
      'A CSS declaration delivers resolution-dependent background or mask images solely through -webkit-image-set(...).',
    ],
    dropWhen: [
      'The rule or stylesheet already provides standard image-set() alongside or following -webkit-image-set().',
      'The image is responsive content markup using HTML <img> srcset/sizes or <picture> elements rather than CSS background image-set().',
      'The declaration is a standard single-url background-image: url(...) without resolution or format negotiation.',
    ],
  },
};

export const deliverOptimizedDecorativeImagesRules: readonly AnalyzerRule[] = [deliverOptimizedDecorativeImagesRule];
