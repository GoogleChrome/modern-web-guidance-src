import {
  Node,
  SyntaxKind,
  type CallExpression,
  type PropertyAccessExpression,
  type BinaryExpression,
  type SourceFile,
} from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH = 'b881da0b6ea2';

const STANDARD_VISIBILITY_GUARD_TOKENS = [
  'visibilityState',
  'hidden',
  'visibilitychange',
] as const;

const VENDOR_VISIBILITY_PROPERTIES = new Set([
  'webkitHidden',
  'mozHidden',
  'msHidden',
  'webkitVisibilityState',
  'mozVisibilityState',
  'msVisibilityState',
]);

const VENDOR_VISIBILITY_EVENTS = new Set([
  'webkitvisibilitychange',
  'mozvisibilitychange',
  'msvisibilitychange',
]);

/**
 * Checks whether a property access expression accesses a vendor-prefixed visibility property.
 */
function matchVendorPropertyAccess(propAccess: PropertyAccessExpression): AnalyzerMatch | null {
  const propName = propAccess.getName();
  if (!VENDOR_VISIBILITY_PROPERTIES.has(propName)) {
    return null;
  }

  // Verify caller is document or window.document or this.document
  const caller = unwrapExpression(propAccess.getExpression());
  const callerText = caller.getText();
  const isDocument =
    callerText === 'document' ||
    callerText === 'window.document' ||
    callerText === 'globalThis.document' ||
    callerText === 'this.document' ||
    callerText === 'doc' ||
    callerText === 'd';

  if (!isDocument) {
    return null;
  }

  if (isProtectedByFeatureGuard(propAccess, STANDARD_VISIBILITY_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: propAccess.getStartLineNumber(),
    message: `Legacy vendor-prefixed Page Visibility property 'document.${propName}' used instead of standard document.visibilityState / document.hidden.`,
  };
}

/**
 * Checks for `'webkitHidden' in document` or similar in-expressions.
 */
function matchVendorInExpression(binaryExpr: BinaryExpression): AnalyzerMatch | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.InKeyword) {
    return null;
  }

  const left = unwrapExpression(binaryExpr.getLeft());
  if (!Node.isStringLiteral(left) && !Node.isNoSubstitutionTemplateLiteral(left)) {
    return null;
  }

  const propName = left.getLiteralText();
  if (!VENDOR_VISIBILITY_PROPERTIES.has(propName)) {
    return null;
  }

  if (isProtectedByFeatureGuard(binaryExpr, STANDARD_VISIBILITY_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: binaryExpr.getStartLineNumber(),
    message: `Legacy vendor-prefixed Page Visibility property check '${propName}' in document used instead of standard document.visibilityState.`,
  };
}

/**
 * Checks for addEventListener('webkitvisibilitychange', ...) or similar event listener registrations.
 */
function matchVendorEventListener(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (methodName !== 'addEventListener' && methodName !== 'on') {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  const firstArg = unwrapExpression(args[0]);
  if (!Node.isStringLiteral(firstArg) && !Node.isNoSubstitutionTemplateLiteral(firstArg)) {
    return null;
  }

  const eventName = firstArg.getLiteralText().toLowerCase();
  if (!VENDOR_VISIBILITY_EVENTS.has(eventName)) {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, STANDARD_VISIBILITY_GUARD_TOKENS)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Legacy vendor-prefixed visibility event '${eventName}' listened to instead of standard 'visibilitychange'.`,
  };
}

export const detectInitialVisibilityStateMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'webkitHidden',
    'mozHidden',
    'msHidden',
    'webkitVisibilityState',
    'mozVisibilityState',
    'msVisibilityState',
    'webkitvisibilitychange',
    'mozvisibilitychange',
    'msvisibilitychange',
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    for (const propAccess of propAccesses) {
      const match = matchVendorPropertyAccess(propAccess);
      if (match) {
        matches.push(match);
      }
    }

    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const binExpr of binaryExpressions) {
      const match = matchVendorInExpression(binExpr);
      if (match) {
        matches.push(match);
      }
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchVendorEventListener(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const detectInitialVisibilityStateRule: AnalyzerRule = {
  id: 'detect-initial-visibility-state',
  guideId: 'detect-initial-visibility-state',
  guideHash: DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH,
  summary:
    'Flag legacy vendor-prefixed Page Visibility API accesses (document.webkitHidden, webkitVisibilityState, webkitvisibilitychange) when not paired with standard document.visibilityState / document.hidden as the primary check.',
  matcher: detectInitialVisibilityStateMatcher,
  phase2Rubric: {
    keepWhen: [
      'Vendor-prefixed Page Visibility properties (document.webkitHidden, mozHidden, msHidden, webkitVisibilityState) or events (webkitvisibilitychange, mozvisibilitychange) used directly without standard document.visibilityState or document.hidden as the primary check.',
      'Browser-specific visibility detection logic that assumes vendor prefixes are required for page visibility monitoring.',
    ],
    dropWhen: [
      'Vendor-prefixed properties used strictly as a secondary fallback branch behind standard document.visibilityState or document.hidden (e.g. document.hidden ?? document.webkitHidden or in an else branch).',
      'Feature detection libraries (e.g. Modernizr or polyfill suites) auditing legacy browser capabilities or compiling engine compatibility matrices.',
      'CSS vendor-prefixed class names or selectors unrelated to the DOM Page Visibility API.',
    ],
  },
};
