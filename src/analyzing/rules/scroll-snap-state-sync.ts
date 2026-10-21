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

export const SCROLL_SNAP_STATE_SYNC_GUIDE_HASH = '7250daa605e5';

const SNAP_CHANGE_GUARD_TOKENS = [
  'onscrollsnapchange',
  'scrollsnapchange',
] as const;

const SNAP_ROUND_MATH_REGEX =
  /Math\.round\s*\(\s*[^)]*\b(?:scrollLeft|scrollTop)\b[^)]*\//;

function isGuardedBySnapChange(node: Node, sourceFile: SourceFile): boolean {
  if (isProtectedByFeatureGuard(node, SNAP_CHANGE_GUARD_TOKENS)) {
    return true;
  }
  if (/\bscrollsnapchange\b/.test(sourceFile.getText())) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        SNAP_CHANGE_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function matchSnapStateSyncListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['scroll', 'scrollend']);
  if (!listener) {
    return null;
  }

  const handlerNode = resolveCallableNode(listener.handlerNode);
  const handlerText = handlerNode.getText();

  if (!SNAP_ROUND_MATH_REGEX.test(handlerText)) {
    return null;
  }

  if (listener.eventName === 'scroll') {
    const hasDebounce =
      /\bsetTimeout\b/.test(handlerText) && /\bclearTimeout\b/.test(handlerText);
    if (!hasDebounce) {
      return null;
    }
    return 'Debounced scroll listener computing snapped index via Math.round(scrollLeft / ...) or Math.round(scrollTop / ...) can be modernized with the native scrollsnapchange event.';
  }

  return 'scrollend listener computing snapped index via Math.round(scrollLeft / ...) or Math.round(scrollTop / ...) can be modernized with the native scrollsnapchange event.';
}

export const scrollSnapStateSyncMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['scroll', 'scrollend', 'scrollLeft', 'scrollTop', 'Math.round'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedBySnapChange(node, sourceFile)) {
        return;
      }

      const message = matchSnapStateSyncListener(node);
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

export const scrollSnapStateSyncRule: AnalyzerRule = {
  id: 'scroll-snap-state-sync',
  guideId: 'scroll-snap-state-sync',
  guideHash: SCROLL_SNAP_STATE_SYNC_GUIDE_HASH,
  summary:
    'Debounced scroll listeners (with setTimeout/clearTimeout) and scrollend listeners computing snapped index via Math.round(el.scrollLeft / ...) or Math.round(el.scrollTop / ...) should be modernized with the scrollsnapchange event.',
  matcher: scrollSnapStateSyncMatcher,
  phase2Rubric: {
    keepWhen: [
      'A scroll listener with setTimeout / clearTimeout debounce or a scrollend listener without scrollsnapchange computes the settled snap index via Math.round(el.scrollLeft / width) or Math.round(el.scrollTop / height) to sync state after snapping finishes.',
    ],
    dropWhen: [
      'The listener is guarded by "onscrollsnapchange" in window or HTMLElement.prototype, or the file already listens to scrollsnapchange.',
      'Non-debounced scroll listeners updating real-time pre-settle feedback during scrolling (covered by scroll-snap-realtime-feedback).',
    ],
  },
};

export const scrollSnapStateSyncRules: readonly AnalyzerRule[] = [
  scrollSnapStateSyncRule,
];
