import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const FLUID_SCALING_GUIDE_HASH = '5ae9fa3d45ce';

const TYPOGRAPHY_OR_COMPONENT_TITLE_SELECTOR_RE =
  /(?:^|[\s>+~])(?:h[1-6]|\.(?:h[1-6]|(?:[a-z0-9]+[-_])*(?:title|heading|headline|display|subhead|subheading|subtitle|lead|kicker|eyebrow)(?:[-_][a-z0-9]+)*))$/i;

const EXCLUDED_SELECTOR_RE =
  /\b(?:html|body|:root|svg|path|input|select|textarea|button|table|td|th|code|pre)\b|\.(?:[a-z0-9]+[-_])*(?:icon|fa|glyphicon|btn|button|nav|navbar|menu|dropdown|tooltip|popover|badge|tag|pill|label|input|field|footer|copyright|pagination|breadcrumb|col|row|grid|container|wrapper|mbr)\b/i;

const FRAMEWORK_FILE_RE =
  /(?:^|\/)(?:bootstrap|foundation|tailwind|bulma|materialize|normalize|reboot|mbr-additional|semantic|uikit|spectre|primer|tachyons|just-the-docs)|_files\//i;

const WIDTH_MEDIA_QUERY_RE =
  /^@media\b[^;{}]*\b(?:min-width|max-width|min-inline-size|max-inline-size|width\s*[<>]=?)\s*[:\s]?\s*\d/i;

const NON_SCREEN_MEDIA_RE = /\b(?:print|speech|prefers-)\b/i;

const STATIC_FONT_SIZE_RE = /^\s*\d*\.?\d+(?:px|rem|em|pt|%)\s*(?:!important\s*)?$/i;

const LAYOUT_PROPERTIES = [
  'display',
  'grid-template-columns',
  'grid-template-rows',
  'grid-template-areas',
  'flex-direction',
  'flex-wrap',
  'float',
  'position',
  'width',
  'min-width',
  'max-width',
] as const;

function normalizeSelector(selectorText: string): string {
  return selectorText.trim().replace(/\s+/g, ' ');
}

function isTargetTypographySelector(selectorText: string): boolean {
  const normalized = normalizeSelector(selectorText);
  if (!normalized || EXCLUDED_SELECTOR_RE.test(normalized)) {
    return false;
  }
  const parts = normalized.split(/\s*,\s*/);
  if (parts.length === 0 || parts.length > 4) {
    return false;
  }
  return parts.every(
    (part) =>
      TYPOGRAPHY_OR_COMPONENT_TITLE_SELECTOR_RE.test(part) &&
      !EXCLUDED_SELECTOR_RE.test(part),
  );
}

function isSteppedBreakpointFontRule(rule: CssRuleView): boolean {
  const parentAtRule = rule.parentAtRule;
  if (!parentAtRule) {
    return false;
  }
  if (!WIDTH_MEDIA_QUERY_RE.test(parentAtRule) || NON_SCREEN_MEDIA_RE.test(parentAtRule)) {
    return false;
  }
  if (!isTargetTypographySelector(rule.selectorText)) {
    return false;
  }
  const fontSize = rule.getPropertyValue('font-size');
  if (!fontSize || !STATIC_FONT_SIZE_RE.test(fontSize)) {
    return false;
  }
  for (const prop of LAYOUT_PROPERTIES) {
    if (rule.hasProperty(prop)) {
      return false;
    }
  }
  return true;
}

function countSteppedBreakpointsForSelector(
  styleRules: readonly CssRuleView[],
  targetSelector: string,
): { firstRule: CssRuleView | undefined; breakpointCount: number } {
  const matching = styleRules.filter(
    (r) =>
      isSteppedBreakpointFontRule(r) &&
      normalizeSelector(r.selectorText) === targetSelector,
  );
  if (matching.length < 3) {
    return { firstRule: undefined, breakpointCount: 0 };
  }
  const distinctBreakpoints = new Set<string>();
  const distinctFontSizes = new Set<string>();
  for (const r of matching) {
    if (r.parentAtRule) {
      distinctBreakpoints.add(r.parentAtRule.trim().toLowerCase());
    }
    const fs = r.getPropertyValue('font-size');
    if (fs) {
      distinctFontSizes.add(fs.trim().toLowerCase().replace(/\s*!important\s*$/i, ''));
    }
  }
  if (distinctBreakpoints.size < 3 || distinctFontSizes.size < 3) {
    return { firstRule: undefined, breakpointCount: 0 };
  }
  return { firstRule: matching[0], breakpointCount: distinctBreakpoints.size };
}

export const fluidScalingMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['@media', 'font-size'] as const,
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null {
    if (FRAMEWORK_FILE_RE.test(ctx.filePath)) {
      return null;
    }

    if (
      ctx.stylesheetText.includes('cqi') ||
      ctx.stylesheetText.includes('cqw') ||
      ctx.stylesheetText.includes('container-type') ||
      ctx.stylesheetText.includes('clamp(')
    ) {
      return null;
    }

    if (!isSteppedBreakpointFontRule(styleRule) || !ctx.styleRules) {
      return null;
    }

    const targetSelector = normalizeSelector(styleRule.selectorText);
    const { firstRule, breakpointCount } = countSteppedBreakpointsForSelector(
      ctx.styleRules,
      targetSelector,
    );

    if (!firstRule || firstRule !== styleRule) {
      return null;
    }

    // Deduplicate once per stylesheet so a responsive sheet with .display-1..6 emits one finding
    for (const r of ctx.styleRules) {
      if (r === styleRule) {
        break;
      }
      if (isSteppedBreakpointFontRule(r)) {
        const otherSel = normalizeSelector(r.selectorText);
        const other = countSteppedBreakpointsForSelector(ctx.styleRules, otherSel);
        if (other.firstRule === r) {
          return null;
        }
      }
    }

    return {
      message: `Selector '${targetSelector}' steps font-size across ${breakpointCount} @media width breakpoints; use clamp() (with cqi inside a container-type: inline-size parent when component-scoped) for smooth fluid scaling.`,
    };
  },
};

export const fluidScalingRule: AnalyzerRule = {
  id: 'fluid-scaling',
  guideId: 'fluid-scaling',
  guideHash: FLUID_SCALING_GUIDE_HASH,
  summary:
    'Detects typography and component title selectors whose font-size is stepped across 3 or more @media (min-width/max-width) breakpoint blocks instead of scaling smoothly with clamp() and container query units (cqi).',
  matcher: fluidScalingMatcher,
  verifierRubric: {
    keepWhen: [
      'A heading or component title selector (h1-h6, .card-title, .hero-title, .heading, etc.) has its font-size overridden across 3 or more @media width breakpoint steps instead of using clamp() fluid scaling',
    ],
    dropWhen: [
      'Stylesheet already uses clamp() or container query units (cqi, cqw)',
      'Media query rules that primarily switch component layout or grid tracks (covered by size-aware-styling)',
    ],
  },
};

export default [fluidScalingRule] satisfies readonly AnalyzerRule[];
