import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export type AnyRule = AnalyzerRule;

/**
 * Matches percentage values like `56.25%`, `75%`, `100%`, or `calc(9 / 16 * 100%)`.
 */
const PERCENTAGE_PADDING_RE = /^(?:(\d+(?:\.\d+)?)%|calc\([^)]*%[^)]*\))$/i;

const WELL_KNOWN_RATIO_PCT_RE =
  /^(?:56\.25|75(?:\.0+)?|100(?:\.0+)?|66\.6\d*|62\.5|42\.8\d*|133\.3\d*|177\.7\d*|50(?:\.0+)?)%$/;

const ZERO_HEIGHT_RE = /^0(?:px|%|rem|em|vh|vw)?$/i;

const ASPECT_SELECTOR_HINT_RE =
  /(?:aspect|ratio|embed|video|iframe|responsive|media|player|thumb|square|widescreen)/i;

const PSEUDO_BEFORE_AFTER_RE = /::?(?:before|after)\b/i;

function isZeroHeight(value: string | null): boolean {
  if (!value) return false;
  const cleaned = value.replace(/!important\s*$/i, '').trim();
  return ZERO_HEIGHT_RE.test(cleaned);
}

function isPercentagePadding(value: string | null): { isPct: boolean; isWellKnownOrCalc: boolean } {
  if (!value) return { isPct: false, isWellKnownOrCalc: false };
  const cleaned = value.replace(/!important\s*$/i, '').trim();
  const match = cleaned.match(PERCENTAGE_PADDING_RE);
  if (!match) {
    return { isPct: false, isWellKnownOrCalc: false };
  }
  if (match[1] !== undefined) {
    const num = Number(match[1]);
    if (!Number.isFinite(num) || num <= 0) {
      return { isPct: false, isWellKnownOrCalc: false };
    }
    return {
      isPct: true,
      isWellKnownOrCalc: WELL_KNOWN_RATIO_PCT_RE.test(cleaned),
    };
  }
  return { isPct: true, isWellKnownOrCalc: true };
}

export const aspectRatioCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['padding-top', 'padding-bottom'],
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null {
    if (styleRule.hasProperty('aspect-ratio') || ctx.stylesheetHasProperty('aspect-ratio')) {
      return null;
    }

    const padTopRaw = styleRule.getPropertyValue('padding-top');
    const padBottomRaw = styleRule.getPropertyValue('padding-bottom');
    const padTop = isPercentagePadding(padTopRaw);
    const padBottom = isPercentagePadding(padBottomRaw);
    if (!padTop.isPct && !padBottom.isPct) {
      return null;
    }

    const propUsed = padTop.isPct ? 'padding-top' : 'padding-bottom';
    const valUsed = (padTop.isPct ? padTopRaw : padBottomRaw) ?? '';
    const isWellKnownOrCalc = padTop.isWellKnownOrCalc || padBottom.isWellKnownOrCalc;

    // Pattern A: `height: 0` + percentage `padding-top` or `padding-bottom`
    if (
      isZeroHeight(styleRule.getPropertyValue('height')) ||
      isZeroHeight(styleRule.getPropertyValue('max-height'))
    ) {
      return {
        message: `CSS rule \`${styleRule.selectorText}\` uses the percentage \`${propUsed}: ${valUsed}\` + \`height: 0\` aspect-ratio box hack; use the CSS \`aspect-ratio\` property instead.`,
      };
    }

    // Pattern B: `::before` / `::after` pseudo-element strut with percentage vertical padding
    if (PSEUDO_BEFORE_AFTER_RE.test(styleRule.selectorText)) {
      const hasBlockOrContent =
        styleRule.hasProperty('content') ||
        styleRule.getPropertyValue('display')?.toLowerCase() === 'block' ||
        styleRule.getPropertyValue('float') !== null;
      if (hasBlockOrContent || isWellKnownOrCalc) {
        return {
          message: `CSS pseudo-element \`${styleRule.selectorText}\` uses \`${propUsed}: ${valUsed}\` as an aspect-ratio strut; use the CSS \`aspect-ratio\` property on the container instead.`,
        };
      }
    }

    // Pattern C: `position: relative` container with well-known ratio percentage or child `position: absolute`
    const pos = styleRule.getPropertyValue('position')?.toLowerCase();
    if (pos === 'relative') {
      if (
        isWellKnownOrCalc ||
        ASPECT_SELECTOR_HINT_RE.test(styleRule.selectorText) ||
        ctx.stylesheetHasValue('absolute')
      ) {
        return {
          message: `CSS rule \`${styleRule.selectorText}\` uses \`position: relative\` with \`${propUsed}: ${valUsed}\` to maintain aspect ratio; use the CSS \`aspect-ratio\` property instead.`,
        };
      }
    }

    // Pattern D: Selector explicitly named for aspect-ratio / embed / video with well-known ratio percentage
    if (isWellKnownOrCalc && ASPECT_SELECTOR_HINT_RE.test(styleRule.selectorText)) {
      return {
        message: `CSS rule \`${styleRule.selectorText}\` uses \`${propUsed}: ${valUsed}\` to size a fixed-ratio box; use the CSS \`aspect-ratio\` property instead.`,
      };
    }

    return null;
  },
};

/**
 * Rule 1 (CSS): Detect the classic percentage `padding-top` / `padding-bottom`
 * aspect-ratio box hack. Enabled by default in `aspectRatioRules`.
 */
export const aspectRatioCssRule: AnalyzerRule = {
  id: 'aspect-ratio/css-padding-hack',
  guideId: 'aspect-ratio',
  guideHash: 'c8f5e9a1b2d3',
  summary:
    'Detect CSS percentage padding-top/padding-bottom aspect-ratio box hacks that can be replaced with the CSS aspect-ratio property.',
  matcher: aspectRatioCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'A CSS rule uses the percentage `padding-top` or `padding-bottom` box hack (paired with `height: 0`, `position: relative` + absolutely positioned child, or a `::before`/`::after` pseudo-element) to maintain a fixed aspect ratio.',
    ],
    dropWhen: [
      'The percentage `padding-top` or `padding-bottom` is ordinary vertical spacing on a flow container rather than an aspect-ratio box hack.',
      'The stylesheet already declares `aspect-ratio` (e.g. progressive enhancement fallback).',
    ],
  },
};

const POSITIVE_DIMENSION_RE = /^\d+(?:\.\d+)?(?:px)?$/i;
const RESPONSIVE_WIDTH_CSS_RE = /(?:max-)?width\s*:\s*100%/i;
const AUTO_HEIGHT_CSS_RE = /height\s*:\s*auto/i;
const ASPECT_RATIO_CSS_RE = /\baspect-ratio\s*:/i;

export const aspectRatioDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'img[width][height], video[width][height]',
  fastTokens: ['height: auto', 'height:auto'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['width', 'height', 'style'],
  matchElement(element: DomElementView, ctx: DomMatcherContext): { message: string } | null {
    const widthAttr = element.getAttribute('width')?.trim() ?? '';
    const heightAttr = element.getAttribute('height')?.trim() ?? '';
    if (!POSITIVE_DIMENSION_RE.test(widthAttr) || !POSITIVE_DIMENSION_RE.test(heightAttr)) {
      return null;
    }
    if (
      Number(widthAttr.replace(/px$/i, '')) <= 0 ||
      Number(heightAttr.replace(/px$/i, '')) <= 0
    ) {
      return null;
    }

    const inlineStyle = element.getAttribute('style') ?? '';
    if (ASPECT_RATIO_CSS_RE.test(inlineStyle) || ASPECT_RATIO_CSS_RE.test(ctx.documentText)) {
      return null;
    }

    const hasResponsiveCss =
      (RESPONSIVE_WIDTH_CSS_RE.test(inlineStyle) && AUTO_HEIGHT_CSS_RE.test(inlineStyle)) ||
      (RESPONSIVE_WIDTH_CSS_RE.test(ctx.documentText) && AUTO_HEIGHT_CSS_RE.test(ctx.documentText));

    if (!hasResponsiveCss) {
      return null;
    }

    return {
      message: `<${element.tagName} width="${widthAttr}" height="${heightAttr}"> is paired with responsive \`width: 100%; height: auto\` CSS without \`aspect-ratio\`; consider explicit \`aspect-ratio\` styling.`,
    };
  },
};

/**
 * Rule 2 (DOM, opt-in): Detect `<img>` / `<video>` elements with static `width` and `height`
 * attributes only when the same HTML document also contains responsive `width: 100%; height: auto`
 * CSS without `aspect-ratio`. Excluded from default `aspectRatioRules` because modern browsers
 * automatically compute an internal `aspect-ratio` from HTML `width` and `height` attributes.
 */
export const aspectRatioDomRule: AnalyzerRule = {
  id: 'aspect-ratio/dom-intrinsic-dimensions',
  guideId: 'aspect-ratio',
  guideHash: 'c8f5e9a1b2d3',
  summary:
    'Detect <img> or <video> elements with width and height attributes paired with responsive width: 100%; height: auto CSS in the same file.',
  matcher: aspectRatioDomMatcher,
  phase2Rubric: {
    keepWhen: [
      'An `<img>` or `<video>` element specifies static `width` and `height` attributes alongside responsive `width: 100%; height: auto` CSS where an explicit CSS `aspect-ratio` rule clarifies layout sizing.',
    ],
    dropWhen: [
      'The `<img>` or `<video>` element simply uses standard HTML `width` and `height` attributes (which modern browsers already map to an automatic aspect-ratio in the UA stylesheet).',
    ],
  },
};

export const aspectRatioRule: AnalyzerRule = aspectRatioCssRule;

export const aspectRatioRules: AnyRule[] = [];
