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

export const BATCH_ANALYTICS_EVENTS_GUIDE_HASH = '755087934fc0';

const MODERN_BEACON_GUARD_TOKENS = [
  'fetchLater',
  'visibilitychange',
  'pagehide',
] as const;

function hasUnloadTelemetryDispatch(handlerNode: Node): boolean {
  const resolved = resolveCallableNode(handlerNode);
  const text = resolved.getText();

  const callsSendBeacon = /\b(?:navigator\.)?sendBeacon\s*\(/.test(text);
  const callsFetch = /\bfetch\s*\(/.test(text);
  const usesSyncXhr =
    /\bXMLHttpRequest\b/.test(text) ||
    /\.open\s*\(\s*['"`](?:POST|GET|PUT)['"`]\s*,[^,]+,\s*false\s*\)/i.test(
      text,
    );

  return callsSendBeacon || callsFetch || usesSyncXhr;
}

function matchUnloadBeaconListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['unload', 'beforeunload']);
  if (!listener) {
    return null;
  }

  if (!hasUnloadTelemetryDispatch(listener.handlerNode)) {
    return null;
  }

  return `Dispatches telemetry inside '${listener.eventName}' listener; modernize with visibilitychange or pagehide listeners and navigator.sendBeacon() or fetch({ keepalive: true }) so bfcache and reliability are preserved.`;
}

function matchOnUnloadAssignment(binaryExpr: BinaryExpression): string | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return null;
  }

  const left = unwrapExpression(binaryExpr.getLeft());
  const propName = Node.isPropertyAccessExpression(left)
    ? left.getName()
    : Node.isIdentifier(left)
      ? left.getText()
      : '';

  if (propName !== 'onunload' && propName !== 'onbeforeunload') {
    return null;
  }

  if (!hasUnloadTelemetryDispatch(binaryExpr.getRight())) {
    return null;
  }

  return `Dispatches telemetry inside '${propName}' handler; modernize with visibilitychange or pagehide listeners and navigator.sendBeacon() or fetch({ keepalive: true }).`;
}

function fileAlreadyUsesModernLifecycleBeacon(sourceFile: SourceFile): boolean {
  const fileText = sourceFile.getText();
  if (/\bfetchLater\s*\(/.test(fileText)) {
    return true;
  }
  let hasModernListener = false;
  sourceFile.forEachDescendant((node) => {
    if (hasModernListener || !Node.isCallExpression(node)) {
      return;
    }
    const listener = matchEventListenerCall(node, [
      'visibilitychange',
      'pagehide',
    ]);
    if (listener && hasUnloadTelemetryDispatch(listener.handlerNode)) {
      hasModernListener = true;
    }
  });
  return hasModernListener;
}

export const batchAnalyticsEventsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['unload', 'beforeunload', 'onbeforeunload', 'onunload'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    if (fileAlreadyUsesModernLifecycleBeacon(sourceFile)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const message = matchUnloadBeaconListener(node);
        if (message && !isProtectedByFeatureGuard(node, MODERN_BEACON_GUARD_TOKENS)) {
          matches.push({
            line: node.getStartLineNumber(),
            message,
          });
        }
        return;
      }

      if (Node.isBinaryExpression(node)) {
        const message = matchOnUnloadAssignment(node);
        if (message && !isProtectedByFeatureGuard(node, MODERN_BEACON_GUARD_TOKENS)) {
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

export const batchAnalyticsEventsRule: AnalyzerRule = {
  id: 'batch-analytics-events',
  guideId: 'batch-analytics-events',
  guideHash: BATCH_ANALYTICS_EVENTS_GUIDE_HASH,
  summary:
    'unload and beforeunload event listeners dispatching analytics via navigator.sendBeacon(), fetch(), or synchronous XMLHttpRequest should be modernized with visibilitychange or pagehide listeners and navigator.sendBeacon() or fetch({ keepalive: true }).',
  matcher: batchAnalyticsEventsMatcher,
  verifierRubric: {
    keepWhen: [
      'An unload or beforeunload event listener dispatches analytics or telemetry via navigator.sendBeacon(), fetch(), or synchronous XMLHttpRequest (xhr.open("POST", url, false)).',
    ],
    dropWhen: [
      'The code already listens to visibilitychange or pagehide (or uses fetchLater()) for end-of-session telemetry.',
      'A beforeunload listener only prompts the user about unsaved changes (event.preventDefault() / event.returnValue) without dispatching network beacons.',
      'Standard asynchronous fetch() during active user interaction or WebSocket connections.',
    ],
  },
};

export const batchAnalyticsEventsRules: readonly AnalyzerRule[] = [
  batchAnalyticsEventsRule,
];
