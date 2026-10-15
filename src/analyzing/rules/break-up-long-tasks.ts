import { Node, SyntaxKind, type CallExpression, type NewExpression, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const BREAK_UP_LONG_TASKS_GUIDE_HASH = '18330b20e496';

const SCHEDULER_YIELD_GUARD_TOKENS = ['scheduler', 'yield'] as const;

const CHUNK_OR_LOOP_FN_REGEX =
  /(chunk|batch|process|step|tick|yield|loop|runNext|schedule|work)/i;

/**
 * Checks whether delay in setTimeout(fn, delay) is 0 or omitted.
 * Returns true if delay argument is missing, numeric 0, or literal '0'.
 */
function isZeroOrOmittedDelay(args: readonly Node[]): boolean {
  if (args.length <= 1) {
    return true;
  }
  const delayArg = unwrapExpression(args[1]);
  if (Node.isNumericLiteral(delayArg)) {
    return delayArg.getLiteralValue() === 0;
  }
  const delayText = delayArg.getText().trim();
  return delayText === '0' || delayText === '0x0';
}

/**
 * Checks whether a new Promise(...) wraps setTimeout(resolve, 0) or setImmediate(resolve)
 * as an explicit main-thread yielding mechanism.
 */
function matchPromiseYield(newExpr: NewExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(newExpr.getExpression());
  const exprText = expr.getText();
  if (exprText !== 'Promise' && exprText !== 'window.Promise' && exprText !== 'globalThis.Promise') {
    return null;
  }

  const args = newExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  const executor = unwrapExpression(args[0]);
  if (!Node.isArrowFunction(executor) && !Node.isFunctionExpression(executor)) {
    return null;
  }

  if (isProtectedByFeatureGuard(newExpr, SCHEDULER_YIELD_GUARD_TOKENS)) {
    return null;
  }

  const calls = executor.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    // Skip if call is inside a nested Promise constructor
    let parent: Node | undefined = call.getParent();
    let isNestedPromise = false;
    while (parent && parent !== executor) {
      if (Node.isNewExpression(parent)) {
        const callee = unwrapExpression(parent.getExpression()).getText();
        if (callee.includes('Promise')) {
          isNestedPromise = true;
          break;
        }
      }
      parent = parent.getParent();
    }
    if (isNestedPromise) {
      continue;
    }

    const callCallee = unwrapExpression(call.getExpression());
    const calleeName = Node.isIdentifier(callCallee)
      ? callCallee.getText()
      : Node.isPropertyAccessExpression(callCallee)
        ? callCallee.getName()
        : '';

    if (calleeName === 'setTimeout') {
      const callArgs = call.getArguments();
      if (isZeroOrOmittedDelay(callArgs)) {
        return {
          line: newExpr.getStartLineNumber(),
          message:
            'Explicit main-thread yielding via new Promise(resolve => setTimeout(resolve, 0)) used instead of await scheduler.yield()',
        };
      }
    } else if (calleeName === 'setImmediate') {
      return {
        line: newExpr.getStartLineNumber(),
        message:
          'Explicit main-thread yielding via new Promise(resolve => setImmediate(resolve)) used instead of await scheduler.yield()',
      };
    }
  }

  return null;
}

/**
 * Checks whether an AST node is contained within a loop or chunk-processing function.
 */
function isInsideLoopOrChunkProcessor(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (
      Node.isForStatement(current) ||
      Node.isForOfStatement(current) ||
      Node.isForInStatement(current) ||
      Node.isWhileStatement(current) ||
      Node.isDoStatement(current)
    ) {
      return true;
    }

    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      const fnName =
        Node.isFunctionDeclaration(current) || Node.isMethodDeclaration(current)
          ? current.getName() ?? ''
          : '';
      if (CHUNK_OR_LOOP_FN_REGEX.test(fnName)) {
        return true;
      }
      // Check if function contains loops
      const hasLoop =
        current.getDescendantsOfKind(SyntaxKind.ForStatement).length > 0 ||
        current.getDescendantsOfKind(SyntaxKind.WhileStatement).length > 0 ||
        current.getDescendantsOfKind(SyntaxKind.ForOfStatement).length > 0;
      if (hasLoop) {
        return true;
      }
    }

    current = current.getParent();
  }
  return false;
}

/**
 * Checks whether a setImmediate call is used as a task-yielding workaround.
 */
function matchSetImmediateYield(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  const calleeName = Node.isIdentifier(expr)
    ? expr.getText()
    : Node.isPropertyAccessExpression(expr)
      ? expr.getName()
      : '';

  if (calleeName !== 'setImmediate') {
    return null;
  }

  if (isProtectedByFeatureGuard(callExpr, SCHEDULER_YIELD_GUARD_TOKENS)) {
    return null;
  }

  if (isInsideLoopOrChunkProcessor(callExpr)) {
    return {
      line: callExpr.getStartLineNumber(),
      message:
        'Legacy setImmediate() task-yielding workaround inside loop or chunk processor used instead of await scheduler.yield()',
    };
  }

  return null;
}

/**
 * Checks whether MessageChannel is instantiated as a task-yielding workaround.
 */
function matchMessageChannelYield(newExpr: NewExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(newExpr.getExpression());
  const exprText = expr.getText();
  if (
    exprText !== 'MessageChannel' &&
    exprText !== 'window.MessageChannel' &&
    exprText !== 'globalThis.MessageChannel'
  ) {
    return null;
  }

  if (isProtectedByFeatureGuard(newExpr, SCHEDULER_YIELD_GUARD_TOKENS)) {
    return null;
  }

  // Check if enclosing scope or loop uses postMessage to yield tasks
  if (isInsideLoopOrChunkProcessor(newExpr)) {
    return {
      line: newExpr.getStartLineNumber(),
      message:
        'MessageChannel zero-delay task-yielding workaround used instead of await scheduler.yield()',
    };
  }

  // Also check if the enclosing function or statements setup channel port yielding
  let scope: Node | undefined = newExpr.getParent();
  while (scope && !Node.isFunctionDeclaration(scope) && !Node.isSourceFile(scope)) {
    scope = scope.getParent();
  }

  if (scope) {
    const scopeText = scope.getText();
    if (
      scopeText.includes('.port1.onmessage') &&
      scopeText.includes('.port2.postMessage')
    ) {
      return {
        line: newExpr.getStartLineNumber(),
        message:
          'MessageChannel zero-delay task-yielding workaround used instead of await scheduler.yield()',
      };
    }
  }

  return null;
}

export const breakUpLongTasksMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['Promise', 'setTimeout', 'setImmediate', 'MessageChannel'],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    const newExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression);
    for (const newExpr of newExpressions) {
      const promiseMatch = matchPromiseYield(newExpr);
      if (promiseMatch) {
        matches.push(promiseMatch);
        continue;
      }

      const channelMatch = matchMessageChannelYield(newExpr);
      if (channelMatch) {
        matches.push(channelMatch);
      }
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      // Don't double flag setImmediate if already flagged via new Promise
      let parent: Node | undefined = callExpr.getParent();
      let inNewPromise = false;
      while (parent) {
        if (Node.isNewExpression(parent)) {
          const calleeText = unwrapExpression(parent.getExpression()).getText();
          if (calleeText.includes('Promise')) {
            inNewPromise = true;
            break;
          }
        }
        parent = parent.getParent();
      }
      if (inNewPromise) {
        continue;
      }

      const immMatch = matchSetImmediateYield(callExpr);
      if (immMatch) {
        matches.push(immMatch);
      }
    }

    return matches;
  },
};

export const breakUpLongTasksRule: AnalyzerRule = {
  id: 'break-up-long-tasks',
  guideId: 'break-up-long-tasks',
  guideHash: BREAK_UP_LONG_TASKS_GUIDE_HASH,
  summary:
    'Flag explicit main-thread yielding workarounds (such as new Promise(resolve => setTimeout(resolve, 0)), setImmediate, or MessageChannel) used to break up heavy computational tasks or long loops instead of await scheduler.yield().',
  matcher: breakUpLongTasksMatcher,
  phase2Rubric: {
    keepWhen: [
      'Explicit main-thread yielding using new Promise(resolve => setTimeout(resolve, 0)) or setImmediate(resolve) during batch processing, loops, or long computational tasks instead of scheduler.yield().',
      'Task yielding helpers (e.g. yieldToMain, nextTask, sleep(0)) returning a Promise resolved via zero-delay setTimeout or setImmediate.',
      'MessageChannel or setImmediate task scheduling workarounds used to break up execution blocks without blocking the UI.',
    ],
    dropWhen: [
      'Generic setTimeout calls with non-zero delays (e.g. timers, animations, debounces, throttles).',
      'DOM layout flush hacks or one-off deferred callbacks (e.g. setTimeout(() => input.focus(), 0)).',
      'Code already protected by feature detection for scheduler.yield (e.g. if ("scheduler" in window && "yield" in window.scheduler)).',
      'Node.js-specific server-side batching scripts where scheduler is not available or polyfilled.',
    ],
  },
};
