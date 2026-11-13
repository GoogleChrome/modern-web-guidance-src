import { Node, SyntaxKind, type Statement } from 'ts-morph';
import {
  areNodesEqual,
  getAssignment,
  getMemberAccess,
  getSingleArgument,
  isGlobalReference,
  isIdentifierReference,
  resolvesToBinding,
  unwrapExpression,
  unwrapMethodCall,
  type UnwrappedMethodCall,
} from '../../scanners/ast-helpers.ts';
import { createJsAstMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export { JS_GUIDE_HASH };

const MESSAGE = 'Manual grouping into an object can be replaced with Object.groupBy().';

function getDeclaredIdentifierName(node: Node | undefined): string | null {
  return node && Node.isIdentifier(node) ? node.getText() : null;
}

function getIdentifierName(node: Node | undefined): string | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  return Node.isIdentifier(unwrapped) && isIdentifierReference(unwrapped)
    ? unwrapped.getText()
    : null;
}

function getArrayElements(node: Node | undefined): Node[] | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  return Node.isArrayLiteralExpression(unwrapped) ? unwrapped.getElements() : null;
}

function unwrapSingleExpression(node: Node | undefined): Node | undefined {
  if (!node) return undefined;
  const unwrapped = unwrapExpression(node);
  if (Node.isExpressionStatement(unwrapped)) {
    return unwrapExpression(unwrapped.getExpression());
  }
  if (Node.isBlock(unwrapped)) {
    const stmts = unwrapped.getStatements();
    return stmts.length === 1 ? unwrapSingleExpression(stmts[0]) : undefined;
  }
  return unwrapped;
}

function flattenCommaExprs(node: Node | undefined): Node[] {
  if (!node) return [];
  const unwrapped = unwrapExpression(node);
  if (
    Node.isBinaryExpression(unwrapped) &&
    unwrapped.getOperatorToken().getKind() === SyntaxKind.CommaToken
  ) {
    return [...flattenCommaExprs(unwrapped.getLeft()), ...flattenCommaExprs(unwrapped.getRight())];
  }
  return [unwrapped];
}

function unwrapStrictMethodCall(node: Node | undefined): UnwrappedMethodCall | null {
  const method = unwrapMethodCall(node);
  if (
    !method ||
    !Node.isPropertyAccessExpression(method.callee) ||
    method.callee.hasQuestionDotToken() ||
    method.call.hasQuestionDotToken()
  ) {
    return null;
  }
  return method;
}

function getPushReceiver(node: Node | undefined, itemName: string): Node | undefined {
  const method = unwrapStrictMethodCall(node);
  if (!method || method.methodName !== 'push') return undefined;
  const arg = getSingleArgument(method.call);
  return arg && getIdentifierName(arg) === itemName ? method.receiver : undefined;
}

function getObjKeyAccess(node: Node | undefined, objName: string): Node | undefined {
  if (!node) return undefined;
  const unwrapped = unwrapExpression(node);
  if (
    Node.isElementAccessExpression(unwrapped) &&
    !unwrapped.hasQuestionDotToken() &&
    getIdentifierName(unwrapped.getExpression()) === objName
  ) {
    const arg = unwrapped.getArgumentExpression();
    return arg ? unwrapExpression(arg) : undefined;
  }
  return undefined;
}

function getObjKeyEquals(
  node: Node | undefined,
  objName: string,
): { readonly key: Node; readonly rhs: Node } | null {
  const assignment = getAssignment(node);
  if (!assignment || assignment.operator !== SyntaxKind.EqualsToken) return null;
  const key = getObjKeyAccess(assignment.left, objName);
  return key ? { key, rhs: assignment.right } : null;
}

function isEmptyObjectLiteralOrCreate(node: Node | undefined): boolean {
  if (!node) return false;
  const unwrapped = unwrapExpression(node);
  if (Node.isObjectLiteralExpression(unwrapped)) {
    return unwrapped.getProperties().length === 0;
  }
  const method = unwrapStrictMethodCall(unwrapped);
  if (!method || method.methodName !== 'create') return false;
  const arg = getSingleArgument(method.call);
  return Boolean(
    arg &&
      arg.getKind() === SyntaxKind.NullKeyword &&
      isGlobalReference(method.receiver, 'Object'),
  );
}

function extractInitKey(node: Node | undefined, objName: string, allowBare = false): Node | undefined {
  if (!node) return undefined;
  const unwrapped = unwrapExpression(node);
  if (!Node.isBinaryExpression(unwrapped)) {
    return allowBare ? getObjKeyAccess(unwrapped, objName) : undefined;
  }
  const op = unwrapped.getOperatorToken().getKind();
  const isAssign =
    op === SyntaxKind.EqualsToken ||
    op === SyntaxKind.QuestionQuestionEqualsToken ||
    op === SyntaxKind.BarBarEqualsToken;
  const isFallback = op === SyntaxKind.BarBarToken || op === SyntaxKind.QuestionQuestionToken;
  if (!isAssign && !isFallback) {
    return allowBare ? getObjKeyAccess(unwrapped, objName) : undefined;
  }

  const key = getObjKeyAccess(unwrapped.getLeft(), objName);
  if (!key) return undefined;
  const rhs = unwrapped.getRight();
  const rhsElements = getArrayElements(rhs);
  if (rhsElements?.length === 0) {
    return isAssign || allowBare ? key : undefined;
  }
  const rhsKey = extractInitKey(rhs, objName, allowBare || op === SyntaxKind.EqualsToken);
  return rhsKey && areNodesEqual(key, rhsKey) ? key : undefined;
}

function isNullishNode(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  return (
    unwrapped.getKind() === SyntaxKind.NullKeyword ||
    (Node.isIdentifier(unwrapped) && unwrapped.getText() === 'undefined')
  );
}

function isObjectPrototypeHasOwnProperty(expr: Node): boolean {
  const outerMember = getMemberAccess(expr);
  if (outerMember?.name !== 'hasOwnProperty') return false;
  const protoMember = getMemberAccess(outerMember.expression);
  return Boolean(protoMember?.name === 'prototype' && isGlobalReference(protoMember.expression, 'Object'));
}

function isKeyCondition(
  node: Node | undefined,
  objName: string,
  keyNode: Node,
  expectPresent = false,
): boolean {
  if (!node) return false;
  const unwrapped = unwrapExpression(node);

  const directKey = getObjKeyAccess(unwrapped, objName);
  if (directKey && areNodesEqual(directKey, keyNode)) {
    return expectPresent;
  }

  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.ExclamationToken
  ) {
    return isKeyCondition(unwrapped.getOperand(), objName, keyNode, !expectPresent);
  }

  if (!Node.isBinaryExpression(unwrapped)) {
    if (!expectPresent) return false;
    const method = unwrapStrictMethodCall(unwrapped);
    if (!method || method.args.length === 0) return false;
    const lastArg = method.args.at(-1);
    if (!lastArg || !areNodesEqual(lastArg, keyNode)) return false;

    if (method.methodName === 'hasOwnProperty' && method.args.length === 1) {
      return getIdentifierName(method.receiver) === objName;
    }
    if (method.args.length === 2 && getIdentifierName(method.args[0]) === objName) {
      return (
        (method.methodName === 'hasOwn' && isGlobalReference(method.receiver, 'Object')) ||
        (method.methodName === 'call' && isObjectPrototypeHasOwnProperty(method.receiver))
      );
    }
    return false;
  }

  const op = unwrapped.getOperatorToken().getKind();
  const left = unwrapped.getLeft();
  const right = unwrapped.getRight();
  if (op === SyntaxKind.InKeyword) {
    return expectPresent && getIdentifierName(right) === objName && areNodesEqual(left, keyNode);
  }

  const isEq = op === SyntaxKind.EqualsEqualsToken || op === SyntaxKind.EqualsEqualsEqualsToken;
  const isNeq =
    op === SyntaxKind.ExclamationEqualsToken || op === SyntaxKind.ExclamationEqualsEqualsToken;
  if (!isEq && !isNeq) return false;
  if (isEq === expectPresent) return false;

  const targetNode = isNullishNode(right) ? left : isNullishNode(left) ? right : undefined;
  const accessedKey = getObjKeyAccess(targetNode, objName);
  return Boolean(accessedKey && areNodesEqual(accessedKey, keyNode));
}

function extractAppendKey(node: Node | undefined, objName: string, itemName: string): Node | undefined {
  const elements = getArrayElements(node);
  if (
    elements?.length === 2 &&
    Node.isSpreadElement(elements[0]) &&
    getIdentifierName(elements[1]) === itemName
  ) {
    return extractInitKey(elements[0].getExpression(), objName, true);
  }
  const method = unwrapStrictMethodCall(node);
  if (method?.methodName === 'concat' && method.args.length === 1 && getIdentifierName(method.args[0]) === itemName) {
    return extractInitKey(method.receiver, objName, true);
  }
  return undefined;
}

function isUnrelatedKeyDeclaration(stmt: Node, objName: string, itemName: string): boolean {
  if (!Node.isVariableStatement(stmt)) return false;
  return !stmt.getDeclarations().some((decl) => {
    const declName = getDeclaredIdentifierName(decl.getNameNode());
    return (
      declName === objName ||
      declName === itemName ||
      Boolean(extractInitKey(decl.getInitializer(), objName, true))
    );
  });
}

function matchSingleStatementGroup(stmt: Node, objName: string, itemName: string): boolean {
  const exprs = flattenCommaExprs(unwrapSingleExpression(stmt));
  if (exprs.length > 1) {
    return matchGroupStmts(exprs, objName, itemName);
  }

  const onlyExpr = exprs[0];
  const ternary = onlyExpr && Node.isConditionalExpression(onlyExpr) ? onlyExpr : null;
  const cond = Node.isIfStatement(stmt) ? stmt.getExpression() : ternary?.getCondition();
  const whenTrue = Node.isIfStatement(stmt) ? stmt.getThenStatement() : ternary?.getWhenTrue();
  const whenFalse = Node.isIfStatement(stmt) ? stmt.getElseStatement() : ternary?.getWhenFalse();

  if (!cond) {
    if (extractInitKey(getPushReceiver(onlyExpr, itemName), objName)) return true;
    const eq = getObjKeyEquals(onlyExpr, objName);
    const appendKey = eq ? extractAppendKey(eq.rhs, objName, itemName) : undefined;
    return Boolean(eq && appendKey && areNodesEqual(eq.key, appendKey));
  }

  const checkBranch = (pushBranch: Node | undefined, initBranch: Node | undefined, expectPresent: boolean): boolean => {
    const eq = getObjKeyEquals(unwrapSingleExpression(initBranch), objName);
    const pushKey = getObjKeyAccess(getPushReceiver(unwrapSingleExpression(pushBranch), itemName), objName);
    if (!eq || !pushKey || !areNodesEqual(eq.key, pushKey)) return false;
    const rhsElements = getArrayElements(eq.rhs);
    if (!rhsElements || rhsElements.length !== 1 || getIdentifierName(rhsElements[0]) !== itemName) {
      return false;
    }
    return isKeyCondition(cond, objName, eq.key, expectPresent);
  };

  return checkBranch(whenTrue, whenFalse, true) || checkBranch(whenFalse, whenTrue, false);
}

function matchGroupStmts(rawStmts: readonly Node[], objName: string, itemName: string): boolean {
  let stmts = rawStmts;
  while (stmts.length > 1 && isUnrelatedKeyDeclaration(stmts[0], objName, itemName)) {
    stmts = stmts.slice(1);
  }
  const [s0, s1, s2, s3] = stmts;
  if (!s1) {
    return Boolean(s0 && matchSingleStatementGroup(s0, objName, itemName));
  }
  if (s3) return false;

  const pushTarget = getPushReceiver(unwrapSingleExpression(s1), itemName);
  const directPushKey = getObjKeyAccess(pushTarget, objName);
  if (directPushKey) {
    if (s2) return false;
    if (Node.isIfStatement(s0)) {
      if (s0.getElseStatement() || !isKeyCondition(s0.getExpression(), objName, directPushKey, false)) {
        return false;
      }
      return areNodesEqual(extractInitKey(unwrapSingleExpression(s0.getThenStatement()), objName), directPushKey);
    }
    return areNodesEqual(extractInitKey(unwrapSingleExpression(s0), objName), directPushKey);
  }

  if (!pushTarget || !Node.isVariableStatement(s0)) return false;
  const decls = s0.getDeclarations();
  if (decls.length !== 1) return false;
  const bucketVarName = getDeclaredIdentifierName(decls[0].getNameNode());
  const pushedVarName = getIdentifierName(pushTarget);
  if (!bucketVarName || bucketVarName !== pushedVarName || bucketVarName === objName || bucketVarName === itemName) {
    return false;
  }

  const initKey = extractInitKey(decls[0].getInitializer(), objName, Boolean(s2));
  if (!initKey) return false;
  if (!s2) return true;

  const finalAssign = getObjKeyEquals(unwrapSingleExpression(s2), objName);
  return Boolean(
    finalAssign &&
      getIdentifierName(finalAssign.rhs) === bucketVarName &&
      areNodesEqual(initKey, finalAssign.key),
  );
}

function matchReduce(body: Node, accName: string, itemName: string): boolean {
  let leadStmts: Statement[] = [];
  let returnedExpr: Node | undefined = unwrapExpression(body);
  if (Node.isBlock(body)) {
    const stmts = body.getStatements();
    leadStmts = stmts.slice(0, -1);
    const lastStmt = stmts.at(-1);
    const retExpr = lastStmt && Node.isReturnStatement(lastStmt) ? lastStmt.getExpression() : undefined;
    returnedExpr = retExpr ? unwrapExpression(retExpr) : undefined;
  }

  if (!returnedExpr || !Node.isObjectLiteralExpression(returnedExpr)) {
    const commaExprs = flattenCommaExprs(returnedExpr);
    return (
      getIdentifierName(commaExprs.at(-1)) === accName &&
      matchGroupStmts([...leadStmts, ...commaExprs.slice(0, -1)], accName, itemName)
    );
  }

  const props = returnedExpr.getProperties();
  if (props.length !== 2 || leadStmts.length > 2) return false;
  if (!leadStmts.every((stmt) => isUnrelatedKeyDeclaration(stmt, accName, itemName))) return false;
  const [spreadProp, computedProp] = props;
  if (
    !Node.isSpreadAssignment(spreadProp) ||
    getIdentifierName(spreadProp.getExpression()) !== accName ||
    !Node.isPropertyAssignment(computedProp)
  ) {
    return false;
  }
  const propNameNode = computedProp.getNameNode();
  if (!Node.isComputedPropertyName(propNameNode)) return false;
  const appendKey = extractAppendKey(computedProp.getInitializer(), accName, itemName);
  return Boolean(appendKey && areNodesEqual(propNameNode.getExpression(), appendKey));
}

function isGroupingLoop(loopStmt: Statement, itemName: string | null, body: Node): boolean {
  if (!itemName || body.getFirstDescendantByKind(SyntaxKind.AwaitExpression)) return false;
  const parent = loopStmt.getParent();
  if (!parent || (!Node.isBlock(parent) && !Node.isSourceFile(parent))) return false;

  const stmts = parent.getStatements();
  const loopIndex = stmts.indexOf(loopStmt);
  const bodyStmts = Node.isBlock(body) ? body.getStatements() : [body];

  for (let i = 0; i < loopIndex; i++) {
    const stmt = stmts[i];
    if (!Node.isVariableStatement(stmt)) continue;

    for (const decl of stmt.getDeclarations()) {
      if (!isEmptyObjectLiteralOrCreate(decl.getInitializer())) continue;
      const objName = getDeclaredIdentifierName(decl.getNameNode());
      if (!objName || !matchGroupStmts(bodyStmts, objName, itemName)) continue;

      const usedBeforeLoop = stmts.slice(i + 1, loopIndex).some((betweenStmt) =>
        betweenStmt.getDescendantsOfKind(SyntaxKind.Identifier).some(
          (id) => id.getText() === objName && resolvesToBinding(id, decl),
        ),
      );
      if (usedBeforeLoop) continue;

      const callsHasOwnPropertyAfterLoop = stmts.slice(loopIndex + 1).some((afterStmt) =>
        afterStmt.getDescendantsOfKind(SyntaxKind.Identifier).some(
          (id) =>
            id.getText() === objName &&
            resolvesToBinding(id, decl) &&
            getMemberAccess(id.getParent())?.name === 'hasOwnProperty',
        ),
      );
      if (!callsHasOwnPropertyAfterLoop) return true;
    }
  }
  return false;
}

export const objectGroupByMatcher: JsRuleMatcher = createJsAstMatcher({
  fastTokens: [['.push', '.concat', '[...', '[ ...'], ['.reduce', ' of ', '.forEach']],
  featureGuardTokens: ['groupBy'],
  dedupeLines: true,
  kinds: [SyntaxKind.ForOfStatement, SyntaxKind.CallExpression],
  shouldSkipFile: (sf) => /\b(?:Object|Map)\.groupBy\s*=/.test(sf.getFullText()),
  matchNode(node) {
    if (Node.isForOfStatement(node)) {
      if (node.isAwaited()) return null;
      const init = node.getInitializer();
      if (!init || !Node.isVariableDeclarationList(init)) return null;
      const decls = init.getDeclarations();
      if (decls.length !== 1) return null;
      const itemName = getDeclaredIdentifierName(decls[0].getNameNode());
      return isGroupingLoop(node, itemName, node.getStatement()) ? MESSAGE : null;
    }

    if (!Node.isCallExpression(node)) return null;
    const method = unwrapStrictMethodCall(node);
    if (!method || (method.methodName !== 'reduce' && method.methodName !== 'forEach')) return null;

    const cb = method.args[0] ? unwrapExpression(method.args[0]) : undefined;
    if (!cb || (!Node.isArrowFunction(cb) && !Node.isFunctionExpression(cb)) || cb.isAsync()) {
      return null;
    }

    const [param0, param1] = cb.getParameters();
    const accOrItemName = param0 && !param0.getInitializer()
      ? getDeclaredIdentifierName(param0.getNameNode())
      : null;
    if (method.methodName === 'reduce') {
      const itemName = param1 && !param1.getInitializer()
        ? getDeclaredIdentifierName(param1.getNameNode())
        : null;
      if (
        accOrItemName &&
        itemName &&
        isEmptyObjectLiteralOrCreate(method.args[1]) &&
        matchReduce(cb.getBody(), accOrItemName, itemName)
      ) {
        return MESSAGE;
      }
      return null;
    }

    const parent = node.getParent();
    if (parent && Node.isExpressionStatement(parent) && isGroupingLoop(parent, accOrItemName, cb.getBody())) {
      return MESSAGE;
    }
    return null;
  },
});

export const objectGroupByRule: AnalyzerRule = {
  id: 'js/object-group-by',
  guideId: 'js',
  guideHash: JS_GUIDE_HASH,
  summary: 'Replace manual object-accumulator grouping loops and .reduce() calls with Object.groupBy().',
  matcher: objectGroupByMatcher,
  verifierRubric: {
    keepWhen: ['Synchronous grouping of an iterable into a fresh object mapping keys to unmodified element arrays.'],
    dropWhen: [
      'Downstream code calls Object.prototype methods (.hasOwnProperty(), .toString(), .valueOf()) or instanceof.',
      'Keys need Map.groupBy() semantics (object identity, NaN equality, or distinct number vs string keys).',
      'Accumulates into a pre-seeded object, spans nested/multiple loops, or filters, deduplicates, or maps items.',
      'Explicit pre-ES2024 config (engines.node < 21, TS < 5.4, target/lib < ES2024, or polyfill); keep if unstated.',
    ],
  },
};

export default [objectGroupByRule] satisfies readonly AnalyzerRule[];
