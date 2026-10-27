import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type PropertyAccessExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH = 'b881da0b6ea2';

const VENDOR_VISIBILITY_PROPERTIES = new Set([
  'webkitHidden',
  'mozHidden',
  'msHidden',
  'webkitVisibilityState',
  'mozVisibilityState',
  'msVisibilityState',
]);

const VENDOR_VISIBILITY_EVENTS = [
  'webkitvisibilitychange',
  'mozvisibilitychange',
  'msvisibilitychange',
] as const;

const STANDARD_FALLBACK_GUARD_TOKENS = [
  'visibilityState',
  'hidden',
  'VisibilityStateEntry',
] as const;

const EXPLICIT_INITIAL_VISIBILITY_VAR_REGEX =
  /initial(?:ly)?(?:Visibility(?:State)?|Hidden|Background(?:ed)?)|wasHiddenAtLoad|hiddenAtLoad|backgroundLoad|startedHidden|firstHiddenTime|timeBackgrounded/i;

const AMBIGUOUS_WAS_HIDDEN_VAR_REGEX = /^wasHidden$/i;

const TELEMETRY_CONTEXT_REGEX =
  /\b(?:performance\.now|PerformanceObserver|timeStamp|sendBeacon|sendMetric|metric|analytics|telemetry|report|fcp|lcp|cls|inp|ttfb|firstHiddenTime|timeBackgrounded)\b/i;

const STANDARD_VISIBILITY_PROPERTIES = new Set(['visibilityState', 'hidden']);

function isDocumentTarget(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  const text = unwrapped.getText();
  return (
    text === 'document' ||
    text === 'window.document' ||
    text === 'globalThis.document' ||
    text === 'self.document' ||
    text === 'this.document' ||
    text === 'doc' ||
    text === 'd'
  );
}

function expressionAccessesDocumentVisibility(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (
    Node.isObjectLiteralExpression(unwrapped) ||
    Node.isArrayLiteralExpression(unwrapped) ||
    Node.isArrowFunction(unwrapped) ||
    Node.isFunctionExpression(unwrapped)
  ) {
    return false;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    if (
      STANDARD_VISIBILITY_PROPERTIES.has(unwrapped.getName()) &&
      isDocumentTarget(unwrapped.getExpression())
    ) {
      return true;
    }
  }

  if (
    Node.isBinaryExpression(unwrapped) ||
    Node.isConditionalExpression(unwrapped) ||
    Node.isPrefixUnaryExpression(unwrapped)
  ) {
    const descendants = unwrapped.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression,
    );
    for (const desc of descendants) {
      if (
        STANDARD_VISIBILITY_PROPERTIES.has(desc.getName()) &&
        isDocumentTarget(desc.getExpression())
      ) {
        return true;
      }
    }
  }

  return false;
}

function hasVisibilityChangeListener(sourceFile: SourceFile): boolean {
  const fullText = sourceFile.getFullText();
  if (!fullText.toLowerCase().includes('visibilitychange')) {
    return false;
  }

  const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of callExprs) {
    const expr = unwrapExpression(call.getExpression());
    if (!Node.isPropertyAccessExpression(expr)) {
      continue;
    }
    const methodName = expr.getName();
    if (
      methodName !== 'addEventListener' &&
      methodName !== 'on' &&
      methodName !== 'addListener' &&
      methodName !== 'bind'
    ) {
      continue;
    }
    const firstArg = call.getArguments()[0];
    if (!firstArg) {
      continue;
    }
    const unwrappedArg = unwrapExpression(firstArg);
    if (
      (Node.isStringLiteral(unwrappedArg) ||
        Node.isNoSubstitutionTemplateLiteral(unwrappedArg)) &&
      unwrappedArg.getLiteralText().toLowerCase().includes('visibilitychange')
    ) {
      return true;
    }
  }

  const propAccesses = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
  return propAccesses.some((prop) => prop.getName().toLowerCase() === 'onvisibilitychange');
}

function isVendorFallbackBehindStandard(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, STANDARD_FALLBACK_GUARD_TOKENS)) {
    return true;
  }

  // Also check if an enclosing binary expression or statement on the same line already accesses standard document.hidden or document.visibilityState
  let current: Node | undefined = node.getParent();
  while (current && !Node.isStatement(current) && !Node.isSourceFile(current)) {
    if (Node.isBinaryExpression(current) || Node.isConditionalExpression(current)) {
      if (expressionAccessesDocumentVisibility(current)) {
        return true;
      }
    }
    current = current.getParent();
  }

  return false;
}

function matchVendorPropertyAccess(
  propAccess: PropertyAccessExpression,
): AnalyzerMatch | null {
  const propName = propAccess.getName();
  if (!VENDOR_VISIBILITY_PROPERTIES.has(propName)) {
    return null;
  }
  if (!isDocumentTarget(propAccess.getExpression())) {
    return null;
  }
  if (isVendorFallbackBehindStandard(propAccess)) {
    return null;
  }

  return {
    line: propAccess.getStartLineNumber(),
    message: `Accessing deprecated vendor-prefixed 'document.${propName}'; use standard Page Visibility API and performance.getEntriesByType('visibility-state') to reliably detect initial background state.`,
  };
}

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
  if (!isDocumentTarget(binaryExpr.getRight())) {
    return null;
  }
  if (isVendorFallbackBehindStandard(binaryExpr)) {
    return null;
  }

  return {
    line: binaryExpr.getStartLineNumber(),
    message: `Checking deprecated vendor-prefixed '${propName}' in document; use standard Page Visibility API and performance.getEntriesByType('visibility-state') to reliably detect initial background state.`,
  };
}

function matchVendorVisibilityListener(callExpr: CallExpression): AnalyzerMatch | null {
  const listener = matchEventListenerCall(callExpr, VENDOR_VISIBILITY_EVENTS);
  if (!listener) {
    return null;
  }
  if (isVendorFallbackBehindStandard(callExpr)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message: `Listening to deprecated vendor-prefixed '${listener.eventName}' event; use standard 'visibilitychange' and performance.getEntriesByType('visibility-state') to reliably detect initial background state.`,
  };
}

function isInsideEventListenerCallback(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isArrowFunction(current) || Node.isFunctionExpression(current)) {
      const parent = current.getParent();
      if (parent && Node.isCallExpression(parent)) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function isReassignedToLiveStateInListener(
  sourceFile: SourceFile,
  varName: string,
): boolean {
  for (const binExpr of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (binExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
      continue;
    }
    if (!isInsideEventListenerCallback(binExpr)) {
      continue;
    }
    const left = binExpr.getLeft();
    const targetName = Node.isIdentifier(left)
      ? left.getText()
      : Node.isPropertyAccessExpression(left)
        ? left.getName()
        : null;
    if (targetName !== varName) {
      continue;
    }
    const right = unwrapExpression(binExpr.getRight());
    if (
      right.getKind() === SyntaxKind.TrueKeyword ||
      expressionAccessesDocumentVisibility(right)
    ) {
      return true;
    }
  }
  return false;
}

function matchesInitialVisibilityVariableName(
  name: string,
  sourceFile: SourceFile,
  hasTelemetryContext: boolean,
): boolean {
  if (EXPLICIT_INITIAL_VISIBILITY_VAR_REGEX.test(name)) {
    return !isReassignedToLiveStateInListener(sourceFile, name);
  }
  if (AMBIGUOUS_WAS_HIDDEN_VAR_REGEX.test(name)) {
    return (
      hasTelemetryContext && !isReassignedToLiveStateInListener(sourceFile, name)
    );
  }
  return false;
}

function collectInitialVisibilityVarMatches(sourceFile: SourceFile): AnalyzerMatch[] {
  const matches: AnalyzerMatch[] = [];
  const hasTelemetryContext = TELEMETRY_CONTEXT_REGEX.test(sourceFile.getFullText());

  for (const varDecl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (isInsideEventListenerCallback(varDecl)) {
      continue;
    }
    const name = varDecl.getName();
    const init = varDecl.getInitializer();
    if (
      init &&
      matchesInitialVisibilityVariableName(name, sourceFile, hasTelemetryContext) &&
      expressionAccessesDocumentVisibility(init)
    ) {
      matches.push({
        line: varDecl.getStartLineNumber(),
        message: `Assigning initial document visibility state to '${name}' alongside a 'visibilitychange' listener; use VisibilityStateEntry via performance.getEntriesByType('visibility-state') to reliably detect if the page was loaded in the background.`,
      });
    }
  }

  for (const binExpr of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (binExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
      continue;
    }
    if (isInsideEventListenerCallback(binExpr)) {
      continue;
    }
    const left = binExpr.getLeft();
    const targetName = Node.isIdentifier(left)
      ? left.getText()
      : Node.isPropertyAccessExpression(left)
        ? left.getName()
        : null;
    if (
      targetName &&
      matchesInitialVisibilityVariableName(targetName, sourceFile, hasTelemetryContext) &&
      expressionAccessesDocumentVisibility(binExpr.getRight())
    ) {
      matches.push({
        line: binExpr.getStartLineNumber(),
        message: `Assigning initial document visibility state to '${targetName}' alongside a 'visibilitychange' listener; use VisibilityStateEntry via performance.getEntriesByType('visibility-state') to reliably detect if the page was loaded in the background.`,
      });
    }
  }

  for (const propAssign of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    if (isInsideEventListenerCallback(propAssign)) {
      continue;
    }
    const name = propAssign.getName();
    const init = propAssign.getInitializer();
    if (
      init &&
      matchesInitialVisibilityVariableName(name, sourceFile, hasTelemetryContext) &&
      expressionAccessesDocumentVisibility(init)
    ) {
      matches.push({
        line: propAssign.getStartLineNumber(),
        message: `Assigning initial document visibility state to '${name}' alongside a 'visibilitychange' listener; use VisibilityStateEntry via performance.getEntriesByType('visibility-state') to reliably detect if the page was loaded in the background.`,
      });
    }
  }

  for (const propDecl of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyDeclaration)) {
    const name = propDecl.getName();
    const init = propDecl.getInitializer();
    if (
      init &&
      matchesInitialVisibilityVariableName(name, sourceFile, hasTelemetryContext) &&
      expressionAccessesDocumentVisibility(init)
    ) {
      matches.push({
        line: propDecl.getStartLineNumber(),
        message: `Assigning initial document visibility state to '${name}' alongside a 'visibilitychange' listener; use VisibilityStateEntry via performance.getEntriesByType('visibility-state') to reliably detect if the page was loaded in the background.`,
      });
    }
  }

  return matches;
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
    'visibilitychange',
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const fullText = sourceFile.getFullText();

    if (
      fullText.includes('VisibilityStateEntry') ||
      fullText.includes('visibility-state')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    for (const propAccess of sourceFile.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression,
    )) {
      const match = matchVendorPropertyAccess(propAccess);
      if (match) {
        matches.push(match);
      }
    }

    for (const binExpr of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      const match = matchVendorInExpression(binExpr);
      if (match) {
        matches.push(match);
      }
    }

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const match = matchVendorVisibilityListener(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    if (hasVisibilityChangeListener(sourceFile)) {
      matches.push(...collectInitialVisibilityVarMatches(sourceFile));
    }

    return matches;
  },
};

export const detectInitialVisibilityStateRule: AnalyzerRule = {
  id: 'detect-initial-visibility-state',
  guideId: 'detect-initial-visibility-state',
  guideHash: DETECT_INITIAL_VISIBILITY_STATE_GUIDE_HASH,
  summary:
    'Flag vendor-prefixed Page Visibility API usage or capturing initial background state via document.visibilityState/hidden variables alongside visibilitychange listeners without VisibilityStateEntry.',
  matcher: detectInitialVisibilityStateMatcher,
  verifierRubric: {
    keepWhen: [
      'Legacy vendor-prefixed Page Visibility properties (document.webkitHidden, document.mozHidden, document.msHidden, document.webkitVisibilityState) or events (webkitvisibilitychange, mozvisibilitychange, msvisibilitychange) used without an unprefixed standard Page Visibility primary check.',
      'Assigning document.visibilityState or document.hidden to an initial/load-time variable (e.g. wasHidden, initialVisibility, hiddenAtLoad) combined with a visibilitychange event listener to detect initial background tab state.',
    ],
    dropWhen: [
      'Vendor-prefixed Page Visibility properties are used strictly as a fallback behind standard unprefixed document.visibilityState or document.hidden (e.g. "hidden" in document or document.visibilityState ?? document.webkitVisibilityState).',
      'Ordinary runtime visibilitychange listeners that pause/resume media, mute audio, or stop animations based on current document.hidden without attempting to detect initial load-time background state.',
      'Code already querying the modern Performance Timeline via performance.getEntriesByType("visibility-state") or checking "VisibilityStateEntry" in window.',
    ],
  },
};

export default [
  detectInitialVisibilityStateRule,
] satisfies readonly AnalyzerRule[];
