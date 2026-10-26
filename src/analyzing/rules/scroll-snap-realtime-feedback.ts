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
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLL_SNAP_REALTIME_FEEDBACK_GUIDE_HASH = '0faa62092490';

const SNAP_CHANGING_GUARD_TOKENS = [
  'onscrollsnapchanging',
  'scrollsnapchanging',
] as const;

const SNAP_ROUND_MATH_REGEX =
  /Math\.(?:round|floor)\s*\(\s*[^)]*\b(?:scrollLeft|scrollTop)\b[^)]*\/|Math\.abs\s*\(\s*[^)]*\b(?:offsetLeft|offsetTop)\b[^)]*-\s*[^)]*\b(?:scrollLeft|scrollTop)\b|Math\.abs\s*\(\s*[^)]*\b(?:scrollLeft|scrollTop)\b[^)]*-\s*[^)]*\b(?:offsetLeft|offsetTop)\b/;

const SNAP_CONTEXT_REGEX =
  /\b(?:snap|carousel|slider|slide|slides|gallery|pager|pagination|dot|dots|indicator|indicators|card|cards|panel|panels|index|idx|active|current|pending|selected)\b/i;

function isGuardedBySnapChanging(node: Node, sourceFile: SourceFile): boolean {
  if (isProtectedByFeatureGuard(node, SNAP_CHANGING_GUARD_TOKENS)) {
    return true;
  }
  if (/\bscrollsnapchanging\b/.test(sourceFile.getText())) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        SNAP_CHANGING_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function matchRealtimeSnapScrollListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['scroll']);
  if (!listener) {
    return null;
  }

  const rawHandlerText = listener.handlerNode.getText();
  const handlerNode = resolveCallableNode(listener.handlerNode);
  const handlerText = handlerNode.getText();

  if (
    /\b(?:setTimeout|clearTimeout|debounce)\b/i.test(rawHandlerText) ||
    /\b(?:setTimeout|clearTimeout|debounce)\b/i.test(handlerText)
  ) {
    return null;
  }

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

  return 'Non-debounced scroll listener computing active snap index via Math.round(scrollLeft / ...) or Math.round(scrollTop / ...) can be modernized with the native scrollsnapchanging event.';
}

export const scrollSnapRealtimeFeedbackMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['Math.round', 'Math.abs'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const message = matchRealtimeSnapScrollListener(node);
      if (message && !isGuardedBySnapChanging(node, sourceFile)) {
        matches.push({
          line: node.getStartLineNumber(),
          message,
        });
      }
    });

    return matches;
  },
};

export const scrollSnapRealtimeFeedbackRule: AnalyzerRule = {
  id: 'scroll-snap-realtime-feedback',
  guideId: 'scroll-snap-realtime-feedback',
  guideHash: SCROLL_SNAP_REALTIME_FEEDBACK_GUIDE_HASH,
  summary:
    'Non-debounced scroll event listeners computing active snap index via Math.round(el.scrollLeft / ...) or Math.round(el.scrollTop / ...) during scrolling should be modernized with the scrollsnapchanging event.',
  matcher: scrollSnapRealtimeFeedbackMatcher,
  verifierRubric: {
    keepWhen: [
      'A non-debounced scroll event listener computes the active snap index via Math.round(el.scrollLeft / width), Math.round(el.scrollTop / height), or Math.abs(childLeft - scrollLeft) to update active snap UI during scrolling.',
    ],
    dropWhen: [
      'The listener is guarded by "onscrollsnapchanging" in window or Element.prototype, or the file already listens to scrollsnapchanging.',
      'Debounced scroll or scrollend listeners that only sync state after scrolling settles (covered by scroll-snap-state-sync).',
    ],
  },
};

export const scrollSnapRealtimeFeedbackRules: readonly AnalyzerRule[] = [
  scrollSnapRealtimeFeedbackRule,
];
