import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const RESOLUTION_OPTIMIZED_PSEUDO_ELEMENTS_GUIDE_HASH = '586fb26b74df';

const TARGET_PROPERTIES = new Set([
  'background',
  'background-image',
  'content',
]);

const PSEUDO_ELEMENT_SELECTOR_REGEX = /::?(?:before|after)\b/i;
const WEBKIT_IMAGE_SET_TOKEN = '-webkit-image-set(';
const STANDARD_IMAGE_SET_REGEX = /(^|[^-\w])image-set\s*\(/i;

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

export const resolutionOptimizedPseudoElementsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['-webkit-image-set'],
  matchRule: (styleRule: CssRuleView, _ctx: CssMatcherContext) => {
    const selector = getRawSelectorText(styleRule);
    if (!PSEUDO_ELEMENT_SELECTOR_REGEX.test(selector)) {
      return null;
    }

    for (const decl of styleRule.declarations) {
      if (STANDARD_IMAGE_SET_REGEX.test(decl.value)) {
        return null;
      }
    }

    let matchedProp: string | null = null;
    for (const decl of styleRule.declarations) {
      const prop = decl.property.toLowerCase();
      if (
        TARGET_PROPERTIES.has(prop) &&
        decl.value.toLowerCase().includes(WEBKIT_IMAGE_SET_TOKEN)
      ) {
        matchedProp = prop;
        break;
      }
    }

    if (!matchedProp) {
      return null;
    }

    if (matchedProp === 'background-image' || matchedProp === 'background') {
      return {
        message:
          `Pseudo-element CSS rule uses vendor-prefixed -webkit-image-set() in ${matchedProp} without standard image-set(); modernize using ${matchedProp}: image-set() rather than content: image-set() so pseudo-element box dimensions and background sizing are preserved.`,
      };
    }

    return {
      message:
        'Pseudo-element CSS rule uses vendor-prefixed -webkit-image-set() without standard image-set(); modernize using standard CSS content: image-set() with format and resolution options.',
    };
  },
};

export const resolutionOptimizedPseudoElementsRule: AnalyzerRule = {
  id: 'resolution-optimized-pseudo-elements',
  guideId: 'resolution-optimized-pseudo-elements',
  guideHash: RESOLUTION_OPTIMIZED_PSEUDO_ELEMENTS_GUIDE_HASH,
  summary:
    'CSS ::before and ::after pseudo-elements using -webkit-image-set() on content or background properties without standard image-set() should be modernized with standard CSS image-set().',
  matcher: resolutionOptimizedPseudoElementsCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule targeting ::before, :before, ::after, or :after uses vendor-prefixed -webkit-image-set() in content, background, or background-image without providing standard unprefixed image-set().',
      'Pseudo-element decorative icons or graphics supply multi-resolution images only through legacy -webkit-image-set() declarations.',
    ],
    dropWhen: [
      'The pseudo-element rule already provides a standard unprefixed image-set() declaration alongside -webkit-image-set().',
      'The CSS rule targets a regular element without a ::before, :before, ::after, or :after pseudo-element selector.',
      'The pseudo-element uses a single static url(...) or SVG data URI without multi-resolution image-set() candidates.',
    ],
  },
};

export const resolutionOptimizedPseudoElementsRules: readonly AnalyzerRule[] = [
  resolutionOptimizedPseudoElementsRule,
];
