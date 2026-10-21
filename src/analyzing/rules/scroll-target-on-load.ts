import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLL_TARGET_ON_LOAD_GUIDE_HASH = 'fa7c8b4bb8fa';

const SCROLL_INITIAL_TARGET_GUARD_TOKENS = [
  'scroll-initial-target',
  'scrollInitialTarget',
] as const;

function isGuardedByScrollInitialTarget(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, SCROLL_INITIAL_TARGET_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        SCROLL_INITIAL_TARGET_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
        current.getExpression().getDescendantsOfKind(SyntaxKind.ExclamationToken).length > 0 &&
        node.getStart() >= current.getThenStatement().getStart() &&
        node.getEnd() <= current.getThenStatement().getEnd()
      ) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchScrollTargetOnLoadListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['DOMContentLoaded', 'load']);
  if (!listener) {
    return null;
  }

  const handlerNode = resolveCallableNode(listener.handlerNode);
  const handlerText = handlerNode.getText();

  if (
    SCROLL_INITIAL_TARGET_GUARD_TOKENS.some((tok) => handlerText.includes(tok))
  ) {
    return null;
  }

  const callsScrollIntoView = /\.scrollIntoView\s*\(/.test(handlerText);
  const callsWindowScrollTo = /\b(?:window\.)?scrollTo\s*\(/.test(handlerText);
  if (!callsScrollIntoView && !callsWindowScrollTo) {
    return null;
  }

  const readsLocationHash = /\blocation\.hash\b/.test(handlerText);
  const queriesTargetForScrollIntoView =
    callsScrollIntoView &&
    /\b(?:querySelector|getElementById)\s*\(/.test(handlerText);

  if (!readsLocationHash && !queriesTargetForScrollIntoView) {
    return null;
  }

  return `Imperative '${listener.eventName}' listener scrolling to an initial target element can be modernized with CSS scroll-initial-target: nearest or native fragment navigation.`;
}

export const scrollTargetOnLoadMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['DOMContentLoaded', 'load', 'scrollIntoView', 'scrollTo'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByScrollInitialTarget(node)) {
        return;
      }

      const message = matchScrollTargetOnLoadListener(node);
      if (message) {
        matches.push({
          line: node.getStartLineNumber(),
          message,
        });
      }
    });

    return matches;
  },
};

export const scrollTargetOnLoadRule: AnalyzerRule = {
  id: 'scroll-target-on-load',
  guideId: 'scroll-target-on-load',
  guideHash: SCROLL_TARGET_ON_LOAD_GUIDE_HASH,
  summary:
    'DOMContentLoaded and load listeners manually scrolling to an initial target via location.hash or scrollIntoView / window.scrollTo should be modernized with CSS scroll-initial-target: nearest.',
  matcher: scrollTargetOnLoadMatcher,
  phase2Rubric: {
    keepWhen: [
      'A DOMContentLoaded or load event listener reads location.hash or queries an initial target element and calls scrollIntoView() or window.scrollTo() on initial page load.',
      'useEffect / componentDidMount / DOMContentLoaded scrollIntoView() calls centering an initial tab, card, or chat item.',
    ],
    dropWhen: [
      'The listener is guarded by CSS.supports("scroll-initial-target", "nearest").',
      'User click scroll transitions or runtime interactive navigation handlers.',
    ],
  },
};

export const scrollTargetOnLoadRules: readonly AnalyzerRule[] = [
  scrollTargetOnLoadRule,
];
