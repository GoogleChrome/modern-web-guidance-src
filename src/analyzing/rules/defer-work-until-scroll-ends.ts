import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type FunctionExpression,
  type ArrowFunction,
  type MethodDeclaration,
  type SourceFile,
} from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import {
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';

export const DEFER_WORK_UNTIL_SCROLL_ENDS_GUIDE_HASH = 'ee7104add98e';

const SCROLLEND_GUARD_TOKENS = ['onscrollend', 'scrollend'] as const;

const DEBOUNCE_FN_REGEX = /(^|\.)debounce$/i;

/**
 * Checks whether a node or its enclosing block contains a check for 'onscrollend' in window / document.
 */
function isGuardedByScrollendFeatureCheck(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, SCROLLEND_GUARD_TOKENS)) {
    return true;
  }

  // Check enclosing function or if-statement text for 'onscrollend' or 'scrollend'
  let current: Node | undefined = node;
  while (current && !Node.isSourceFile(current)) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (condText.includes('onscrollend') || condText.includes('scrollend')) {
        return true;
      }
    }
    current = current.getParent();
  }

  return false;
}

/**
 * Checks whether a node is a call to a debounce helper:
 * debounce(...), _.debounce(...), $.debounce(...), throttleDebounce.debounce(...)
 */
function isDebounceCall(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  const resolved = resolveLocalExpression(unwrapped);
  if (!Node.isCallExpression(resolved)) {
    return false;
  }

  const callee = unwrapExpression(resolved.getExpression());
  const calleeText = callee.getText();
  return DEBOUNCE_FN_REGEX.test(calleeText);
}

/**
 * Checks whether the enclosing class, function, or source file contains any clearTimeout call.
 */
function enclosingScopeHasClearTimeout(node: Node): boolean {
  let scope: Node | undefined = node.getParent();
  while (scope) {
    if (
      Node.isClassDeclaration(scope) ||
      Node.isFunctionDeclaration(scope) ||
      Node.isSourceFile(scope)
    ) {
      const calls = scope.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of calls) {
        const callee = unwrapExpression(call.getExpression());
        const name = Node.isIdentifier(callee)
          ? callee.getText()
          : Node.isPropertyAccessExpression(callee)
            ? callee.getName()
            : '';
        if (name === 'clearTimeout') {
          return true;
        }
      }
      if (Node.isClassDeclaration(scope)) {
        break;
      }
    }
    scope = scope.getParent();
  }
  return false;
}

/**
 * Determines whether a function body sets a setTimeout timer or performs a clearTimeout + setTimeout debounce.
 */
function hasScrollEndDebouncePattern(
  fn: FunctionExpression | ArrowFunction | MethodDeclaration,
): boolean {
  const calls = fn.getDescendantsOfKind(SyntaxKind.CallExpression);
  let hasClearTimeout = false;
  let hasSetTimeout = false;

  for (const call of calls) {
    const expr = unwrapExpression(call.getExpression());
    let callName = '';

    if (Node.isIdentifier(expr)) {
      callName = expr.getText();
    } else if (Node.isPropertyAccessExpression(expr)) {
      const callerText = unwrapExpression(expr.getExpression()).getText();
      if (
        callerText === 'window' ||
        callerText === 'globalThis' ||
        callerText === 'self' ||
        callerText === 'this'
      ) {
        callName = expr.getName();
      }
    }

    if (callName === 'clearTimeout') {
      hasClearTimeout = true;
    } else if (callName === 'setTimeout') {
      hasSetTimeout = true;
    }
  }

  if (hasClearTimeout && hasSetTimeout) {
    return true;
  }

  // If handler sets a setTimeout and clearTimeout exists in the enclosing scope
  if (hasSetTimeout && enclosingScopeHasClearTimeout(fn)) {
    return true;
  }

  return false;
}

/**
 * Resolves a handler node to an ArrowFunction, FunctionExpression, or MethodDeclaration.
 */
function resolveHandlerFunction(
  node: Node,
): FunctionExpression | ArrowFunction | MethodDeclaration | null {
  let unwrapped = unwrapExpression(node);

  // If node is fn.bind(...)
  if (Node.isCallExpression(unwrapped)) {
    const callee = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'bind') {
      unwrapped = unwrapExpression(callee.getExpression());
    }
  }

  if (Node.isArrowFunction(unwrapped) || Node.isFunctionExpression(unwrapped)) {
    return unwrapped;
  }

  // If node is this.methodName, find methodName on enclosing class
  if (Node.isPropertyAccessExpression(unwrapped) && unwrapped.getExpression().getText() === 'this') {
    const methodName = unwrapped.getName();
    let parent = unwrapped.getParent();
    while (parent && !Node.isClassDeclaration(parent)) {
      parent = parent.getParent();
    }
    if (parent && Node.isClassDeclaration(parent)) {
      const method = parent.getMethod(methodName);
      if (method) {
        return method;
      }
    }
  }

  const resolved = resolveLocalExpression(unwrapped, 2);
  if (Node.isArrowFunction(resolved) || Node.isFunctionExpression(resolved)) {
    return resolved;
  }

  return null;
}

/**
 * Checks whether a call expression is a scroll event listener with a debounce handler.
 */
function matchScrollEventListenerCall(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  const args = callExpr.getArguments();

  let handlerNode: Node | null = null;

  if (methodName === 'addEventListener') {
    if (args.length < 2) {
      return null;
    }
    const eventNameArg = unwrapExpression(args[0]);
    if (!Node.isStringLiteral(eventNameArg) && !Node.isNoSubstitutionTemplateLiteral(eventNameArg)) {
      return null;
    }
    if (eventNameArg.getLiteralText() !== 'scroll') {
      return null;
    }
    handlerNode = args[1];
  } else if (methodName === 'on') {
    // jQuery: $(...).on('scroll', handler) or $(...).on('scroll', selector, handler)
    if (args.length < 2) {
      return null;
    }
    const eventNameArg = unwrapExpression(args[0]);
    if (!Node.isStringLiteral(eventNameArg) && !Node.isNoSubstitutionTemplateLiteral(eventNameArg)) {
      return null;
    }
    if (eventNameArg.getLiteralText() !== 'scroll') {
      return null;
    }
    handlerNode = args.length >= 3 ? args[2] : args[1];
  } else if (methodName === 'scroll') {
    // jQuery: $(...).scroll(handler)
    if (args.length < 1) {
      return null;
    }
    handlerNode = args[0];
  }

  if (!handlerNode) {
    return null;
  }

  if (isGuardedByScrollendFeatureCheck(callExpr)) {
    return null;
  }

  // 1. Check if handler argument is a call to debounce(...)
  if (isDebounceCall(handlerNode)) {
    return {
      line: callExpr.getStartLineNumber(),
      message:
        "Debounced scroll event listener using debounce helper used to detect scroll end instead of native 'scrollend' event.",
    };
  }

  // 2. Check function body debounce pattern
  const fn = resolveHandlerFunction(handlerNode);
  if (!fn) {
    return null;
  }

  if (!hasScrollEndDebouncePattern(fn)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      "Debounced scroll event listener using clearTimeout/setTimeout used to detect scroll end instead of native 'scrollend' event.",
  };
}

/**
 * Checks whether a binary assignment is an onscroll property assignment with debounce handler.
 */
function matchOnscrollAssignment(binaryExpr: BinaryExpression): AnalyzerMatch | null {
  if (binaryExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return null;
  }

  const left = unwrapExpression(binaryExpr.getLeft());
  let isOnscroll = false;

  if (Node.isPropertyAccessExpression(left)) {
    if (left.getName() === 'onscroll') {
      isOnscroll = true;
    }
  } else if (Node.isIdentifier(left) && left.getText() === 'onscroll') {
    isOnscroll = true;
  }

  if (!isOnscroll) {
    return null;
  }

  if (isGuardedByScrollendFeatureCheck(binaryExpr)) {
    return null;
  }

  const right = binaryExpr.getRight();

  // Check if assigned a debounce call
  if (isDebounceCall(right)) {
    return {
      line: binaryExpr.getStartLineNumber(),
      message:
        "Debounced scroll property assignment (onscroll = debounce(...)) used to detect scroll end instead of native 'scrollend' event.",
    };
  }

  const fn = resolveHandlerFunction(right);
  if (!fn) {
    return null;
  }

  if (!hasScrollEndDebouncePattern(fn)) {
    return null;
  }

  return {
    line: binaryExpr.getStartLineNumber(),
    message:
      "Debounced scroll property assignment (onscroll = ...) used to detect scroll end instead of native 'scrollend' event.",
  };
}

export const deferWorkUntilScrollEndsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['scroll', 'onscroll'],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchScrollEventListenerCall(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const binaryExpr of binaryExpressions) {
      const match = matchOnscrollAssignment(binaryExpr);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const deferWorkUntilScrollEndsRule: AnalyzerRule = {
  id: 'defer-work-until-scroll-ends',
  guideId: 'defer-work-until-scroll-ends',
  guideHash: DEFER_WORK_UNTIL_SCROLL_ENDS_GUIDE_HASH,
  summary:
    'Flag debounced scroll event listeners using clearTimeout and setTimeout or debounce() helpers to detect when scrolling stops instead of listening for the native scrollend event.',
  matcher: deferWorkUntilScrollEndsMatcher,
  phase2Rubric: {
    keepWhen: [
      'Scroll event listener (addEventListener("scroll", ...), $(...).on("scroll", ...), or onscroll) using clearTimeout followed by setTimeout or a debounce helper to detect when scrolling ends instead of native scrollend event.',
      'Custom scroll-end timer tracking where setTimeout dispatches a synthetic scrollend event or runs deferred work after scroll stops.',
    ],
    dropWhen: [
      'Continuous scroll throttling using requestAnimationFrame or leading-edge execution that runs work while the user is actively scrolling.',
      'Scroll listeners already guarded by feature detection for "onscrollend" in window or "scrollend" event support.',
      'Non-scroll event debouncers (e.g. input, keyup, resize, mousemove, or search queries).',
    ],
  },
};
