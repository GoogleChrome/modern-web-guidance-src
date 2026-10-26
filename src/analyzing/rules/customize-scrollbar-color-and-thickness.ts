import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

const RESET_OR_ZERO_DIMENSIONS = new Set([
  '0',
  '0px',
  '0em',
  '0rem',
  '0%',
  '0vw',
  '0vh',
  'none',
  'auto',
  'inherit',
  'initial',
  'unset',
  'revert',
  'normal',
]);

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

function hasNonZeroDimension(styleRule: CssRuleView, prop: 'width' | 'height'): boolean {
  const val = styleRule.getPropertyValue(prop)?.trim().toLowerCase();
  if (!val || RESET_OR_ZERO_DIMENSIONS.has(val)) {
    return false;
  }
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
  const val = styleRule.getPropertyValue(prop)?.trim().toLowerCase();
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

    // 4. Skip rules used purely to hide scrollbars (display: none)
    const displayValue = (styleRule.getPropertyValue('display') ?? '').toLowerCase();
    if (displayValue === 'none') {
      return null;
    }

    const isThumb = WEBKIT_THUMB_REGEX.test(styleRule.selectorText);
    const isScrollbar = WEBKIT_SCROLLBAR_REGEX.test(styleRule.selectorText);

    if (isThumb) {
      // Must set visible background or background-color
      if (!hasValidColor(styleRule, 'background') && !hasValidColor(styleRule, 'background-color')) {
        return null;
      }
    } else if (isScrollbar) {
      // Must set non-zero width or height in a stylesheet that also styles -webkit-scrollbar-thumb
      const hasDim = hasNonZeroDimension(styleRule, 'width') || hasNonZeroDimension(styleRule, 'height');
      if (!hasDim) {
        return null;
      }
      if (!ctx.stylesheetText.includes('-webkit-scrollbar-thumb')) {
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
    'Vendor ::-webkit-scrollbar pseudo-elements customize scrollbar appearance; use standard scrollbar-color and scrollbar-width instead.',
  matcher: customizeScrollbarColorAndThicknessCssMatcher,
  verifierRubric: {
    keepWhen: [
      'The CSS rule uses vendor pseudo-elements (::-webkit-scrollbar or ::-webkit-scrollbar-thumb) declaring non-zero width/height or background colors to customize visible scrollbar dimensions or thumb colors.',
      'The custom scrollbar appearance is implemented without declaring standard scrollbar-color or scrollbar-width CSS properties.',
    ],
    dropWhen: [
      'The stylesheet already defines standard scrollbar-width or scrollbar-color properties.',
      'The rule exclusively hides scrollbars using display: none, width: 0, height: 0, or transparent backgrounds.',
      'The rule targets ::-webkit-scrollbar without custom thumb styling or only sets border-radius without color/thickness.',
      'The rule is inside a CSS reset stylesheet or an @supports not (scrollbar-width: ...) fallback block.',
    ],
  },
};

export const customizeScrollbarColorAndThicknessRules: readonly AnalyzerRule[] = [
  customizeScrollbarColorAndThicknessRule,
];
