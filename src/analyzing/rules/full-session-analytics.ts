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

export const FULL_SESSION_ANALYTICS_GUIDE_HASH = 'adc2b61cbf18';

const FETCH_LATER_GUARD_TOKENS = ['fetchLater'] as const;

const SESSION_FLUSH_EVENTS = ['visibilitychange', 'pagehide'] as const;

const SEND_BEACON_RE = /\b(?:navigator\.)?sendBeacon\s*\(/;
const FETCH_KEEPALIVE_RE = /\bfetch\s*\([\s\S]*?\bkeepalive\s*:\s*true\b/;

function accumulatesForegroundDuration(handlerNode: Node): boolean {
  const resolved = resolveCallableNode(handlerNode, 2);
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
    }
  });

  return hasSubtraction && hasAccumulation;
}

function hasSessionBeaconDispatch(handlerNode: Node): boolean {
  const resolved = resolveCallableNode(handlerNode, 2);
  const text = resolved.getText();
  return SEND_BEACON_RE.test(text) || FETCH_KEEPALIVE_RE.test(text);
}

function matchLifecycleBeaconListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, SESSION_FLUSH_EVENTS);
  if (!listener) {
    return null;
  }
  if (accumulatesForegroundDuration(listener.handlerNode)) {
    return null;
  }
  if (!hasSessionBeaconDispatch(listener.handlerNode)) {
    return null;
  }
  return `Immediate beacon dispatch inside '${listener.eventName}' listener; use fetchLater() with an AbortController to queue and update full-session analytics payloads so the browser sends a single final payload when the session ends.`;
}

function matchOnLifecycleBeaconAssignment(binaryExpr: BinaryExpression): string | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return null;
  }
  const left = unwrapExpression(binaryExpr.getLeft());
  const propName = Node.isPropertyAccessExpression(left)
    ? left.getName()
    : Node.isIdentifier(left)
      ? left.getText()
      : '';
  if (propName !== 'onvisibilitychange' && propName !== 'onpagehide') {
    return null;
  }
  if (accumulatesForegroundDuration(binaryExpr.getRight())) {
    return null;
  }
  if (!hasSessionBeaconDispatch(binaryExpr.getRight())) {
    return null;
  }
  return `Immediate beacon dispatch inside '${propName}' handler; use fetchLater() with an AbortController to queue and update full-session analytics payloads.`;
}

export const fullSessionAnalyticsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['sendBeacon', 'keepalive'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    if (ctx.fileContent.includes('fetchLater')) {
      return [];
    }
    if (
      !ctx.fileContent.includes('sendBeacon') &&
      !ctx.fileContent.includes('keepalive')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const message = matchLifecycleBeaconListener(node);
        if (message && !isProtectedByFeatureGuard(node, FETCH_LATER_GUARD_TOKENS)) {
          matches.push({
            line: node.getStartLineNumber(),
            message,
          });
        }
        return;
      }

      if (Node.isBinaryExpression(node)) {
        const message = matchOnLifecycleBeaconAssignment(node);
        if (message && !isProtectedByFeatureGuard(node, FETCH_LATER_GUARD_TOKENS)) {
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

export const fullSessionAnalyticsRule: AnalyzerRule = {
  id: 'full-session-analytics',
  guideId: 'full-session-analytics',
  guideHash: FULL_SESSION_ANALYTICS_GUIDE_HASH,
  summary:
    'visibilitychange and pagehide listeners flushing session telemetry via navigator.sendBeacon() or fetch({ keepalive: true }) should be modernized with fetchLater() and AbortController.',
  matcher: fullSessionAnalyticsMatcher,
  verifierRubric: {
    keepWhen: [
      'A visibilitychange or pagehide listener (or onvisibilitychange / onpagehide handler) flushes session analytics, telemetry, or metrics using navigator.sendBeacon() or fetch(..., { keepalive: true }) instead of queuing updates with fetchLater().',
    ],
    dropWhen: [
      'The code already uses fetchLater() or implements a fetchLater fallback polyfill for unsupported browsers.',
      'Immediate real-time user-action requests (such as form submissions or checkout mutations) not tied to visibilitychange or pagehide session teardown.',
    ],
  },
};

export default [
  fullSessionAnalyticsRule,
] satisfies readonly AnalyzerRule[];
