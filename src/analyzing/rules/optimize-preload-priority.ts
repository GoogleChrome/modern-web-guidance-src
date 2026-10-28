import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const OPTIMIZE_PRELOAD_PRIORITY_GUIDE_HASH = 'ea1849af9c5f';

const VALID_IMPORTANCE_VALUES = new Set(['high', 'low', 'auto']);

function isHrefReferencedInCssBackground(
  documentText: string,
  href: string,
): boolean {
  if (!href) {
    return false;
  }
  const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bgUrlRegex = new RegExp(
    `background(?:-image|Image)?\\s*[:=][^;{}]*url\\(\\s*['"]?${escapedHref}['"]?\\s*\\)`,
    'i',
  );
  return bgUrlRegex.test(documentText);
}

function isOwnedByOptimizeImagePriority(
  element: DomElementView,
  ctx: DomMatcherContext,
): boolean {
  const rel = (element.getAttribute('rel') ?? '').trim().toLowerCase();
  const asAttr = (element.getAttribute('as') ?? '').trim().toLowerCase();
  if (rel !== 'preload' || asAttr !== 'image') {
    return false;
  }
  if (
    element.hasAttribute('fetchpriority') ||
    element.hasAttribute('fetchPriority') ||
    element.hasAttribute('imagesrcset') ||
    element.hasAttribute('imageSrcSet')
  ) {
    return false;
  }
  if (!/<img\b/i.test(ctx.documentText)) {
    return false;
  }
  const href = (element.getAttribute('href') ?? '').trim();
  return !isHrefReferencedInCssBackground(ctx.documentText, href);
}

export const optimizePreloadPriorityMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'link[importance]',
  fastTokens: ['importance'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['fetchpriority', 'fetchPriority', 'importance'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    if (element.tagName !== 'link') {
      return null;
    }

    if (
      element.hasDynamicAttribute?.('fetchpriority') ||
      element.hasDynamicAttribute?.('fetchPriority') ||
      element.hasDynamicAttribute?.('importance')
    ) {
      return null;
    }

    const relTokens = (element.getAttribute('rel') ?? '')
      .trim()
      .toLowerCase()
      .split(/\s+/);
    if (!relTokens.includes('preload') && !relTokens.includes('modulepreload')) {
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

    if (isOwnedByOptimizeImagePriority(element, ctx)) {
      return null;
    }

    return {
      message: `Deprecated importance="${importance}" attribute on <link rel="${relTokens.includes('modulepreload') ? 'modulepreload' : 'preload'}"> should be replaced with standard fetchpriority="${importance}".`,
    };
  },
};

export const optimizePreloadPriorityRule: AnalyzerRule = {
  id: 'optimize-preload-priority',
  guideId: 'optimize-preload-priority',
  guideHash: OPTIMIZE_PRELOAD_PRIORITY_GUIDE_HASH,
  summary:
    'Replace deprecated importance attribute on <link rel="preload"> with standard fetchpriority.',
  matcher: optimizePreloadPriorityMatcher,
  verifierRubric: {
    keepWhen: [
      'A <link rel="preload"> or <link rel="modulepreload"> element uses the deprecated importance="high|low|auto" attribute instead of fetchpriority.',
    ],
    dropWhen: [
      'The <link rel="preload"> already specifies a matching fetchpriority attribute.',
      'The <link> element is not a preload (for example rel="stylesheet" or rel="prefetch").',
    ],
  },
};

export default [
  optimizePreloadPriorityRule,
] satisfies readonly AnalyzerRule[];
