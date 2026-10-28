import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const OPTIMIZE_SCRIPT_PRIORITY_GUIDE_HASH = '0e88dc56d337';

const VALID_IMPORTANCE_VALUES = new Set(['high', 'low', 'auto']);
const matchedLinesByContext = new WeakMap<DomMatcherContext, Set<number>>();

export const optimizeScriptPriorityMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'script[importance]',
  fastTokens: ['importance'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['fetchpriority', 'fetchPriority', 'importance'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    if (element.tagName !== 'script') {
      return null;
    }

    if (
      element.hasDynamicAttribute?.('fetchpriority') ||
      element.hasDynamicAttribute?.('fetchPriority') ||
      element.hasDynamicAttribute?.('importance')
    ) {
      return null;
    }

    const hasSrc =
      (element.getAttribute('src') ?? '').trim().length > 0 ||
      Boolean(element.hasDynamicAttribute?.('src'));
    if (!hasSrc) {
      return null;
    }

    const importance = (element.getAttribute('importance') ?? '')
      .trim()
      .toLowerCase();
    if (!VALID_IMPORTANCE_VALUES.has(importance)) {
      return null;
    }

    const fetchPriorityAttr =
      element.getAttribute('fetchpriority') ??
      element.getAttribute('fetchPriority');
    if (fetchPriorityAttr !== null) {
      const normalizedFetchPriority = fetchPriorityAttr.trim().toLowerCase();
      if (normalizedFetchPriority === importance) {
        return null;
      }
    }

    let seenLines = matchedLinesByContext.get(ctx);
    if (!seenLines) {
      seenLines = new Set<number>();
      matchedLinesByContext.set(ctx, seenLines);
    }
    if (seenLines.has(element.line)) {
      return null;
    }
    seenLines.add(element.line);

    return {
      message: `Deprecated importance="${importance}" attribute on <script> should be replaced with standard fetchpriority="${importance}".`,
    };
  },
};

export const optimizeScriptPriorityRule: AnalyzerRule = {
  id: 'optimize-script-priority',
  guideId: 'optimize-script-priority',
  guideHash: OPTIMIZE_SCRIPT_PRIORITY_GUIDE_HASH,
  summary:
    'Replace deprecated importance attribute on <script> elements with standard fetchpriority.',
  matcher: optimizeScriptPriorityMatcher,
  verifierRubric: {
    keepWhen: [
      'An external <script src="..."> element uses the deprecated importance="high|low|auto" attribute instead of fetchpriority.',
    ],
    dropWhen: [
      'The <script> element already specifies a matching fetchpriority attribute.',
      'An inline <script> without a src attribute or a custom non-script component using an importance prop.',
    ],
  },
};

export default [
  optimizeScriptPriorityRule,
] satisfies readonly AnalyzerRule[];
