import {
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const DEFER_RENDERING_HEAVY_CONTENT_GUIDE_HASH = 'e8bd3b16f836';

const CONTENT_VISIBILITY_GUARD_TOKENS = [
  'content-visibility',
  'contentVisibility',
] as const;

const INTERSECTION_CHECK_RE = /\b(?:isIntersecting|intersectionRatio)\b/;

const STATIC_DOM_MOUNT_RE =
  /\b(?:innerHTML|outerHTML)\s*=|\.(?:insertAdjacentHTML|cloneNode|importNode|replaceChildren)\s*\(/;

const DISQUALIFYING_CALLBACK_RE =
  /\b(?:fetch|XMLHttpRequest|requestAnimationFrame|cancelAnimationFrame|setInterval|clearInterval|async|await)\b|\.(?:then|src|srcset|poster|dataSrc|classList|play|pause|load|animate)\b|dataset\.(?:src|srcset|poster|lazy|bg)|setAttribute\s*\(\s*['"](?:src|srcset|poster|href)['"]/i;

function matchDeferredDomObserver(
  newExpr: NewExpression,
  sourceFile: SourceFile,
): string | null {
  const fileText = sourceFile.getFullText();
  if (
    fileText.includes('content-visibility') ||
    fileText.includes('contentVisibility')
  ) {
    return null;
  }

  const callee = unwrapExpression(newExpr.getExpression());
  if (!isGlobalReference(callee, 'IntersectionObserver')) {
    return null;
  }

  const args = newExpr.getArguments();
  if (args.length === 0 || !args[0]) {
    return null;
  }

  const callbackNode = resolveCallableNode(args[0], 2);
  const callbackText = callbackNode.getText();

  if (!INTERSECTION_CHECK_RE.test(callbackText)) {
    return null;
  }
  if (DISQUALIFYING_CALLBACK_RE.test(callbackText)) {
    return null;
  }
  if (!STATIC_DOM_MOUNT_RE.test(callbackText)) {
    return null;
  }

  return 'IntersectionObserver used to defer mounting static off-screen DOM content; use CSS content-visibility: auto paired with contain-intrinsic-size so the browser skips off-screen layout and paint natively.';
}

export const deferRenderingHeavyContentMatcher: JsRuleMatcher =
  createJsCallMatcher({
    fastTokens: ['IntersectionObserver'],
    isGuarded: (node) =>
      isProtectedByFeatureGuard(node, CONTENT_VISIBILITY_GUARD_TOKENS),
    matchNew: (node, sourceFile) => matchDeferredDomObserver(node, sourceFile),
  });

export const deferRenderingHeavyContentRule: AnalyzerRule = {
  id: 'defer-rendering-heavy-content',
  guideId: 'defer-rendering-heavy-content',
  guideHash: DEFER_RENDERING_HEAVY_CONTENT_GUIDE_HASH,
  summary:
    'IntersectionObserver callbacks deferring static off-screen DOM rendering should be modernized with CSS content-visibility: auto and contain-intrinsic-size.',
  matcher: deferRenderingHeavyContentMatcher,
  verifierRubric: {
    keepWhen: [
      'An IntersectionObserver defers rendering static off-screen DOM sections or <template> subtrees until scrolled near the viewport purely to avoid initial layout and paint work, where CSS content-visibility: auto with contain-intrinsic-size can replace manual DOM deferral.',
    ],
    dropWhen: [
      'IntersectionObserver callbacks that fetch remote data over the network, trigger infinite scroll pagination, or lazy-load external media/image/iframe src URLs.',
      'IntersectionObserver callbacks that trigger scroll-driven entry animations, update scrollspy navigation state, or pause background timers.',
    ],
  },
};

export default [
  deferRenderingHeavyContentRule,
] satisfies readonly AnalyzerRule[];
