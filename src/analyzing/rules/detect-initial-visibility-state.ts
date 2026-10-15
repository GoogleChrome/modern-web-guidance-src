import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type PropertyAccessExpression,
  type SourceFile,
} from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { unwrapExpression } from '../scanners/ast-helpers.ts';

export const DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH = 'b881da0b6ea2';

const VISIBILITY_PROPERTIES = new Set([
  'visibilityState',
  'hidden',
  'webkitHidden',
  'mozHidden',
  'msHidden',
  'webkitVisibilityState',
  'mozVisibilityState',
  'msVisibilityState',
]);

const VISIBILITY_EVENTS = new Set([
  'visibilitychange',
  'webkitvisibilitychange',
  'mozvisibilitychange',
  'msvisibilitychange',
]);

/**
 * Checks whether an expression references document or window.document.
 */
function isDocumentTarget(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  const text = unwrapped.getText();
  return (
    text === 'document' ||
    text === 'window.document' ||
    text === 'globalThis.document' ||
    text === 'this.document' ||
    text === 'doc' ||
    text === 'd'
  );
}

/**
 * Checks whether a property access expression accesses document.visibilityState, document.hidden,
 * or vendor-prefixed equivalents.
 */
function matchVisibilityPropertyAccess(propAccess: PropertyAccessExpression): AnalyzerMatch | null {
  const propName = propAccess.getName();
  if (!VISIBILITY_PROPERTIES.has(propName)) {
    return null;
  }

  const caller = propAccess.getExpression();
  if (!isDocumentTarget(caller)) {
    return null;
  }

  return {
    line: propAccess.getStartLineNumber(),
    message: `Accessing 'document.${propName}' without VisibilityStateEntry; use performance.getEntriesByType('visibility-state') to reliably detect initial background state.`,
  };
}

/**
 * Checks for `'visibilityState' in document`, `'hidden' in document`, or vendor equivalents.
 */
function matchVisibilityInExpression(binaryExpr: BinaryExpression): AnalyzerMatch | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.InKeyword) {
    return null;
  }

  const left = unwrapExpression(binaryExpr.getLeft());
  if (!Node.isStringLiteral(left) && !Node.isNoSubstitutionTemplateLiteral(left)) {
    return null;
  }

  const propName = left.getLiteralText();
  if (!VISIBILITY_PROPERTIES.has(propName)) {
    return null;
  }

  const right = binaryExpr.getRight();
  if (!isDocumentTarget(right)) {
    return null;
  }

  return {
    line: binaryExpr.getStartLineNumber(),
    message: `Checking '${propName}' in document without VisibilityStateEntry; use performance.getEntriesByType('visibility-state') to reliably detect initial background state.`,
  };
}

/**
 * Checks for addEventListener('visibilitychange', ...) or vendor equivalents.
 */
function matchVisibilityEventListener(callExpr: CallExpression): AnalyzerMatch | null {
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
  if (!VISIBILITY_EVENTS.has(eventName)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Listening to '${eventName}' without VisibilityStateEntry; use performance.getEntriesByType('visibility-state') to reliably detect initial background state.`,
  };
}

export const detectInitialVisibilityStateMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'visibilityState',
    'hidden',
    'webkitHidden',
    'mozHidden',
    'msHidden',
    'webkitVisibilityState',
    'visibilitychange',
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const fullText = sourceFile.getFullText();

    // If file references modern VisibilityStateEntry or performance.getEntriesByType('visibility-state'), drop it
    if (
      fullText.includes('VisibilityStateEntry') ||
      fullText.includes('visibility-state')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    for (const propAccess of propAccesses) {
      const match = matchVisibilityPropertyAccess(propAccess);
      if (match) {
        matches.push(match);
      }
    }

    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const binExpr of binaryExpressions) {
      const match = matchVisibilityInExpression(binExpr);
      if (match) {
        matches.push(match);
      }
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchVisibilityEventListener(callExpr);
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
    'Flag checking document.visibilityState, document.hidden, or visibilitychange event listeners without VisibilityStateEntry (performance.getEntriesByType("visibility-state")) to reliably detect if a page was initially backgrounded.',
  matcher: detectInitialVisibilityStateMatcher,
  phase2Rubric: {
    keepWhen: [
      'Using document.visibilityState, document.hidden, or visibilitychange event listeners to inspect initial page visibility or background tab state without querying the Performance Timeline (performance.getEntriesByType("visibility-state") or VisibilityStateEntry).',
      'Legacy vendor-prefixed Page Visibility properties (document.webkitHidden, mozHidden, msHidden) or events (webkitvisibilitychange) used to detect visibility changes.',
    ],
    dropWhen: [
      'Code already querying the modern Performance Timeline via performance.getEntriesByType("visibility-state") or checking "VisibilityStateEntry" in window.',
      'Custom non-DOM objects with visibilityState or hidden properties unrelated to the document Page Visibility API.',
      'Synthetic visibilitychange event dispatching or mock test helpers for visibility testing.',
    ],
  },
};

export const detectInitialVisibilityStateRules: readonly AnalyzerRule[] = [
  detectInitialVisibilityStateRule,
];
