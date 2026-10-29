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

const SCROLL_METHOD_NAMES = new Set(['scrollIntoView', 'scrollTo', 'scrollBy', 'scroll']);
const POST_SCROLL_EFFECT_METHODS = new Set([
  'focus',
  'add',
  'remove',
  'toggle',
  'animate',
  'highlight',
]);

function isProgrammaticScrollCall(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  return Node.isPropertyAccessExpression(expr) && SCROLL_METHOD_NAMES.has(expr.getName());
}

function hasSmoothScrollOption(call: CallExpression): boolean {
  for (const arg of call.getArguments()) {
    const unwrappedArg = unwrapExpression(arg);
    if (Node.isObjectLiteralExpression(unwrappedArg)) {
      const prop = unwrappedArg.getProperty('behavior');
      if (prop && Node.isPropertyAssignment(prop)) {
        const val = unwrapExpression(prop.getInitializer() ?? prop);
        if (Node.isStringLiteral(val) && val.getLiteralText() === 'smooth') return true;
      }
    }
  }
  return false;
}

function isScrollCallAwaited(call: CallExpression): boolean {
  const parent = call.getParent();
  if (parent && Node.isAwaitExpression(parent)) return true;
  if (parent && Node.isPropertyAccessExpression(parent)) {
    const name = parent.getName();
    return name === 'then' || name === 'catch' || name === 'finally';
  }
  return false;
}

function areInMutuallyExclusiveBranches(a: Node, b: Node): boolean {
  let curr: Node | undefined = a.getParent();
  while (curr) {
    if (Node.isConditionalExpression(curr)) {
      const whenTrue = curr.getWhenTrue();
      const whenFalse = curr.getWhenFalse();
      if (
        a.getStart() >= whenTrue.getStart() &&
        a.getEnd() <= whenTrue.getEnd() &&
        b.getStart() >= whenFalse.getStart() &&
        b.getEnd() <= whenFalse.getEnd()
      ) {
        return true;
      }
    } else if (Node.isIfStatement(curr)) {
      const thenStmt = curr.getThenStatement();
      const elseStmt = curr.getElseStatement();
      if (
        elseStmt &&
        a.getStart() >= thenStmt.getStart() &&
        a.getEnd() <= thenStmt.getEnd() &&
        b.getStart() >= elseStmt.getStart() &&
        b.getEnd() <= elseStmt.getEnd()
      ) {
        return true;
      }
    }
    curr = curr.getParent();
  }
  return false;
}

function findPostScrollSetTimeout(scope: Node, scrollCall: CallExpression): CallExpression | null {
  const minStartPos = scrollCall.getEnd();
  for (const call of scope.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getStart() <= minStartPos || areInMutuallyExclusiveBranches(scrollCall, call)) {
      continue;
    }

    const expr = unwrapExpression(call.getExpression());
    let fnName = '';
    if (Node.isIdentifier(expr)) {
      fnName = expr.getText();
    } else if (Node.isPropertyAccessExpression(expr)) {
      const receiverText = unwrapExpression(expr.getExpression()).getText();
      if (receiverText === 'window' || receiverText === 'globalThis' || receiverText === 'self') {
        fnName = expr.getName();
      }
    }

    if (fnName === 'setTimeout' && call.getArguments().length > 0) {
      const callbackArg = resolveCallableNode(call.getArguments()[0]);
      let triggersEffect = false;
      callbackArg.forEachDescendant((child) => {
        if (triggersEffect || !Node.isCallExpression(child)) return;
        const childExpr = unwrapExpression(child.getExpression());
        if (
          Node.isIdentifier(childExpr) ||
          (Node.isPropertyAccessExpression(childExpr) &&
            POST_SCROLL_EFFECT_METHODS.has(childExpr.getName()))
        ) {
          triggersEffect = true;
        }
      });
      if (triggersEffect) return call;
    }
  }
  return null;
}

export const scrollCompletionEffectsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['scrollIntoView', 'scrollTo', 'scrollBy', '.scroll('],
    ['behavior'],
    ['smooth'],
    ['setTimeout'],
  ] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (
      ctx.filePath.includes('.test.') ||
      ctx.filePath.includes('.spec.') ||
      ctx.filePath.includes('/test/') ||
      ctx.filePath.includes('/tests/')
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (
        !isProgrammaticScrollCall(call) ||
        isScrollCallAwaited(call) ||
        !hasSmoothScrollOption(call) ||
        isProtectedByFeatureGuard(call, SCROLL_PROMISE_FEATURE_TOKENS)
      ) {
        continue;
      }

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
      if (!currentScope) continue;

      const scopeText = currentScope.getText();
      if (scopeText.includes('instanceof Promise') || scopeText.includes('scrollend')) {
        continue;
      }

      const timeoutCall = findPostScrollSetTimeout(currentScope, call);
      if (timeoutCall && !isProtectedByFeatureGuard(timeoutCall, SCROLL_PROMISE_FEATURE_TOKENS)) {
        matches.push({
          line: call.getStartLineNumber(),
          column: call.getStartLinePos(),
          message:
            'Programmatic smooth scroll uses setTimeout to guess animation completion; await the scroll-completion Promise returned by scroll methods (e.g. await element.scrollIntoView({ behavior: "smooth" })) with a scrollend fallback where needed.',
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
    'Await the scroll-completion Promise returned by programmatic scroll methods (scrollIntoView, scrollTo, scrollBy)—with a scrollend fallback where needed—instead of guessing completion durations with setTimeout.',
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
