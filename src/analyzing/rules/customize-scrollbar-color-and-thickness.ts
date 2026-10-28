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
const WEBKIT_THUMB_STATE_REGEX =
  /::-webkit-scrollbar-thumb\s*:(?:hover|active|focus|window-inactive)\b/i;
const WEBKIT_THUMB_NON_HOVER_STATE_REGEX =
  /::-webkit-scrollbar-thumb\s*:(?:active|focus|window-inactive)\b/i;
const HOVER_WEBKIT_SCROLLBAR_REGEX = /:hover::-webkit-scrollbar(?![-\w])/i;
const CUSTOM_SCROLLBAR_WIDGET_SELECTOR_REGEX =
  /(?:\.CodeMirror-scroll|\.el-scrollbar__wrap|\.ps(?:\b|__)|\.simplebar-|\.os-viewport|\.nice-select\b|\.win-navbarcontainer)/i;
const INSET_PADDING_CLIP_REGEX = /^(?:padding-box|content-box)$/i;
const GRADIENT_VALUE_REGEX =
  /(?:(?:-webkit-|-moz-|-o-)?(?:repeating-)?(?:linear|radial|conic)-gradient|-webkit-gradient)\s*\(/i;

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

function isValidColorString(raw: string | null | undefined): boolean {
  const val = normalizeCssValue(raw);
  if (!val) {
    return false;
  }
  if (val.includes('url(') || val.includes('image(') || GRADIENT_VALUE_REGEX.test(val)) {
    return false;
  }
  return !TRANSPARENT_VALUES.has(val);
}

function hasValidColor(
  styleRule: CssRuleView,
  prop: 'background' | 'background-color',
): boolean {
  return isValidColorString(styleRule.getPropertyValue(prop));
}

function ruleHasInsetPaddingClip(styleRule: CssRuleView): boolean {
  const bgClip = normalizeCssValue(styleRule.getPropertyValue('background-clip'));
  const webkitBgClip = normalizeCssValue(styleRule.getPropertyValue('-webkit-background-clip'));
  return INSET_PADDING_CLIP_REGEX.test(bgClip) || INSET_PADDING_CLIP_REGEX.test(webkitBgClip);
}

function ruleHasValidThumbColor(styleRule: CssRuleView): boolean {
  if (ruleHasInsetPaddingClip(styleRule)) {
    return false;
  }
  return hasValidColor(styleRule, 'background') || hasValidColor(styleRule, 'background-color');
}

function extractScrollbarSelectorPrefix(selectorText: string): string {
  return selectorText
    .replace(/::-webkit-scrollbar.*$/i, '')
    .replace(/:hover\s*$/i, '')
    .trim();
}

function areScrollbarPrefixesCompatible(prefixA: string, prefixB: string): boolean {
  return (
    prefixA === prefixB ||
    prefixA === '' ||
    prefixA === '*' ||
    prefixB === '' ||
    prefixB === '*'
  );
}

function stylesheetHasValidColoredThumb(
  styleRule: CssRuleView,
  ctx: CssMatcherContext,
): boolean {
  const targetPrefix = extractScrollbarSelectorPrefix(styleRule.selectorText);
  const allRules = ctx.styleRules ?? [];
  const thumbRules = allRules.filter(
    (r) =>
      WEBKIT_THUMB_REGEX.test(r.selectorText) &&
      areScrollbarPrefixesCompatible(
        targetPrefix,
        extractScrollbarSelectorPrefix(r.selectorText),
      ),
  );
  const baseThumbRules = thumbRules.filter(
    (r) => !WEBKIT_THUMB_STATE_REGEX.test(r.selectorText),
  );
  if (baseThumbRules.length > 0) {
    return baseThumbRules.some(ruleHasValidThumbColor);
  }
  if (thumbRules.some((r) => !WEBKIT_THUMB_STATE_REGEX.test(r.selectorText) && ruleHasValidThumbColor(r))) {
    return true;
  }

  // Fallback for ::-webkit-scrollbar-thumb:vertical / :horizontal blocks skipped by cssomnom
  const thumbBlockRe = /([^{};]*?)::-webkit-scrollbar-thumb([^{]*)\{([^}]*)\}/gi;
  let blockMatch: RegExpExecArray | null = thumbBlockRe.exec(ctx.stylesheetText);
  while (blockMatch !== null) {
    const rawPrefix = (blockMatch[1] ?? '').trim();
    const stateSuffix = (blockMatch[2] ?? '').trim();
    const body = blockMatch[3] ?? '';
    if (
      !/:(?:hover|active|focus|window-inactive)\b/i.test(stateSuffix) &&
      !/background-clip\s*:\s*(?:padding-box|content-box)/i.test(body) &&
      areScrollbarPrefixesCompatible(targetPrefix, rawPrefix)
    ) {
      const bgRe = /(?:^|[;\s])background(?:-color)?\s*:\s*([^;}]+)/gi;
      let bgMatch: RegExpExecArray | null = bgRe.exec(body);
      while (bgMatch !== null) {
        if (isValidColorString(bgMatch[1])) {
          return true;
        }
        bgMatch = bgRe.exec(body);
      }
    }
    blockMatch = thumbBlockRe.exec(ctx.stylesheetText);
  }

  return false;
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

    // 4. Skip custom JS scrollbar widget containers (CodeMirror, Element UI, PerfectScrollbar, SimpleBar)
    if (CUSTOM_SCROLLBAR_WIDGET_SELECTOR_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    const isThumb = WEBKIT_THUMB_REGEX.test(styleRule.selectorText);
    const isScrollbar = WEBKIT_SCROLLBAR_REGEX.test(styleRule.selectorText);

    if (isThumb) {
      // Skip :active, :focus, and :window-inactive thumb state rules
      if (WEBKIT_THUMB_NON_HOVER_STATE_REGEX.test(styleRule.selectorText)) {
        return null;
      }
      // Must set visible non-gradient background or background-color without inset-padding clip
      if (!ruleHasValidThumbColor(styleRule)) {
        return null;
      }
      // For :hover thumb rules, require a base ::-webkit-scrollbar-thumb rule with a valid solid color
      if (WEBKIT_THUMB_STATE_REGEX.test(styleRule.selectorText)) {
        const targetPrefix = extractScrollbarSelectorPrefix(styleRule.selectorText);
        const baseThumbRules = (ctx.styleRules ?? []).filter(
          (r) =>
            WEBKIT_THUMB_REGEX.test(r.selectorText) &&
            !WEBKIT_THUMB_STATE_REGEX.test(r.selectorText) &&
            areScrollbarPrefixesCompatible(
              targetPrefix,
              extractScrollbarSelectorPrefix(r.selectorText),
            ),
        );
        if (!baseThumbRules.some(ruleHasValidThumbColor)) {
          return null;
        }
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

      // Non-zero thickness customization requires accompanying -webkit-scrollbar-thumb with a valid solid color
      if (!hasCustomThickness || !stylesheetHasValidColoredThumb(styleRule, ctx)) {
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
      'The rule sets a CSS gradient (linear-gradient, radial-gradient, -webkit-gradient) or image on ::-webkit-scrollbar-thumb, or styles ::-webkit-scrollbar thickness when the accompanying ::-webkit-scrollbar-thumb only uses gradients, images, box-shadow, backdrop-filter, or transparent backgrounds.',
      'The rule targets ::-webkit-scrollbar for non-zero sizing without custom thumb styling, or only sets border-radius without color, thickness, or hiding.',
      'The rule is inside a CSS reset stylesheet or an @supports not (scrollbar-width: ...) / @supports not (scrollbar-color: ...) fallback block.',
    ],
  },
};

export default [
  customizeScrollbarColorAndThicknessRule,
] satisfies readonly AnalyzerRule[];
