import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLL_COMPLETION_EFFECTS_GUIDE_HASH = 'e96e2a69561f';

const SCROLL_PROMISE_FEATURE_TOKENS = [
  'scrollend',
  'onscrollend',
  'scrollIntoView',
  'instanceof Promise',
] as const;

const SCROLL_METHOD_NAMES = new Set([
  'scrollIntoView',
  'scrollTo',
  'scrollBy',
  'scroll',
]);

const POST_SCROLL_EFFECT_METHODS = new Set([
  'focus',
  'add',
  'remove',
  'toggle',
  'animate',
  'highlight',
]);

/**
 * Checks whether a call expression is a programmatic scroll method.
 */
function isProgrammaticScrollCall(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  const methodName = expr.getName();
  return SCROLL_METHOD_NAMES.has(methodName);
}

/**
 * Checks whether options passed to a scroll call specify behavior: 'smooth'.
 */
function hasSmoothScrollOption(call: CallExpression): boolean {
  const args = call.getArguments();
  if (args.length === 0) {
    return false;
  }

  for (const arg of args) {
    const unwrappedArg = unwrapExpression(arg);
    if (Node.isObjectLiteralExpression(unwrappedArg)) {
      const prop = unwrappedArg.getProperty('behavior');
      if (prop && Node.isPropertyAssignment(prop)) {
        const val = unwrapExpression(prop.getInitializer() ?? prop);
        if (Node.isStringLiteral(val) && val.getLiteralText() === 'smooth') {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Checks whether a scroll call is already awaited (await element.scrollIntoView(...) or .then(...)).
 */
function isScrollCallAwaited(call: CallExpression): boolean {
  const parent = call.getParent();
  if (parent && Node.isAwaitExpression(parent)) {
    return true;
  }

  // Check element.scrollIntoView().then(...)
  if (parent && Node.isPropertyAccessExpression(parent)) {
    if (parent.getName() === 'then' || parent.getName() === 'catch' || parent.getName() === 'finally') {
      return true;
    }
  }

  return false;
}

function areInMutuallyExclusiveBranches(a: Node, b: Node): boolean {
  let curr: Node | undefined = a.getParent();
  while (curr) {
    if (Node.isConditionalExpression(curr)) {
      const whenTrue = curr.getWhenTrue();
      const whenFalse = curr.getWhenFalse();
      const aInTrue =
        a.getStart() >= whenTrue.getStart() && a.getEnd() <= whenTrue.getEnd();
      const bInFalse =
        b.getStart() >= whenFalse.getStart() && b.getEnd() <= whenFalse.getEnd();
      if (aInTrue && bInFalse) {
        return true;
      }
    } else if (Node.isIfStatement(curr)) {
      const thenStmt = curr.getThenStatement();
      const elseStmt = curr.getElseStatement();
      if (elseStmt) {
        const aInThen =
          a.getStart() >= thenStmt.getStart() && a.getEnd() <= thenStmt.getEnd();
        const bInElse =
          b.getStart() >= elseStmt.getStart() && b.getEnd() <= elseStmt.getEnd();
        if (aInThen && bInElse) {
          return true;
        }
      }
    }
    curr = curr.getParent();
  }
  return false;
}

/**
 * Checks whether a function or block contains a setTimeout intended to fire after scrolling completes.
 */
function findPostScrollSetTimeout(
  scope: Node,
  scrollCall: CallExpression,
): CallExpression | null {
  const minStartPos = scrollCall.getEnd();
  const callExpressions = scope.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExpressions) {
    if (call.getStart() <= minStartPos) {
      continue;
    }

    if (areInMutuallyExclusiveBranches(scrollCall, call)) {
      continue;
    }

    const expr = unwrapExpression(call.getExpression());
    let fnName = '';

    if (Node.isIdentifier(expr)) {
      fnName = expr.getText();
    } else if (Node.isPropertyAccessExpression(expr)) {
      const receiverText = unwrapExpression(expr.getExpression()).getText();
      if (
        receiverText === 'window' ||
        receiverText === 'globalThis' ||
        receiverText === 'self'
      ) {
        fnName = expr.getName();
      }
    }

    if (fnName === 'setTimeout') {
      const args = call.getArguments();
      if (args.length > 0) {
        const callbackArg = resolveCallableNode(args[0]);

        const priorInsertedIdentifiers = new Set<string>();
        for (const betweenCall of callExpressions) {
          if (
            betweenCall.getStart() > minStartPos &&
            betweenCall.getEnd() < call.getStart()
          ) {
            const betweenExpr = unwrapExpression(betweenCall.getExpression());
            if (Node.isIdentifier(betweenExpr)) {
              priorInsertedIdentifiers.add(betweenExpr.getText());
            }
          }
        }

        // Check if callback triggers focus, class change, highlight, or custom action
        let triggersEffect = false;
        callbackArg.forEachDescendant((child) => {
          if (triggersEffect) return;
          if (Node.isCallExpression(child)) {
            const childExpr = unwrapExpression(child.getExpression());
            if (Node.isPropertyAccessExpression(childExpr)) {
              if (POST_SCROLL_EFFECT_METHODS.has(childExpr.getName())) {
                triggersEffect = true;
              }
            } else if (Node.isIdentifier(childExpr)) {
              const idName = childExpr.getText();
              if (!priorInsertedIdentifiers.has(idName)) {
                triggersEffect = true;
              }
            }
          }
        });

        if (triggersEffect) {
          return call;
        }
      }
    }
  }

  return null;
}

export const scrollCompletionEffectsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['scrollIntoView', 'scrollTo', 'scrollBy', 'scroll'] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    // Skip test files
    if (
      ctx.filePath.includes('.test.') ||
      ctx.filePath.includes('.spec.') ||
      ctx.filePath.includes('/test/') ||
      ctx.filePath.includes('/tests/')
    ) {
      return matches;
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      if (!isProgrammaticScrollCall(call)) {
        continue;
      }

      if (isScrollCallAwaited(call)) {
        continue;
      }

      if (!hasSmoothScrollOption(call)) {
        continue;
      }

      if (isProtectedByFeatureGuard(call, SCROLL_PROMISE_FEATURE_TOKENS)) {
        continue;
      }

      // Find enclosing function or block
      let currentScope: Node | undefined = call.getParent();
      while (currentScope && !Node.isSourceFile(currentScope)) {
        if (
          Node.isFunctionDeclaration(currentScope) ||
          Node.isFunctionExpression(currentScope) ||
          Node.isArrowFunction(currentScope) ||
          Node.isMethodDeclaration(currentScope)
        ) {
          break;
        }
        currentScope = currentScope.getParent();
      }

      if (!currentScope) {
        continue;
      }

      // Check if current scope guards with Promise check or feature token
      const scopeText = currentScope.getText();
      if (scopeText.includes('instanceof Promise') || scopeText.includes('scrollend')) {
        continue;
      }

      const timeoutCall = findPostScrollSetTimeout(currentScope, call);
      if (timeoutCall) {
        if (isProtectedByFeatureGuard(timeoutCall, SCROLL_PROMISE_FEATURE_TOKENS)) {
          continue;
        }

        matches.push({
          line: call.getStartLineNumber(),
          column: call.getStartLinePos(),
          message:
            'Programmatic smooth scroll uses setTimeout to guess animation completion; scroll methods return a Promise that resolves when scrolling settles (e.g. await element.scrollIntoView({ behavior: "smooth" })).',
        });
      }
    }

    return matches;
  },
};

export const scrollCompletionEffectsRule: AnalyzerRule = {
  id: 'scroll-completion-effects',
  guideId: 'scroll-completion-effects',
  guideHash: SCROLL_COMPLETION_EFFECTS_GUIDE_HASH,
  summary:
    'Await the Promise returned by programmatic scroll methods (scrollIntoView, scrollTo, scrollBy) instead of guessing completion durations with setTimeout.',
  matcher: scrollCompletionEffectsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'Programmatic smooth scroll (scrollTo, scrollIntoView, scrollBy) sequenced with setTimeout guessing scroll completion duration',
      'One-off scrollend or scroll debounce listener registered specifically to execute post-scroll effects after programmatic smooth scrolling',
    ],
    dropWhen: [
      'Code already awaits scrollIntoView or scrollTo returned Promise',
      'Instant or non-smooth scroll operations (behavior: "auto" or omitted default instant scroll)',
      'setTimeout is in a mutually exclusive branch (e.g. ternary else) or delays initiating a scroll rather than waiting for a smooth scroll to finish',
      'setTimeout only resets an independent animation/state setter that was just invoked synchronously prior to the timer',
      'General scroll event debounce tracking user touch/wheel scrolling without programmatic scroll initiation',
      'Guarded by scroll method promise feature detection',
    ],
  },
};

export default [
  scrollCompletionEffectsRule,
] satisfies readonly AnalyzerRule[];
