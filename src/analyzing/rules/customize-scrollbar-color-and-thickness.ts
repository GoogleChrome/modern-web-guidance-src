import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const RESET_DIMENSIONS = new Set([
  'none',
  'auto',
  'inherit',
  'initial',
  'unset',
  'revert',
  'normal',
]);

const ZERO_DIMENSION_REGEX = /^0(?:[a-z%]+)?$/i;

const TRANSPARENT_VALUES = new Set([
  'transparent',
  'none',
  'rgba(0, 0, 0, 0)',
  'rgba(0,0,0,0)',
  'hsla(0, 0%, 0%, 0)',
  'hsla(0,0%,0%,0)',
  '#00000000',
  '#0000',
  'inherit',
  'initial',
  'unset',
  'revert',
]);

const WEBKIT_SCROLLBAR_REGEX = /::-webkit-scrollbar(?![-\w])/i;
const WEBKIT_THUMB_REGEX = /::-webkit-scrollbar-thumb\b/i;
const HOVER_WEBKIT_SCROLLBAR_REGEX = /:hover::-webkit-scrollbar(?![-\w])/i;

function normalizeCssValue(raw: string | null | undefined): string {
  return raw?.replace(/\s*!important\s*$/i, '').trim().toLowerCase() ?? '';
}

function isZeroDimension(styleRule: CssRuleView, prop: 'width' | 'height'): boolean {
  const val = normalizeCssValue(styleRule.getPropertyValue(prop));
  return Boolean(val && ZERO_DIMENSION_REGEX.test(val));
}

function hasAnyNonZeroDimension(styleRule: CssRuleView, prop: 'width' | 'height'): boolean {
  const val = normalizeCssValue(styleRule.getPropertyValue(prop));
  if (!val || RESET_DIMENSIONS.has(val) || ZERO_DIMENSION_REGEX.test(val)) {
    return false;
  }
  return true;
}

function hasCustomThicknessDimension(styleRule: CssRuleView, prop: 'width' | 'height'): boolean {
  if (!hasAnyNonZeroDimension(styleRule, prop)) {
    return false;
  }
  const val = normalizeCssValue(styleRule.getPropertyValue(prop));
  const pxMatch = val.match(/^(\d+(?:\.\d+)?)px$/);
  if (pxMatch && Number(pxMatch[1]) > 15) {
    return false;
  }
  return true;
}

function hasValidColor(
  styleRule: CssRuleView,
  prop: 'background' | 'background-color',
): boolean {
  const val = normalizeCssValue(styleRule.getPropertyValue(prop));
  if (!val) {
    return false;
  }
  if (val.includes('url(') || val.includes('image(')) {
    return false;
  }
  return !TRANSPARENT_VALUES.has(val);
}

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

    // 2. Skip rules inside CSS reset stylesheets or user-agent style overrides
    const lowerFilePath = ctx.filePath.toLowerCase();
    if (
      /(?:^|[\\/._-])(?:reset|normalize|reboot)(?:[\\/._-]|$)/.test(lowerFilePath) ||
      lowerFilePath.endsWith('userchrome.css') ||
      lowerFilePath.endsWith('usercontent.css')
    ) {
      return null;
    }

    // 3. Skip rules inside @supports not (scrollbar-width: ...) or (scrollbar-color: ...)
    if (styleRule.parentAtRule) {
      const atRuleLower = styleRule.parentAtRule.toLowerCase();
      if (
        atRuleLower.includes('@supports not') &&
        (atRuleLower.includes('scrollbar-width') || atRuleLower.includes('scrollbar-color'))
      ) {
        return null;
      }
    }

    const isThumb = WEBKIT_THUMB_REGEX.test(styleRule.selectorText);
    const isScrollbar = WEBKIT_SCROLLBAR_REGEX.test(styleRule.selectorText);

    if (isThumb) {
      // Must set visible background or background-color
      if (!hasValidColor(styleRule, 'background') && !hasValidColor(styleRule, 'background-color')) {
        return null;
      }
    } else if (isScrollbar) {
      const displayValue = normalizeCssValue(styleRule.getPropertyValue('display'));
      const hasCustomThickness =
        hasCustomThicknessDimension(styleRule, 'width') ||
        hasCustomThicknessDimension(styleRule, 'height');
      const hasAnyNonZeroDim =
        hasAnyNonZeroDimension(styleRule, 'width') ||
        hasAnyNonZeroDimension(styleRule, 'height');
      const hasZeroDim =
        isZeroDimension(styleRule, 'width') || isZeroDimension(styleRule, 'height');
      const isHoverRevealZeroScrollbar =
        displayValue !== 'none' && HOVER_WEBKIT_SCROLLBAR_REGEX.test(ctx.stylesheetText);
      const hidesScrollbar =
        displayValue === 'none' ||
        (hasZeroDim && !hasAnyNonZeroDim && !isHoverRevealZeroScrollbar);

      if (hidesScrollbar) {
        return {
          message:
            'CSS rule uses vendor ::-webkit-scrollbar to hide the scrollbar; use standard scrollbar-width: none on the scrollable container instead (and wrap ::-webkit-scrollbar in @supports not (scrollbar-width: none)).',
        };
      }

      // Non-zero thickness customization requires accompanying -webkit-scrollbar-thumb styling
      if (!hasCustomThickness || !ctx.stylesheetText.includes('-webkit-scrollbar-thumb')) {
        return null;
      }
    } else {
      return null;
    }

    return {
      message:
        'CSS rule uses vendor ::-webkit-scrollbar pseudo-elements to customize scrollbar appearance; add standard scrollbar-color and scrollbar-width (and wrap ::-webkit-scrollbar in @supports not (scrollbar-color: auto)).',
    };
  },
};

export const customizeScrollbarColorAndThicknessRule: AnalyzerRule = {
  id: 'customize-scrollbar-color-and-thickness',
  guideId: 'customize-scrollbar-color-and-thickness',
  guideHash: '6797d5c85622',
  summary:
    'Vendor ::-webkit-scrollbar pseudo-elements customize or hide scrollbars; use standard scrollbar-color and scrollbar-width (including scrollbar-width: none) instead.',
  matcher: customizeScrollbarColorAndThicknessCssMatcher,
  verifierRubric: {
    keepWhen: [
      'The CSS rule uses vendor pseudo-elements (::-webkit-scrollbar or ::-webkit-scrollbar-thumb) to customize scrollbar dimensions/thumb colors or to hide scrollbars (display: none, width: 0, height: 0).',
      'The custom or hidden scrollbar styling is implemented without declaring standard scrollbar-color or scrollbar-width (such as scrollbar-width: none) CSS properties.',
    ],
    dropWhen: [
      'The stylesheet already defines standard scrollbar-width or scrollbar-color properties.',
      'The rule only resets scrollbar properties using CSS cascade keywords (auto, inherit, initial, unset, revert) or sets transparent thumb backgrounds without hiding ::-webkit-scrollbar.',
      'The rule targets ::-webkit-scrollbar for non-zero sizing without custom thumb styling, or only sets border-radius without color, thickness, or hiding.',
      'The rule is inside a CSS reset stylesheet or an @supports not (scrollbar-width: ...) / @supports not (scrollbar-color: ...) fallback block.',
    ],
  },
};

export const customizeScrollbarColorAndThicknessRules: readonly AnalyzerRule[] = [
  customizeScrollbarColorAndThicknessRule,
];
