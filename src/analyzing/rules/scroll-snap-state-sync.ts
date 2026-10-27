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
  resolveLocalExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLL_SNAP_STATE_SYNC_GUIDE_HASH = '7250daa605e5';

const SNAP_CHANGE_GUARD_TOKENS = [
  'onscrollsnapchange',
  'scrollsnapchange',
] as const;

const SNAP_ROUND_MATH_REGEX =
  /Math\.(?:round|floor)\s*\(\s*[^)]*\b(?:scrollLeft|scrollTop)\b[^)]*\//;

const SNAP_CONTEXT_REGEX =
  /\b(?:snap|carousel|slider|slide|slides|gallery|pager|pagination|dot|dots|indicator|indicators|card|cards|panel|panels|index|idx|active|current|pending|selected)\b/i;

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

  const rawHandlerText = listener.handlerNode.getText();
  const handlerNode = resolveCallableNode(listener.handlerNode);
  const handlerText = handlerNode.getText();

  if (!SNAP_ROUND_MATH_REGEX.test(handlerText)) {
    return null;
  }

  const targetText = listener.targetNode
    ? `${listener.targetNode.getText()} ${resolveLocalExpression(listener.targetNode, 2).getText()}`
    : '';
  if (
    !SNAP_CONTEXT_REGEX.test(handlerText) &&
    !SNAP_CONTEXT_REGEX.test(targetText)
  ) {
    return null;
  }

  if (listener.eventName === 'scroll') {
    const hasDebounce =
      (/\bsetTimeout\b/.test(handlerText) &&
        /\bclearTimeout\b/.test(handlerText)) ||
      /\bdebounce\b/i.test(rawHandlerText) ||
      /\bdebounce\b/i.test(handlerText);
    if (!hasDebounce) {
      return null;
    }
    return 'Debounced scroll listener computing snapped index via Math.round(scrollLeft / ...) or Math.round(scrollTop / ...) can be modernized with the native scrollsnapchange event.';
  }

  return 'scrollend listener computing snapped index via Math.round(scrollLeft / ...) or Math.round(scrollTop / ...) can be modernized with the native scrollsnapchange event.';
}

export const scrollSnapStateSyncMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['Math.round', 'Math.floor'],
  isGuarded: (node, sourceFile) => isGuardedBySnapChange(node, sourceFile),
  matchCall: matchSnapStateSyncListener,
});

export const scrollSnapStateSyncRule: AnalyzerRule = {
  id: 'scroll-snap-state-sync',
  guideId: 'scroll-snap-state-sync',
  guideHash: SCROLL_SNAP_STATE_SYNC_GUIDE_HASH,
  summary:
    'Debounced scroll listeners (with setTimeout/clearTimeout) and scrollend listeners computing snapped index via Math.round(el.scrollLeft / ...) or Math.round(el.scrollTop / ...) should be modernized with the scrollsnapchange event.',
  matcher: scrollSnapStateSyncMatcher,
  verifierRubric: {
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
