import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CALCULATE_TOTAL_FOREGROUND_TIME_GUIDE_HASH = 'c851149e972b';

const VISIBILITY_STATE_GUARD_TOKENS = [
  'visibility-state',
  'VisibilityStateEntry',
] as const;

const VISIBILITY_PROP_RE =
  /\b(?:visibilityState|hidden|webkitHidden|mozHidden)\b/;

const TIMESTAMP_CALL_RE =
  /\b(?:performance\.now|Date\.now|\.getTime)\s*\(|\bnew\s+Date\s*\(|\btimeStamp\b/;

function accumulatesForegroundDuration(handlerNode: Node): boolean {
  const resolved = resolveCallableNode(handlerNode, 2);
  const text = resolved.getText();
  if (!VISIBILITY_PROP_RE.test(text)) {
    return false;
  }
  if (!TIMESTAMP_CALL_RE.test(text)) {
    return false;
  }

  let hasSubtraction = false;
  let hasAccumulation = false;

  resolved.forEachDescendant((node) => {
    if (!Node.isBinaryExpression(node)) {
      return;
    }
    const op = node.getOperatorToken().getKind();
    if (op === SyntaxKind.MinusToken) {
      hasSubtraction = true;
    } else if (op === SyntaxKind.PlusEqualsToken) {
      hasAccumulation = true;
    } else if (op === SyntaxKind.EqualsToken) {
      const right = unwrapExpression(node.getRight());
      if (
        Node.isBinaryExpression(right) &&
        right.getOperatorToken().getKind() === SyntaxKind.PlusToken
      ) {
        hasAccumulation = true;
      }
    }
  });

  return hasSubtraction && hasAccumulation;
}

function matchVisibilityDurationListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['visibilitychange']);
  if (!listener) {
    return null;
  }
  if (!accumulatesForegroundDuration(listener.handlerNode)) {
    return null;
  }
  return "Manual foreground duration accumulation in a 'visibilitychange' listener; query performance.getEntriesByType('visibility-state') (VisibilityStateEntry API) to compute total foreground time from the Performance Timeline.";
}

function matchOnVisibilityChangeAssignment(binaryExpr: BinaryExpression): string | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return null;
  }
  const left = unwrapExpression(binaryExpr.getLeft());
  const propName = Node.isPropertyAccessExpression(left)
    ? left.getName()
    : Node.isIdentifier(left)
      ? left.getText()
      : '';
  if (propName !== 'onvisibilitychange') {
    return null;
  }
  if (!accumulatesForegroundDuration(binaryExpr.getRight())) {
    return null;
  }
  return "Manual foreground duration accumulation in 'onvisibilitychange' handler; query performance.getEntriesByType('visibility-state') (VisibilityStateEntry API) to compute total foreground time.";
}

export const calculateTotalForegroundTimeMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['visibilitychange', 'onvisibilitychange'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    if (
      ctx.fileContent.includes('visibility-state') ||
      ctx.fileContent.includes('VisibilityStateEntry')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const message = matchVisibilityDurationListener(node);
        if (message && !isProtectedByFeatureGuard(node, VISIBILITY_STATE_GUARD_TOKENS)) {
          matches.push({
            line: node.getStartLineNumber(),
            message,
          });
        }
        return;
      }

      if (Node.isBinaryExpression(node)) {
        const message = matchOnVisibilityChangeAssignment(node);
        if (message && !isProtectedByFeatureGuard(node, VISIBILITY_STATE_GUARD_TOKENS)) {
          matches.push({
            line: node.getStartLineNumber(),
            message,
          });
        }
      }
    });

    return matches;
  },
};

export const calculateTotalForegroundTimeRule: AnalyzerRule = {
  id: 'calculate-total-foreground-time',
  guideId: 'calculate-total-foreground-time',
  guideHash: CALCULATE_TOTAL_FOREGROUND_TIME_GUIDE_HASH,
  summary:
    "visibilitychange listeners manually accumulating foreground duration with performance.now() or Date.now() should be modernized with performance.getEntriesByType('visibility-state').",
  matcher: calculateTotalForegroundTimeMatcher,
  verifierRubric: {
    keepWhen: [
      'A visibilitychange listener or onvisibilitychange handler manually tracks visible/hidden state transitions and accumulates elapsed foreground time using performance.now(), Date.now(), getTime(), or event.timeStamp.',
    ],
    dropWhen: [
      "The code already queries performance.getEntriesByType('visibility-state') and uses performance.now() as a fallback.",
      'A visibilitychange listener only pauses/resumes media playback, animations, or polling timers without accumulating total visible duration.',
      'An idle-timeout detector checks whether a single hidden interval exceeded a threshold to log out or refresh a session rather than summing cumulative foreground time.',
    ],
  },
};

export default [
  calculateTotalForegroundTimeRule,
] satisfies readonly AnalyzerRule[];
