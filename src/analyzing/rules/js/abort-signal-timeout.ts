import { Node, SyntaxKind, VariableDeclarationKind } from 'ts-morph';
import {
  getAssignment,
  getMemberAccess,
  getSemanticParent,
  getStaticNumber,
  getStaticString,
  isGlobalReference,
  resolvesToBinding,
  unwrapExpression,
  unwrapMethodCall,
} from '../../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export { JS_GUIDE_HASH };

function isDeclarationScope(node: Node, isVar: boolean): boolean {
  if (Node.isFunctionLikeDeclaration(node) || Node.isSourceFile(node)) return true;
  if (isVar) return false;
  return (
    Node.isBlock(node) ||
    Node.isCaseClause(node) ||
    Node.isDefaultClause(node) ||
    Node.isCatchClause(node) ||
    Node.isIterationStatement(node)
  );
}

function hasDescendantMatching(
  root: Node,
  predicate: (node: Node) => boolean,
  stopAtNestedFunction = true,
): boolean {
  const isBoundary = (node: Node): boolean =>
    stopAtNestedFunction && (Node.isFunctionLikeDeclaration(node) || Node.isClassDeclaration(node));
  if (isBoundary(root)) return false;
  if (predicate(root)) return true;
  let found = false;
  root.forEachDescendant((node, traversal) => {
    if (isBoundary(node)) {
      traversal.skip();
      return;
    }
    if (predicate(node)) {
      found = true;
      traversal.stop();
    }
  });
  return found;
}

function statementAlwaysExits(stmt: Node | undefined): boolean {
  if (!stmt) return false;
  if (Node.isReturnStatement(stmt) || Node.isThrowStatement(stmt)) return true;
  if (Node.isBlock(stmt)) {
    return statementAlwaysExits(stmt.getStatements().at(-1));
  }
  return false;
}

function isAbortTimeoutGuardNode(
  node: Node,
  options: { checkAbortController: boolean; checkOptionalTimeout: boolean },
): boolean {
  const assignedLeft = getAssignment(node)?.left;
  const assignedMember = getMemberAccess(assignedLeft);
  if (assignedMember?.name === 'timeout' && isGlobalReference(assignedMember.expression, 'AbortSignal')) {
    return true;
  }

  if (options.checkAbortController && isGlobalReference(node, 'AbortController')) {
    return true;
  }

  if (options.checkOptionalTimeout) {
    const member = getMemberAccess(node);
    if (member?.name === 'timeout' && isGlobalReference(member.expression, 'AbortSignal')) {
      const parent = node.getParent();
      if (member.optional || Node.isTypeOfExpression(parent)) return true;
    }
    if (Node.isBinaryExpression(node) && node.getOperatorToken().getKind() === SyntaxKind.InKeyword) {
      if (getStaticString(node.getLeft()) === 'timeout' && isGlobalReference(node.getRight(), 'AbortSignal')) {
        return true;
      }
    }
  }

  if (!Node.isCallExpression(node)) return false;
  const callee = getMemberAccess(node.getExpression());
  const args = node.getArguments();
  if (!callee || args.length < 2) return false;
  if (getStaticString(args[1]) !== 'timeout' || !isGlobalReference(args[0], 'AbortSignal')) {
    return false;
  }
  if (callee.name === 'defineProperty' && isGlobalReference(callee.expression, 'Object')) {
    return true;
  }
  if (!options.checkAbortController) return false;
  if (callee.name === 'has' && isGlobalReference(callee.expression, 'Reflect')) {
    return true;
  }
  return callee.name === 'call' && getMemberAccess(callee.expression)?.name === 'hasOwnProperty';
}

function isFeatureGuarded(node: Node): boolean {
  const hasGuard = (root: Node, checkAbortController: boolean, checkOptionalTimeout: boolean) =>
    hasDescendantMatching(root, (desc) =>
      isAbortTimeoutGuardNode(desc, { checkAbortController, checkOptionalTimeout }),
    );

  for (let cur: Node = node, parent = cur.getParent(); parent; cur = parent, parent = cur.getParent()) {
    const condition = Node.isIfStatement(parent)
      ? parent.getExpression()
      : Node.isConditionalExpression(parent)
        ? parent.getCondition()
        : undefined;
    if (condition && hasGuard(condition, true, true)) return true;

    if (Node.isBlock(parent)) {
      const curStart = cur.getStart();
      for (const stmt of parent.getStatements()) {
        if (stmt.getStart() >= curStart) continue;
        if (hasGuard(stmt, false, Node.isVariableStatement(stmt))) return true;
        if (
          Node.isIfStatement(stmt) &&
          statementAlwaysExits(stmt.getThenStatement()) &&
          hasGuard(stmt.getExpression(), true, true)
        ) {
          return true;
        }
      }
    }

    if (Node.isSourceFile(parent)) {
      if (parent.getStatements().some((stmt) => hasGuard(stmt, false, false))) {
        return true;
      }
    }
  }
  return false;
}

function isAbortOnlyErrorHandler(handler: Node | undefined): boolean {
  if (!handler) return false;
  let sawAbortError = false;
  let sawTimeoutError = false;

  hasDescendantMatching(
    handler,
    (node) => {
      const member = getMemberAccess(node);
      const nameStr =
        getStaticString(node) ??
        (member && isGlobalReference(member.expression, 'DOMException') ? member.name : null);
      if (nameStr === 'AbortError' || nameStr === 'ABORT_ERR') sawAbortError = true;
      if (nameStr === 'TimeoutError' || nameStr === 'TIMEOUT_ERR') sawTimeoutError = true;

      if (Node.isBinaryExpression(node)) {
        const left = unwrapExpression(node.getLeft());
        const right = unwrapExpression(node.getRight());
        const leftNum = getStaticNumber(left);
        const rightNum = getStaticNumber(right);
        const comparedNode = leftNum !== null ? right : rightNum !== null ? left : undefined;
        const numericCode = leftNum ?? rightNum;
        if (comparedNode && getMemberAccess(comparedNode)?.name === 'code') {
          if (numericCode === 20) sawAbortError = true;
          if (numericCode === 23) sawTimeoutError = true;
        }
      }
      return false;
    },
    false,
  );

  return sawAbortError && !sawTimeoutError;
}

function hasAbortHandler(scope: Node): boolean {
  return hasDescendantMatching(
    scope,
    (node) => {
      if (Node.isCatchClause(node)) {
        return isAbortOnlyErrorHandler(node);
      }
      const methodCall = unwrapMethodCall(node);
      if (!methodCall) return false;
      const argIndex = methodCall.methodName === 'catch' ? 0 : methodCall.methodName === 'then' ? 1 : -1;
      return argIndex >= 0 && isAbortOnlyErrorHandler(methodCall.args[argIndex]);
    },
    Node.isSourceFile(scope),
  );
}

function getTimeoutCallback(abortAccess: Node, bindCalls: readonly Node[]): Node | null {
  const { outer: abortOuter, parent: afterAbort } = getSemanticParent(abortAccess);
  const bindAccess = getMemberAccess(afterAbort);

  if (bindAccess?.name === 'bind' && !bindAccess.optional && afterAbort) {
    const { outer: bindCallee, parent: bindCall } = getSemanticParent(afterAbort);
    if (
      Node.isCallExpression(bindCall) &&
      !bindCall.hasQuestionDotToken() &&
      bindCall.getExpression() === bindCallee &&
      bindCalls.length === 1 &&
      bindCalls[0] === bindCall
    ) {
      return bindCall;
    }
    return null;
  }

  if (
    bindCalls.length > 0 ||
    !Node.isCallExpression(afterAbort) ||
    afterAbort.hasQuestionDotToken() ||
    afterAbort.getExpression() !== abortOuter ||
    afterAbort.getArguments().length > 0
  ) {
    return null;
  }

  const { outer: callOuter, parent: callParent } = getSemanticParent(afterAbort);
  let callbackFn: Node | undefined;
  if (Node.isArrowFunction(callParent) && callParent.getBody() === callOuter) {
    callbackFn = callParent;
  } else if (Node.isExpressionStatement(callParent) || Node.isReturnStatement(callParent)) {
    const block = callParent.getParent();
    if (Node.isBlock(block) && block.getStatements().length === 1) {
      callbackFn = block.getParent();
    }
  }

  if (
    !callbackFn ||
    (!Node.isArrowFunction(callbackFn) && !Node.isFunctionExpression(callbackFn)) ||
    callbackFn.isAsync() ||
    (Node.isFunctionExpression(callbackFn) && callbackFn.isGenerator()) ||
    callbackFn.getParameters().length > 0
  ) {
    return null;
  }
  return callbackFn;
}

function getTimeoutCall(abortAccess: Node, bindCalls: readonly Node[]): Node | null {
  const callbackNode = getTimeoutCallback(abortAccess, bindCalls);
  if (!callbackNode) return null;

  const { outer: cbOuter, parent: setTimeoutCall } = getSemanticParent(callbackNode);
  if (
    !Node.isCallExpression(setTimeoutCall) ||
    setTimeoutCall.hasQuestionDotToken() ||
    !isGlobalReference(setTimeoutCall.getExpression(), 'setTimeout')
  ) {
    return null;
  }
  const args = setTimeoutCall.getArguments();
  if (args.length !== 2 || args[0] !== cbOuter || Node.isSpreadElement(args[1])) {
    return null;
  }
  return setTimeoutCall;
}

function isInsideInnerLoopOrFunction(node: Node, scope: Node): boolean {
  let crossedBoundary = false;
  for (let cur = node.getParent(); cur && cur !== scope; cur = cur.getParent()) {
    if (Node.isIterationStatement(cur) || Node.isFunctionLikeDeclaration(cur)) {
      crossedBoundary = true;
    }
    if (cur === node.getSourceFile()) {
      return false;
    }
  }
  return crossedBoundary;
}

export const abortSignalTimeoutMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [['AbortController'], ['setTimeout'], ['.abort']],
  featureGuardTokens: ['AbortSignal.timeout', 'timeout'],
  dedupeLines: true,
  isGuarded: isFeatureGuarded,
  matchNew(node, sf) {
    const { outer: newExpr, parent: decl } = getSemanticParent(node);
    if (
      node.getArguments().length > 0 ||
      !Node.isVariableDeclaration(decl) ||
      decl.getInitializer() !== newExpr ||
      !isGlobalReference(node.getExpression(), 'AbortController')
    ) {
      return null;
    }

    const declList = decl.getParent();
    const nameNode = decl.getNameNode();
    const stmt = declList.getParent();
    if (
      !Node.isIdentifier(nameNode) ||
      !Node.isVariableDeclarationList(declList) ||
      Node.isForStatement(stmt) ||
      (Node.isVariableStatement(stmt) && stmt.isExported()) ||
      decl.getFirstAncestor(Node.isModuleDeclaration)
    ) {
      return null;
    }

    const isVarDecl = declList.getDeclarationKind() === VariableDeclarationKind.Var;
    const scope = decl.getFirstAncestor((ancestor) => isDeclarationScope(ancestor, isVarDecl)) ?? sf;
    const controllerName = decl.getName();
    const abortAccesses: Node[] = [];
    const singleArgCalls: Node[] = [];

    for (const id of scope.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (id === nameNode || id.getText() !== controllerName || !resolvesToBinding(id, decl)) {
        continue;
      }
      const { outer: idOuter, parent } = getSemanticParent(id);
      const member = getMemberAccess(parent);
      if (parent && member?.expression === idOuter) {
        const { outer: memberOuter, parent: memberParent } = getSemanticParent(parent);
        if (Node.isDeleteExpression(memberParent) || getAssignment(memberParent)?.left === memberOuter) {
          return null;
        }
        if (member.name === 'signal') continue;
        if (!member.optional && member.name === 'abort') {
          abortAccesses.push(parent);
          continue;
        }
      }

      if (Node.isCallExpression(parent)) {
        const callArgs = parent.getArguments();
        if (callArgs.length === 1 && callArgs[0] === idOuter) {
          singleArgCalls.push(parent);
          continue;
        }
      }

      if (Node.isVariableDeclaration(parent) && parent.getInitializer() === idOuter) {
        const pat = parent.getNameNode();
        if (Node.isObjectBindingPattern(pat) && pat.getElements().length === 1) {
          const [element] = pat.getElements();
          const propName = element.getPropertyNameNode()?.getText() ?? element.getName();
          if (!element.getDotDotDotToken() && propName === 'signal') {
            continue;
          }
        }
      }
      return null;
    }

    if (abortAccesses.length !== 1) return null;
    const setTimeoutCall = getTimeoutCall(abortAccesses[0], singleArgCalls);
    if (!setTimeoutCall || isInsideInnerLoopOrFunction(setTimeoutCall, scope)) {
      return null;
    }

    const enclosingFunction = decl.getFirstAncestor(Node.isFunctionLikeDeclaration) ?? sf;
    return hasAbortHandler(enclosingFunction)
      ? null
      : 'Manual AbortController + setTimeout timeout scaffolding can be replaced with AbortSignal.timeout(ms).';
  },
});

export const abortSignalTimeoutRule: AnalyzerRule = {
  id: 'js/abort-signal-timeout',
  guideId: 'js',
  guideHash: JS_GUIDE_HASH,
  summary: 'Replace manual AbortController + setTimeout timeout scaffolding with AbortSignal.timeout(ms).',
  matcher: abortSignalTimeoutMatcher,
  verifierRubric: {
    keepWhen: ['An AbortController is created solely with a single zero-argument callback setTimeout(() => controller.abort(), ms) timer (without custom abort reasons, callback side effects, external .abort() calls, AbortSignal.timeout feature guards, or AbortError-only catch handlers) and can be replaced directly with AbortSignal.timeout(ms).'],
    dropWhen: [
      'The AbortController is also aborted manually or externally (e.g. a cancel button, cleanup hook, event listener, or second controller.abort() call), or combined with another AbortSignal where AbortSignal.any() would be needed.',
      'The setTimeout callback performs additional work besides controller.abort() (such as updating timeout state, logging, rejecting a custom promise, or invoking a callback) or passes a custom abort reason to controller.abort(reason).',
      'Local or caller error handling checks err.name === "AbortError" (or DOMException.ABORT_ERR) without also handling "TimeoutError", since AbortSignal.timeout(ms) rejects with a TimeoutError DOMException instead of AbortError.',
      'Project configuration or environment targets runtimes or toolchains lacking AbortSignal.timeout() (e.g. Node < 17.3 / < 18, Chrome < 103, Firefox < 100, Safari < 16, or TypeScript < 4.7 DOM/node lib defs), or the code sits inside a feature guard or polyfill.',
    ],
  },
};

export default [abortSignalTimeoutRule] satisfies readonly AnalyzerRule[];
