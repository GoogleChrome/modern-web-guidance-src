import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const ICONS_GUIDE_HASH = 'd154d4fe990d';

const FILTER_PROPERTIES = new Set(['filter', '-webkit-filter']);

const MASK_PROPERTIES = new Set([
  'mask',
  'mask-image',
  '-webkit-mask',
  '-webkit-mask-image',
]);

const NON_ICON_MEDIA_SELECTOR_REGEX =
  /\b(?:html|body|video|canvas|iframe|picture|photo|avatar|thumbnail|banner|hero|gallery|backdrop)\b|:host-context\(/i;

const USERSTYLE_OVERRIDE_CONTENT_REGEX =
  /:host-context\(\s*\.-theme-with-dark-background\s*\)|\bdevtools-[a-z-]+|--override-color-|@-moz-document\b/i;

function isColorTintingFilterChain(value: string): boolean {
  const lower = value.toLowerCase();
  if (
    !lower.includes('invert(') ||
    !lower.includes('sepia(') ||
    !lower.includes('saturate(') ||
    !lower.includes('hue-rotate(')
  ) {
    return false;
  }

  // Exclude grayscale / zero-saturation filters like saturate(0) or saturate(0%)
  const saturateMatch = /saturate\(\s*([0-9.]+)(%?)\s*\)/.exec(lower);
  if (!saturateMatch) {
    return false;
  }
  const saturateNum = Number(saturateMatch[1]);
  if (!Number.isFinite(saturateNum) || saturateNum === 0) {
    return false;
  }

  return true;
}

export const iconsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['hue-rotate', 'sepia'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    if (
      USERSTYLE_OVERRIDE_CONTENT_REGEX.test(ctx.stylesheetText) ||
      NON_ICON_MEDIA_SELECTOR_REGEX.test(styleRule.selectorText)
    ) {
      return null;
    }

    if (
      styleRule.declarations.some((d) =>
        MASK_PROPERTIES.has(d.property.toLowerCase()),
      )
    ) {
      return null;
    }

    const hasColorFilterChain = styleRule.declarations.some(
      (d) =>
        FILTER_PROPERTIES.has(d.property.toLowerCase()) &&
        isColorTintingFilterChain(d.value),
    );

    if (!hasColorFilterChain) {
      return null;
    }

    return {
      message:
        'CSS rule chains invert(), sepia(), saturate(), and hue-rotate() filters to approximate a color on an icon or image; modernize with a CSS mask icon and background-color: currentColor (or inline SVG fill="currentColor").',
    };
  },
};

export const iconsRule: AnalyzerRule = {
  id: 'icons',
  guideId: 'icons',
  guideHash: ICONS_GUIDE_HASH,
  summary:
    'CSS rules chaining invert(), sepia(), saturate(), and hue-rotate() filters to recolor icons should be modernized with CSS mask icons (mask: url(...) and background-color: currentColor) or inline SVG fill="currentColor".',
  matcher: iconsCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule chains filter: invert(...) sepia(...) saturate(...) hue-rotate(...) to approximate a specific color on an icon, button graphic, UI indicator, or SVG <img>.',
    ],
    dropWhen: [
      'The filter is applied to photographs, video elements, avatars, or whole-page dark-mode inversion rather than recoloring a single-color UI icon or graphic.',
      'The stylesheet is a third-party userstyle or browser DevTools theme override (e.g. using :host-context(.-theme-with-dark-background), @-moz-document, or --override-color-* custom properties) where the author does not control the underlying icon DOM or image URL.',
      'The rule already uses CSS mask / mask-image for icon coloring.',
    ],
  },
};

export default [iconsRule] satisfies readonly AnalyzerRule[];
