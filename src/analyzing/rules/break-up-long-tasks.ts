import { Node, SyntaxKind, type CallExpression, type NewExpression, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';

export const BREAK_UP_LONG_TASKS_GUIDE_HASH = '18330b20e496';

const SCHEDULER_YIELD_GUARD_TOKENS = ['scheduler', 'yield'] as const;

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
 * Checks whether a node is in a file with test or Node/Electron specific markers.
 */
function isTestOrNodeFile(sourceFile: SourceFile, ctx?: JsMatcherContext): boolean {
  if (ctx?.filePath) {
    const filePath = ctx.filePath.toLowerCase();
    if (
      filePath.includes('.test.') ||
      filePath.includes('.spec.') ||
      filePath.includes('__tests__') ||
      filePath.startsWith('test/') ||
      filePath.startsWith('tests/') ||
      filePath.includes('/test/') ||
      filePath.includes('/tests/')
    ) {
      return true;
    }
  }

  const text = ctx?.fileContent ?? sourceFile.getFullText();
  if (
    text.startsWith('#!') ||
    /from\s+['"]node:|require\(['"](?:node:|fs|electron|child_process)['"]\)/.test(text) ||
    text.includes('process.argv')
  ) {
    return true;
  }

  return false;
}

function isPolyfillSchedulerScope(text: string): boolean {
  return (
    text.includes('MutationObserver') ||
    text.includes('process.nextTick') ||
    text.includes('importScripts') ||
    text.includes('onreadystatechange')
  );
}

/**
 * Checks whether node is guarded by scheduler.yield feature detection or fallback (?? or ||).
 */
function isSchedulerYieldGuarded(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, SCHEDULER_YIELD_GUARD_TOKENS)) {
    return true;
  }

  let curr: Node | undefined = node;
  while (curr && !Node.isSourceFile(curr)) {
    const parent = curr.getParent();
    if (parent && Node.isBinaryExpression(parent)) {
      const op = parent.getOperatorToken().getKind();
      if (op === SyntaxKind.QuestionQuestionToken || op === SyntaxKind.BarBarToken) {
        if (parent.getRight() === curr) {
          const leftText = parent.getLeft().getText();
          if (leftText.includes('scheduler') && leftText.includes('yield')) {
            return true;
          }
        }
      }
    }
    curr = parent;
  }

  return false;
}

const DOM_DEFERRED_METHODS = new Set([
  'focus',
  'select',
  'blur',
  'scrollIntoView',
]);

function isDomDeferredMethodCall(callNode: Node): boolean {
  if (Node.isCallExpression(callNode)) {
    const callee = unwrapExpression(callNode.getExpression());
    if (Node.isPropertyAccessExpression(callee)) {
      return DOM_DEFERRED_METHODS.has(callee.getName());
    }
  }
  return false;
}

function isDomDeferredOnlyExecutor(executorNode: Node, resolveParamName: string): boolean {
  const calls = executorNode.getDescendantsOfKind(SyntaxKind.CallExpression);
  let hasDomDeferredCall = false;

  for (const call of calls) {
    const callee = unwrapExpression(call.getExpression());
    const calleeName = Node.isIdentifier(callee)
      ? callee.getText()
      : Node.isPropertyAccessExpression(callee)
        ? callee.getName()
        : '';

    if (calleeName === 'setTimeout' || calleeName === 'setImmediate') {
      continue;
    }
    if (resolveParamName && calleeName === resolveParamName) {
      continue;
    }
    if (isDomDeferredMethodCall(call)) {
      hasDomDeferredCall = true;
      continue;
    }
    return false;
  }

  return hasDomDeferredCall;
}

/**
 * Checks whether an argument to setTimeout is the executor's resolve function.
 */
function isResolveCallback(arg: Node, resolveName: string): boolean {
  const unwrapped = unwrapExpression(arg);
  if (Node.isIdentifier(unwrapped) && unwrapped.getText() === resolveName) {
    return true;
  }
  if (Node.isArrowFunction(unwrapped) || Node.isFunctionExpression(unwrapped)) {
    const body = unwrapped.getBody();
    if (Node.isCallExpression(body)) {
      const callee = unwrapExpression(body.getExpression());
      if (Node.isIdentifier(callee) && callee.getText() === resolveName) {
        return true;
      }
    }
  }
  return false;
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

  if (isSchedulerYieldGuarded(newExpr)) {
    return null;
  }

  const executorParams = executor.getParameters();
  const resolveParamName = executorParams.length > 0 ? executorParams[0].getName() : '';

  if (isDomDeferredOnlyExecutor(executor, resolveParamName)) {
    return null;
  }

  const parentNode = newExpr.getParent();
  if (parentNode && Node.isPropertyAccessExpression(parentNode) && parentNode.getName() === 'then') {
    const grandParent = parentNode.getParent();
    if (grandParent && Node.isCallExpression(grandParent)) {
      const thenArgs = grandParent.getArguments();
      if (thenArgs.length > 0) {
        const thenCallback = unwrapExpression(thenArgs[0]);
        if (isDomDeferredOnlyExecutor(thenCallback, '')) {
          return null;
        }
      }
    }
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
      if (callArgs.length > 0) {
        const firstArg = unwrapExpression(callArgs[0]);
        if (isDomDeferredOnlyExecutor(firstArg, resolveParamName)) {
          return null;
        }
        if (resolveParamName && !isResolveCallback(firstArg, resolveParamName)) {
          continue;
        }
      }
      if (isZeroOrOmittedDelay(callArgs) && isInsideLoopOrChunkProcessor(newExpr)) {
        return {
          line: newExpr.getStartLineNumber(),
          message:
            'Explicit main-thread yielding via new Promise(resolve => setTimeout(resolve, 0)) used instead of await scheduler.yield()',
        };
      }
    } else if (calleeName === 'setImmediate') {
      const callArgs = call.getArguments();
      if (
        callArgs.length === 1 &&
        (!resolveParamName || isResolveCallback(callArgs[0], resolveParamName)) &&
        isInsideLoopOrChunkProcessor(newExpr)
      ) {
        return {
          line: newExpr.getStartLineNumber(),
          message:
            'Explicit main-thread yielding via new Promise(resolve => setImmediate(resolve)) used instead of await scheduler.yield()',
        };
      }
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
      const stmt = current.getStatement();
      const stmts = Node.isBlock(stmt) ? stmt.getStatements() : [stmt];
      if (
        (stmts.length <= 1 && Node.isWhileStatement(current)) ||
        node.getFirstAncestor(
          (a) => Node.isNewExpression(a) && a.getExpression().getText().includes('ResizeObserver'),
        )
      ) {
        return false;
      }
      return true;
    }

    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      const parent = node.getParent();
      if (parent === current) {
        return true;
      }
      const body = current.getBody();
      if (parent && Node.isReturnStatement(parent) && body && Node.isBlock(body)) {
        return body.getStatements().length === 1;
      }
      if (Node.isCallExpression(node) && Node.isFunctionDeclaration(current)) {
        const arg0 = node.getArguments()[0];
        return (
          current.getParameters().length === 0 &&
          current.getDescendantsOfKind(SyntaxKind.IfStatement).length > 0 &&
          current.getDescendantsOfKind(SyntaxKind.TrueKeyword).length > 0 &&
          !!arg0 &&
          Node.isIdentifier(arg0) &&
          arg0.getText() !== (current.getName() ?? '')
        );
      }
      if (Node.isNewExpression(node)) {
        return current
          .getDescendantsOfKind(SyntaxKind.ReturnStatement)
          .some((ret) => {
            const expr = ret.getExpression();
            return !!expr && (Node.isArrowFunction(expr) || Node.isFunctionExpression(expr));
          });
      }
      return false;
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
  if (Node.isPropertyAccessExpression(expr)) {
    const recv = unwrapExpression(expr.getExpression()).getText();
    if (recv !== 'window' && recv !== 'self' && recv !== 'global' && recv !== 'globalThis') {
      return null;
    }
  }
  const calleeName = Node.isIdentifier(expr)
    ? expr.getText()
    : Node.isPropertyAccessExpression(expr)
      ? expr.getName()
      : '';

  if (calleeName !== 'setImmediate' || isSchedulerYieldGuarded(callExpr)) {
    return null;
  }

  if (
    isInsideLoopOrChunkProcessor(callExpr) &&
    !isPolyfillSchedulerScope(callExpr.getSourceFile().getFullText())
  ) {
    return {
      line: callExpr.getStartLineNumber(),
      message:
        'Legacy setImmediate() task-yielding workaround inside loop or chunk processor used instead of await scheduler.yield()',
    };
  }

  return null;
}

/**
 * Checks whether MessageChannel ports are transferred via postMessage
 * or if port2.postMessage is never invoked within the local scope (RPC / IPC pattern).
 */
function isMessageChannelTransferredOrRpc(newExpr: NewExpression, scopeNode: Node): boolean {
  const scopeText = scopeNode.getText();

  if (
    /\[\s*(?:\w+\.)?port[12]\s*\]/.test(scopeText) ||
    /postMessage\s*\([^,]+,[^,]*\[\s*(?:\w+\.)?port[12]/.test(scopeText) ||
    /worker\s*\.\s*postMessage/i.test(scopeText) ||
    /serviceWorker/i.test(scopeText) ||
    /contentWindow\s*\.\s*postMessage/i.test(scopeText)
  ) {
    return true;
  }

  if (!/(?:\.port2|\.port1)\s*\.\s*postMessage\s*\(/.test(scopeText)) {
    return true;
  }

  return false;
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

  if (isSchedulerYieldGuarded(newExpr)) {
    return null;
  }

  let scopeNode: Node | undefined = newExpr.getParent();
  while (
    scopeNode &&
    !Node.isFunctionDeclaration(scopeNode) &&
    !Node.isMethodDeclaration(scopeNode) &&
    !Node.isClassDeclaration(scopeNode) &&
    !Node.isSourceFile(scopeNode)
  ) {
    scopeNode = scopeNode.getParent();
  }

  const enclosingScope = scopeNode ?? newExpr.getSourceFile();
  if (
    isMessageChannelTransferredOrRpc(newExpr, enclosingScope) ||
    isPolyfillSchedulerScope(enclosingScope.getText())
  ) {
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

  return null;
}

export const breakUpLongTasksMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['setImmediate', 'MessageChannel', 'Promise'],
    ['setTimeout', 'setImmediate', 'MessageChannel'],
  ],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (isTestOrNodeFile(sourceFile, ctx)) {
      return [];
    }

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
  verifierRubric: {
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
      'Unit test files, fixtures, or server-side CLI scripts.',
    ],
  },
};

/**
 * Opt-in only until re-measured: retired from default production scan.
 */
export default [
  breakUpLongTasksRule,
] satisfies readonly AnalyzerRule[];
