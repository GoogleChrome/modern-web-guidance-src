import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const FLUID_SCALING_GUIDE_HASH = '5ae9fa3d45ce';

const COMPONENT_SELECTOR_RE =
  /\.(?:[a-z0-9]+[-_])*(?:card|widget|panel|sidebar|tile|box|modal|dialog|drawer|popover|dropdown|callout|alert|toast|post|comment|product|feature|pricing|testimonial|stat|metric)(?:[-_][a-z0-9]+)*\b/i;

const PAGE_LEVEL_SELECTOR_RE =
  /\b(?:html|body|main|:root)\b|\.(?:[a-z0-9]+[-_])*(?:page|site|hero|jumbotron|masthead|header|navbar|nav|footer|container|wrapper|section|layout|breadcrumb|banner|mbr)\b/i;

const FRAMEWORK_FILE_RE =
  /(?:^|\/)(?:bootstrap|foundation|tailwind|bulma|materialize|normalize|reboot|mbr-additional)/i;

const FLUID_PROPERTIES = [
  'font-size',
  'padding',
  'padding-inline',
  'padding-block',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'gap',
  'row-gap',
  'column-gap',
] as const;

const CLAMP_VW_RE = /\bclamp\s*\([^;{}]*?(\d*\.?\d+)v[wi]\b/i;
const CALC_BASE_AND_VW_RE =
  /\bcalc\s*\(\s*(?:\d*\.?\d+(?:rem|em|px)\s*\+\s*(\d*\.?\d+)v[wi]|(\d*\.?\d+)v[wi]\s*\+\s*\d*\.?\d+(?:rem|em|px))\s*\)/i;

function hasFluidViewportSlope(val: string): boolean {
  if (/\b\d*\.?\d+vh\b/i.test(val)) return false;

  const clampMatch = CLAMP_VW_RE.exec(val);
  if (clampMatch && clampMatch[1]) {
    const num = Number.parseFloat(clampMatch[1]);
    return num > 0 && num <= 15;
  }

  const calcMatch = CALC_BASE_AND_VW_RE.exec(val);
  if (calcMatch) {
    const num = Number.parseFloat(calcMatch[1] ?? calcMatch[2] ?? '0');
    return num > 0 && num <= 15;
  }

  return false;
}

function isMatchingComponentFluidRule(rule: CssRuleView): boolean {
  const selector = rule.selectorText;
  if (!COMPONENT_SELECTOR_RE.test(selector) || PAGE_LEVEL_SELECTOR_RE.test(selector)) {
    return false;
  }
  for (const prop of FLUID_PROPERTIES) {
    const val = rule.getPropertyValue(prop);
    if (val && hasFluidViewportSlope(val)) {
      return true;
    }
  }
  return false;
}

export const fluidScalingMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['clamp(', 'calc('] as const,
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null {
    if (FRAMEWORK_FILE_RE.test(ctx.filePath)) {
      return null;
    }

    if (
      ctx.stylesheetText.includes('cqi') ||
      ctx.stylesheetText.includes('cqw') ||
      ctx.stylesheetText.includes('container-type')
    ) {
      return null;
    }

    const selector = styleRule.selectorText;
    if (!COMPONENT_SELECTOR_RE.test(selector) || PAGE_LEVEL_SELECTOR_RE.test(selector)) {
      return null;
    }

    let matchedProp: string | undefined;
    for (const prop of FLUID_PROPERTIES) {
      const val = styleRule.getPropertyValue(prop);
      if (val && hasFluidViewportSlope(val)) {
        matchedProp = prop;
        break;
      }
    }

    if (!matchedProp) {
      return null;
    }

    // Deduplicate per stylesheet: only report the first matching component rule in the stylesheet
    if (ctx.styleRules) {
      const firstRule = ctx.styleRules.find((r) => isMatchingComponentFluidRule(r));
      if (firstRule && firstRule !== styleRule) {
        return null;
      }
    }

    return {
      message: `Component rule '${selector}' uses viewport units (vw/vi) inside clamp()/calc() for ${matchedProp}; set container-type: inline-size on the component wrapper and use cqi with a rem base inside clamp() so it scales with its container.`,
    };
  },
};

export const fluidScalingRule: AnalyzerRule = {
  id: 'fluid-scaling',
  guideId: 'fluid-scaling',
  guideHash: FLUID_SCALING_GUIDE_HASH,
  summary:
    'Detects reusable component CSS rules (.card, .widget, .panel, .sidebar, etc.) that use viewport units (vw/vi) inside clamp() or calc() for font-size, padding, or gap instead of container query units (cqi).',
  matcher: fluidScalingMatcher,
  verifierRubric: {
    keepWhen: [
      'Component-scoped CSS rule (e.g., .card, .widget, .panel, .post, .box) using vw or vi inside clamp() or calc() for font-size, padding, or gap instead of container query inline units (cqi)',
    ],
    dropWhen: [
      'Page-level typography or layout rule on :root, html, body, main, .hero, or page headers where viewport-relative scaling is intended',
      'Full-bleed layout math such as calc(100vw - 100%) or calc(50% - 50vw)',
      'Generated CSS framework utility or grid stylesheet',
    ],
  },
};

export default [fluidScalingRule] satisfies readonly AnalyzerRule[];
