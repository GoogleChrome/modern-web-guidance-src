import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const DYNAMIC_SIBLING_ANIMATIONS_GUIDE_HASH = '26f6d4e848cc';

const NTH_CHILD_SELECTOR_REGEX = /^(.*?):nth-(?:child|of-type)\(\s*(\d+)\s*\)(.*)$/i;

const DELAY_PROPERTIES = new Set([
  'animation-delay',
  '-webkit-animation-delay',
  '-moz-animation-delay',
  '-o-animation-delay',
  'transition-delay',
  '-webkit-transition-delay',
  '-moz-transition-delay',
  '-o-transition-delay',
]);

const DELAY_VALUE_REGEX = /^\s*(-?\d*\.?\d+)\s*(ms|s)\s*$/i;

function parseDelayMs(raw: string): number | null {
  const m = DELAY_VALUE_REGEX.exec(raw);
  if (!m) {
    return null;
  }
  const num = Number.parseFloat(m[1]);
  if (!Number.isFinite(num)) {
    return null;
  }
  return m[2].toLowerCase() === 's' ? num * 1000 : num;
}

function parseNthChildBaseSelector(selectorText: string): {
  baseSelector: string;
  index: number;
} | null {
  const m = NTH_CHILD_SELECTOR_REGEX.exec(selectorText.trim());
  if (!m) {
    return null;
  }
  const index = Number.parseInt(m[2], 10);
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }
  const baseSelector = `${m[1].trim()}::${m[3].trim()}`;
  return { baseSelector, index };
}

function getRuleDelayMs(rule: CssRuleView): number | null {
  let delayMs: number | null = null;
  // Carve out rules that set custom properties (--i, --index) or any non-delay properties
  for (const decl of rule.declarations) {
    if (!DELAY_PROPERTIES.has(decl.property.toLowerCase().trim())) {
      return null;
    }
    const parsedMs = parseDelayMs(decl.value);
    if (parsedMs === null) {
      return null;
    }
    delayMs = parsedMs;
  }
  return delayMs;
}

const computedMatchedRulesByContext = new WeakMap<
  CssMatcherContext,
  Set<CssRuleView>
>();

function getSequenceStartRules(ctx: CssMatcherContext): Set<CssRuleView> {
  const cached = computedMatchedRulesByContext.get(ctx);
  if (cached) {
    return cached;
  }
  const result = new Set<CssRuleView>();
  if (ctx.stylesheetHasValue('sibling-index(')) {
    computedMatchedRulesByContext.set(ctx, result);
    return result;
  }

  const byKey = new Map<
    string,
    Array<{ index: number; delayMs: number; rule: CssRuleView }> | null
  >();

  for (const r of ctx.styleRules ?? []) {
    const parentAt = r.parentAtRule?.toLowerCase();
    if (parentAt?.includes('@supports') && parentAt.includes('sibling-index')) {
      continue;
    }
    const sel = parseNthChildBaseSelector(r.selectorText);
    if (!sel) {
      continue;
    }
    const key = `${r.parentAtRule ?? ''}||${sel.baseSelector}`;
    const existing = byKey.get(key);
    if (existing === null) {
      continue;
    }
    const delayMs = getRuleDelayMs(r);
    if (delayMs === null) {
      byKey.set(key, null);
      continue;
    }
    const list = existing ?? [];
    list.push({ index: sel.index, delayMs, rule: r });
    byKey.set(key, list);
  }

  for (const list of byKey.values()) {
    if (!list || list.length < 3) {
      continue;
    }
    const sorted = [...list].sort((a, b) => a.index - b.index);
    // Reject if duplicate indices or non-monotonic delays (e.g. 2D 3x3 cube grid wave)
    const isConsecutive = sorted.every(
      (item, i) => i === 0 || item.index === sorted[i - 1].index + 1,
    );
    const isIncreasing = sorted.every(
      (item, i) => i === 0 || item.delayMs > sorted[i - 1].delayMs,
    );
    const isDecreasing = sorted.every(
      (item, i) => i === 0 || item.delayMs < sorted[i - 1].delayMs,
    );
    if (isConsecutive && (isIncreasing || isDecreasing)) {
      result.add(sorted[0].rule);
    }
  }

  computedMatchedRulesByContext.set(ctx, result);
  return result;
}

const dynamicSiblingAnimationsCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [':nth-child(1)', ':nth-child(2)', ':nth-of-type(1)', ':nth-of-type(2)'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    const startRules = getSequenceStartRules(ctx);
    if (!startRules.has(styleRule)) {
      return null;
    }
    return {
      message:
        'Repetitive :nth-child(N) CSS rules set staggered animation-delay/transition-delay values; replace with a single rule using calc(sibling-index() * <step>).',
    };
  },
};

export const dynamicSiblingAnimationsCssRule: AnalyzerRule = {
  id: 'dynamic-sibling-animations',
  guideId: 'dynamic-sibling-animations',
  guideHash: DYNAMIC_SIBLING_ANIMATIONS_GUIDE_HASH,
  summary:
    'Replace repetitive :nth-child(N) CSS rules that only set staggered animation-delay or transition-delay values with CSS sibling-index().',
  matcher: dynamicSiblingAnimationsCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A stylesheet defines 3 or more sequential :nth-child(1), :nth-child(2), :nth-child(3) rules on the same selector that only set staggered animation-delay or transition-delay values.',
      'The repetitive :nth-child delay rules can be collapsed into a single rule using calc(sibling-index() * <step>).',
    ],
    dropWhen: [
      'The :nth-child rules set distinct per-child colors, positions, transforms, or custom properties (--i, --index) in addition to animation-delay.',
      'The stylesheet already uses sibling-index() or wraps the rules in an @supports fallback.',
    ],
  },
};

export default [
  dynamicSiblingAnimationsCssRule,
] satisfies readonly AnalyzerRule[];
