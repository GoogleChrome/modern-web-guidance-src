import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const DYNAMIC_SIBLING_STYLING_GUIDE_HASH = '4d2db5d1aa4c';

const NTH_CHILD_SELECTOR_REGEX = /^(.*?):(nth-(?:child|of-type))\(\s*(\d+)\s*\)(.*)$/i;
const VALUE_NUMBER_TOKEN_REGEX =
  /(?<![a-zA-Z0-9_-])(-?\d+(?:\.\d+)?)(deg|rad|turn|grad|px|rem|em|%|s|ms|vw|vh|vmin|vmax|ch|ex)?(?![a-zA-Z0-9_-])/gi;
const INDEXED_LITERAL_PROPS = new Set([
  'z-index',
  'order',
  'transform',
  'background-position-x',
  'background-position-y',
]);

interface ParsedIndexedCssRule {
  readonly baseSelector: string;
  readonly prop: string;
  readonly template: string;
  readonly isCustomProp: boolean;
  readonly index: number;
  readonly tokens: readonly { readonly num: number; readonly unit: string }[];
}

function parseIndexedCssRule(rule: CssRuleView): ParsedIndexedCssRule | null {
  if (rule.declarations.length !== 1) {
    return null;
  }
  const decl = rule.declarations[0];
  const prop = decl.property.toLowerCase().trim();
  const isCustomProp = prop.startsWith('--');
  if (!isCustomProp && !INDEXED_LITERAL_PROPS.has(prop)) {
    return null;
  }

  const m = NTH_CHILD_SELECTOR_REGEX.exec(rule.selectorText.trim());
  if (!m) {
    return null;
  }
  const pseudoClass = m[2].toLowerCase();
  const trailing = m[4];
  if (
    m[1].includes(',') ||
    trailing.includes(',') ||
    (trailing !== '' && (!/^[.#:[]/.test(trailing) || /[\s>+~]/.test(trailing))) ||
    /:{1,2}(?:before|after|marker|backdrop|placeholder|file-selector-button)\b/i.test(trailing)
  ) {
    return null;
  }
  const index = Number.parseInt(m[3], 10);
  if (!Number.isFinite(index) || index < 1) {
    return null;
  }

  const normalizedVal = decl.value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
  const tokens: Array<{ num: number; unit: string }> = [];
  let tokenIdx = 0;
  VALUE_NUMBER_TOKEN_REGEX.lastIndex = 0;
  const template = normalizedVal.replace(
    VALUE_NUMBER_TOKEN_REGEX,
    (_full, numStr: string, unitStr?: string) => {
      const num = Number.parseFloat(numStr);
      const unit = (unitStr ?? '').toLowerCase();
      tokens.push({ num, unit });
      return `#{${tokenIdx++}}`;
    },
  );

  if (tokens.length === 0 || tokens.some((t) => !Number.isFinite(t.num))) {
    return null;
  }
  if (isCustomProp && template !== '#{0}') {
    return null;
  }

  const integerOnly = prop === 'z-index' || prop === 'order';
  if (integerOnly && (template !== '#{0}' || tokens[0].unit !== '' || !Number.isInteger(tokens[0].num))) {
    return null;
  }

  const baseSelector = `${m[1].trim()}::${pseudoClass}::${trailing.trim()}`;
  return {
    baseSelector,
    prop,
    template,
    isCustomProp,
    index,
    tokens,
  };
}

const computedCssStarts = new WeakMap<CssMatcherContext, Set<CssRuleView>>();

function getCssSequenceStartRules(ctx: CssMatcherContext): Set<CssRuleView> {
  const cached = computedCssStarts.get(ctx);
  if (cached) {
    return cached;
  }
  const result = new Set<CssRuleView>();
  if (
    ctx.stylesheetHasValue('sibling-index(') ||
    ctx.stylesheetHasValue('sibling-count(')
  ) {
    computedCssStarts.set(ctx, result);
    return result;
  }

  const byKey = new Map<
    string,
    Array<ParsedIndexedCssRule & { readonly rule: CssRuleView }>
  >();
  for (const r of ctx.styleRules ?? []) {
    if (
      r.parentAtRule &&
      r.parentAtRule.toLowerCase().includes('@supports') &&
      r.parentAtRule.toLowerCase().includes('sibling-')
    ) {
      continue;
    }
    const parsed = parseIndexedCssRule(r);
    if (!parsed) {
      continue;
    }
    const key = `${r.parentAtRule ?? ''}||${parsed.baseSelector}||${parsed.prop}||${parsed.template}`;
    const list = byKey.get(key) ?? [];
    list.push({ ...parsed, rule: r });
    byKey.set(key, list);
  }

  for (const list of byKey.values()) {
    const minLen = list[0]?.isCustomProp ? 3 : 4;
    if (list.length < minLen) {
      continue;
    }
    const sorted = [...list].sort((a, b) => a.index - b.index);
    const tokenCount = sorted[0].tokens.length;
    const varyingTokenIndices: number[] = [];
    let validProgression = true;

    for (let i = 1; i < sorted.length; i++) {
      if (
        sorted[i].index !== sorted[i - 1].index + 1 ||
        sorted[i].tokens.length !== tokenCount
      ) {
        validProgression = false;
        break;
      }
    }
    if (!validProgression) {
      continue;
    }

    for (let t = 0; t < tokenCount; t++) {
      const unit0 = sorted[0].tokens[t].unit;
      const step = sorted[1].tokens[t].num - sorted[0].tokens[t].num;
      let allEqual = true;
      let linear = true;

      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].tokens[t].unit !== unit0) {
          linear = false;
          allEqual = false;
          break;
        }
        const diff = sorted[i].tokens[t].num - sorted[i - 1].tokens[t].num;
        if (Math.abs(diff) > 1e-6) {
          allEqual = false;
        }
        if (Math.abs(diff - step) > 1e-6) {
          linear = false;
        }
      }

      if (allEqual) {
        continue;
      }
      if (!linear || Math.abs(step) <= 1e-6) {
        validProgression = false;
        break;
      }
      varyingTokenIndices.push(t);
    }

    if (validProgression && varyingTokenIndices.length === 1) {
      result.add(sorted[0].rule);
    }
  }

  computedCssStarts.set(ctx, result);
  return result;
}

const dynamicSiblingStylingCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [
    ':nth-child(1)',
    ':nth-child(2)',
    ':nth-of-type(1)',
    ':nth-of-type(2)',
    ':nth-child(',
    ':nth-of-type(',
  ],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    const startRules = getCssSequenceStartRules(ctx);
    if (!startRules.has(styleRule)) {
      return null;
    }
    return {
      message:
        'Repetitive :nth-child(N) CSS rules assign sequential positional values; replace with CSS sibling-index() and sibling-count().',
    };
  },
};

export const dynamicSiblingStylingCssRule: AnalyzerRule = {
  id: 'dynamic-sibling-styling/css',
  guideId: 'dynamic-sibling-styling',
  guideHash: DYNAMIC_SIBLING_STYLING_GUIDE_HASH,
  summary:
    'Replace repetitive :nth-child(N) / :nth-of-type(N) CSS rules that assign sequential positional values (--i/--index custom properties, z-index, transform offsets/angles, or order) with CSS sibling-index() and sibling-count().',
  matcher: dynamicSiblingStylingCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A stylesheet defines 3 or more sequential :nth-child(1), :nth-child(2), :nth-child(3) (or :nth-of-type) rules on the same base selector that set an arithmetic progression on a custom property (--i, --index, --sibling-index, --delay, etc.).',
      'A stylesheet defines 4 or more sequential :nth-child(N) / :nth-of-type(N) rules on the same base selector that set an arithmetic progression on z-index (increasing or decreasing), transform (e.g. sequential rotate() angles), order, or background-position.',
      'The repetitive :nth-child blocks can be replaced by CSS sibling-index() and sibling-count().',
    ],
    dropWhen: [
      'The :nth-child rules assign non-sequential, duplicate, or data-specific tokens (such as distinct brand colors) rather than a positional arithmetic progression.',
      'The :nth-child rules use sibling or descendant combinators (e.g. :nth-child(1):checked ~ .slider or li:nth-child(1) span) rather than styling the indexed sibling element directly.',
      'The stylesheet already uses sibling-index() or wraps the rules in an @supports fallback.',
    ],
  },
};

export default [dynamicSiblingStylingCssRule] satisfies readonly AnalyzerRule[];
