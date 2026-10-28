import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const CUSTOM_LIST_MARKERS_GUIDE_HASH = '6e0ed1e0a8c9';

const LI_BEFORE_SELECTOR_REGEX =
  /(?:^|[\s>+~])li(?:\.[a-z0-9_-]+)?::?before\s*$/i;

const EXCLUDED_SELECTOR_KEYWORDS_REGEX =
  /\b(?:breadcrumbs?|nav|navbar|tabs?|menu|pagination|pager|inline|timeline|tree)\b|li\s*\+\s*li/i;

/**
 * Properties safe to migrate directly to ::marker (or simple spacing between marker and text).
 * Any box/positioning/layout property (width, height, position, background, border, display, etc.)
 * indicates a custom box or icon layout that ::marker does not support.
 */
const ALLOWED_MARKER_BEFORE_PROPERTIES = new Set([
  'content',
  'color',
  'font',
  'font-size',
  'font-weight',
  'font-family',
  'font-style',
  'font-variant',
  'font-synthesis',
  'letter-spacing',
  'text-transform',
  'unicode-bidi',
  'direction',
  'white-space',
  'counter-increment',
  'counter-reset',
  'margin-right',
  'margin-inline-end',
  'padding-right',
  'padding-inline-end',
]);

const BREADCRUMB_SEPARATOR_CONTENT_REGEX =
  /^['"]\s*(?:\/|\\|\||>|»|›|-|–|—|,|;|:)\s*['"]$/;

function isValidMarkerContentValue(rawValue: string): boolean {
  const val = rawValue.trim();
  if (!val) {
    return false;
  }
  const lower = val.toLowerCase();
  if (
    lower === 'none' ||
    lower === 'normal' ||
    lower === '""' ||
    lower === "''" ||
    lower.startsWith('attr(') ||
    lower.startsWith('url(')
  ) {
    return false;
  }
  if (BREADCRUMB_SEPARATOR_CONTENT_REGEX.test(val)) {
    return false;
  }
  if (lower.startsWith('counter(') || lower.startsWith('counters(')) {
    return true;
  }
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    const inner = val.slice(1, -1).trim();
    // Avoid Private Use Area icon font glyphs (e.g. FontAwesome "\f00c" or "\e900")
    // which require a specific icon font or custom box rather than standard list markers
    if (/^\\[ef][0-9a-f]{3}$/i.test(inner)) {
      return false;
    }
    return inner.length > 0 && inner.length <= 8;
  }
  return false;
}

const stylesheetsWithListStyleNone = new WeakMap<CssMatcherContext, boolean>();

function stylesheetResetsListStyle(ctx: CssMatcherContext): boolean {
  const cached = stylesheetsWithListStyleNone.get(ctx);
  if (cached !== undefined) {
    return cached;
  }
  if (ctx.stylesheetText.includes('::marker')) {
    stylesheetsWithListStyleNone.set(ctx, false);
    return false;
  }

  let found = false;
  for (const r of ctx.styleRules ?? []) {
    if (!/\b(?:ul|ol|li)\b/i.test(r.selectorText)) {
      continue;
    }
    for (const d of r.declarations) {
      const p = d.property.toLowerCase().trim();
      const v = d.value.toLowerCase().trim();
      if (
        (p === 'list-style' || p === 'list-style-type') &&
        /\bnone\b/.test(v)
      ) {
        found = true;
        break;
      }
    }
    if (found) {
      break;
    }
  }

  stylesheetsWithListStyleNone.set(ctx, found);
  return found;
}

const matchedCssContexts = new WeakSet<CssMatcherContext>();

const customListMarkersCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['list-style'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    if (matchedCssContexts.has(ctx)) {
      return null;
    }
    const selector = styleRule.selectorText.trim();
    if (!LI_BEFORE_SELECTOR_REGEX.test(selector)) {
      return null;
    }
    if (EXCLUDED_SELECTOR_KEYWORDS_REGEX.test(selector)) {
      return null;
    }
    if (!stylesheetResetsListStyle(ctx)) {
      return null;
    }

    let hasValidContent = false;
    let hasMarkerStyling = false;

    for (const decl of styleRule.declarations) {
      const prop = decl.property.toLowerCase().trim();
      if (!ALLOWED_MARKER_BEFORE_PROPERTIES.has(prop)) {
        return null;
      }
      if (prop === 'content') {
        if (!isValidMarkerContentValue(decl.value)) {
          return null;
        }
        hasValidContent = true;
      } else if (
        prop === 'color' ||
        prop.startsWith('font') ||
        prop.startsWith('counter-')
      ) {
        hasMarkerStyling = true;
      }
    }

    if (!hasValidContent || !hasMarkerStyling) {
      return null;
    }

    matchedCssContexts.add(ctx);

    return {
      message:
        'Stylesheet strips native list markers with list-style: none and recreates them via li::before { content: ... }; style native markers directly with li::marker instead.',
    };
  },
};

export const customListMarkersRule: AnalyzerRule = {
  id: 'custom-list-markers',
  guideId: 'custom-list-markers',
  guideHash: CUSTOM_LIST_MARKERS_GUIDE_HASH,
  summary:
    'Style list item bullets or numbers directly using the CSS ::marker pseudo-element instead of resetting list-style: none and emulating text markers with li::before.',
  matcher: customListMarkersCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A stylesheet sets list-style: none on a list (ul, ol, or li) and uses li::before with content (such as "•" or counter(...)) and color/font properties solely to customize the bullet or number color/typography.',
      'Replacing list-style: none + li::before with li::marker preserves native list semantics and alignment while styling the marker directly.',
    ],
    dropWhen: [
      'The li::before rule uses box, background, positioning, or layout properties (such as width, height, background, border, position: absolute, or transform) that ::marker does not support.',
      'The selector styles horizontal breadcrumb separators (e.g. li + li::before { content: "/" }) or navigation tabs rather than vertical list markers.',
    ],
  },
};

export default [
  customListMarkersRule,
] satisfies readonly AnalyzerRule[];
