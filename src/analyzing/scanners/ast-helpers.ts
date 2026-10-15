import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type ExportDeclaration,
  type IfStatement,
  type ImportDeclaration,
  type SourceFile,
  type Statement,
} from 'ts-morph';
import ts from 'typescript';

/**
 * Strips parentheses, type assertions, non-null assertions, and satisfies wrappers
 * to reveal the underlying core expression.
 */
export function unwrapExpression(expr: Node): Node {
  let current = expr;
  while (true) {
    if (Node.isParenthesizedExpression(current)) {
      current = current.getExpression();
    } else if (Node.isAsExpression(current)) {
      current = current.getExpression();
    } else if (Node.isTypeAssertion(current)) {
      current = current.getExpression();
    } else if (Node.isNonNullExpression(current)) {
      current = current.getExpression();
    } else if (Node.isSatisfiesExpression(current)) {
      current = current.getExpression();
    } else {
      break;
    }
  }
  return current;
}

/**
 * Searches statements for a variable declaration initializer matching `name`.
 */
function findVariableInitializerInStatements(
  statements: readonly Statement[],
  name: string,
  beforePos: number,
): Node | null {
  for (const stmt of statements) {
    if (stmt.getStart() >= beforePos) {
      break;
    }
    if (!Node.isVariableStatement(stmt)) {
      continue;
    }
    for (const decl of stmt.getDeclarationList().getDeclarations()) {
      if (decl.getName() === name) {
        return decl.getInitializer() ?? null;
      }
    }
  }
  return null;
}

/**
 * Checks whether `name` is a parameter in a callable scope.
 */
function isParameterInScope(scope: Node, name: string): boolean {
  if (
    !Node.isFunctionDeclaration(scope) &&
    !Node.isFunctionExpression(scope) &&
    !Node.isArrowFunction(scope) &&
    !Node.isMethodDeclaration(scope)
  ) {
    return false;
  }
  return scope.getParameters().some((param) => param.getName() === name);
}

/**
 * Searches the lexical ancestor blocks preceding `startNode` for a local `const` or `let`
 * initializer matching `name`.
 */
function findLocalInitializer(startNode: Node, name: string): Node | null {
  let currentScope: Node | undefined = startNode.getParent();

  while (currentScope) {
    if (isParameterInScope(currentScope, name)) {
      return null;
    }

    if (Node.isBlock(currentScope) || Node.isSourceFile(currentScope)) {
      const init = findVariableInitializerInStatements(
        currentScope.getStatements(),
        name,
        startNode.getStart(),
      );
      if (init) {
        return init;
      }
    }

    currentScope = currentScope.getParent();
  }

  return null;
}

/**
 * Resolves a local variable reference up to `maxHops` (default 1) to its initializer expression.
 */
export function resolveLocalExpression(node: Node, maxHops: number = 1): Node {
  let current = unwrapExpression(node);
  let hops = 0;

  while (hops < maxHops && Node.isIdentifier(current)) {
    const identifierName = current.getText();
    const resolved = findLocalInitializer(current, identifierName);
    if (!resolved || resolved === current) {
      break;
    }
    current = unwrapExpression(resolved);
    hops++;
  }

  return current;
}

/**
 * Checks whether `globalName` is bound by any statement in the scope.
 */
function isShadowedByStatements(
  statements: readonly Statement[],
  globalName: string,
): boolean {
  for (const stmt of statements) {
    if (Node.isVariableStatement(stmt)) {
      for (const decl of stmt.getDeclarationList().getDeclarations()) {
        if (decl.getName() === globalName) {
          return true;
        }
      }
    } else if (Node.isFunctionDeclaration(stmt) || Node.isClassDeclaration(stmt)) {
      if (stmt.getName() === globalName) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks whether `globalName` is shadowed by an import declaration.
 */
function isShadowedByImports(sourceFile: SourceFile, globalName: string): boolean {
  for (const imp of sourceFile.getImportDeclarations()) {
    const def = imp.getDefaultImport();
    if (def && def.getText() === globalName) {
      return true;
    }
    for (const named of imp.getNamedImports()) {
      const alias = named.getAliasNode();
      if (alias && alias.getText() === globalName) {
        return true;
      }
      if (named.getName() === globalName) {
        return true;
      }
    }
    const ns = imp.getNamespaceImport();
    if (ns && ns.getText() === globalName) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether an identifier referring to `globalName` (e.g. 'Temporal', 'Date')
 * is an unshadowed global and not bound by a local variable, parameter, or import.
 */
export function isUnshadowedGlobal(node: Node, globalName: string): boolean {
  let currentScope: Node | undefined = node.getParent();

  while (currentScope) {
    if (isParameterInScope(currentScope, globalName)) {
      return false;
    }

    if (Node.isCatchClause(currentScope)) {
      const catchVar = currentScope.getVariableDeclaration();
      if (catchVar && catchVar.getName() === globalName) {
        return false;
      }
    }

    if (Node.isBlock(currentScope) || Node.isSourceFile(currentScope)) {
      if (isShadowedByStatements(currentScope.getStatements(), globalName)) {
        return false;
      }
    }

    if (Node.isSourceFile(currentScope) && isShadowedByImports(currentScope, globalName)) {
      return false;
    }

    currentScope = currentScope.getParent();
  }

  return true;
}

/**
 * Checks for negative equality comparisons like `typeof Feature === 'undefined'` or `Feature == null`.
 */
function checkBinaryComparisonPolarity(expr: BinaryExpression): 'positive' | 'negative' | null {
  const op = expr.getOperatorToken().getKind();
  const rightText = expr.getRight().getText();
  const isEquality =
    op === SyntaxKind.EqualsEqualsToken ||
    op === SyntaxKind.EqualsEqualsEqualsToken;
  const isInequality =
    op === SyntaxKind.ExclamationEqualsToken ||
    op === SyntaxKind.ExclamationEqualsEqualsToken;

  const negativeValues = new Set(["'undefined'", '"undefined"', 'undefined', 'null', 'false']);
  if (isEquality && negativeValues.has(rightText)) {
    return 'negative';
  }
  if (isInequality && negativeValues.has(rightText)) {
    return 'positive';
  }
  return null;
}

/**
 * Determines whether a conditional expression tests positively or negatively for any of `featureTokens`.
 */
function conditionCheckPolarity(
  conditionExpr: Node,
  featureTokens: readonly string[],
): 'positive' | 'negative' | null {
  const unwrapped = unwrapExpression(conditionExpr);

  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.ExclamationToken
  ) {
    const innerPolarity = conditionCheckPolarity(
      unwrapped.getOperand(),
      featureTokens,
    );
    if (innerPolarity === 'positive') {
      return 'negative';
    }
    if (innerPolarity === 'negative') {
      return 'positive';
    }
    return null;
  }

  const condText = unwrapped.getText();
  const mentionsFeature = featureTokens.some((token) =>
    condText.includes(token),
  );
  if (!mentionsFeature) {
    return null;
  }

  if (Node.isBinaryExpression(unwrapped)) {
    const binPolarity = checkBinaryComparisonPolarity(unwrapped);
    if (binPolarity) {
      return binPolarity;
    }
  }

  return 'positive';
}

/**
 * Checks whether a statement or block unconditionally terminates control flow (return, throw, break).
 */
function statementAlwaysExits(stmt: Node): boolean {
  if (
    Node.isReturnStatement(stmt) ||
    Node.isThrowStatement(stmt) ||
    Node.isBreakStatement(stmt)
  ) {
    return true;
  }
  if (Node.isBlock(stmt)) {
    const statements = stmt.getStatements();
    if (statements.length === 0) {
      return false;
    }
    const last = statements[statements.length - 1];
    return last ? statementAlwaysExits(last) : false;
  }
  return false;
}

/**
 * Checks whether container node contains the target node by start/end positions.
 */
function nodeContains(container: Node, target: Node): boolean {
  return (
    container === target ||
    (target.getStart() >= container.getStart() &&
      target.getEnd() <= container.getEnd())
  );
}

/**
 * Evaluates whether an IfStatement branch guards the current node.
 */
function isGuardedByIfStatement(
  ifStmt: IfStatement,
  target: Node,
  featureTokens: readonly string[],
): boolean {
  const polarity = conditionCheckPolarity(ifStmt.getExpression(), featureTokens);
  if (polarity === 'positive') {
    const elseStmt = ifStmt.getElseStatement();
    if (elseStmt && nodeContains(elseStmt, target)) {
      return true;
    }
  } else if (polarity === 'negative') {
    const thenStmt = ifStmt.getThenStatement();
    if (nodeContains(thenStmt, target)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a prior early-return if-statement in the block guards subsequent code.
 */
function isGuardedByPrecedingEarlyReturn(
  statements: readonly Statement[],
  target: Node,
  featureTokens: readonly string[],
): boolean {
  for (const stmt of statements) {
    if (stmt.getStart() >= target.getStart()) {
      break;
    }
    if (!Node.isIfStatement(stmt)) {
      continue;
    }
    const polarity = conditionCheckPolarity(stmt.getExpression(), featureTokens);
    if (polarity === 'positive' && statementAlwaysExits(stmt.getThenStatement())) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a ternary conditional expression guards the current node.
 */
function isGuardedByTernary(
  parent: Node,
  current: Node,
  featureTokens: readonly string[],
): boolean {
  if (!Node.isConditionalExpression(parent)) {
    return false;
  }
  const polarity = conditionCheckPolarity(parent.getCondition(), featureTokens);
  if (polarity === 'positive') {
    return nodeContains(parent.getWhenFalse(), current);
  }
  if (polarity === 'negative') {
    return nodeContains(parent.getWhenTrue(), current);
  }
  return false;
}

/**
 * Checks whether a binary logical expression (|| or ??) guards the current node as a fallback.
 */
function isGuardedByLogicalFallback(
  parent: Node,
  current: Node,
  featureTokens: readonly string[],
): boolean {
  if (!Node.isBinaryExpression(parent)) {
    return false;
  }
  const op = parent.getOperatorToken().getKind();
  if (op !== SyntaxKind.BarBarToken && op !== SyntaxKind.QuestionQuestionToken) {
    return false;
  }
  if (!nodeContains(parent.getRight(), current)) {
    return false;
  }
  return conditionCheckPolarity(parent.getLeft(), featureTokens) === 'positive';
}

/**
 * Checks whether `node` is guarded by a branch-aware feature guard checking any of `featureTokens`.
 * Recognizes positive checks guarding `else` branches, negative checks guarding `then` branches,
 * ternary conditions, fallback logical RHS (`hasFeature || fallback`), and early returns.
 */
export function isProtectedByFeatureGuard(
  node: Node,
  featureTokens: readonly string[],
): boolean {
  let current: Node | undefined = node;

  while (current) {
    const parent: Node | undefined = current.getParent();
    if (!parent) {
      break;
    }

    if (Node.isIfStatement(parent) && isGuardedByIfStatement(parent, current, featureTokens)) {
      return true;
    }

    if (isGuardedByTernary(parent, current, featureTokens)) {
      return true;
    }

    if (isGuardedByLogicalFallback(parent, current, featureTokens)) {
      return true;
    }

    if (
      (Node.isBlock(parent) || Node.isSourceFile(parent)) &&
      isGuardedByPrecedingEarlyReturn(parent.getStatements(), current, featureTokens)
    ) {
      return true;
    }

    current = parent;
  }

  return false;
}

/**
 * Safely extracts the module specifier string from an import/export declaration,
 * returning null if the specifier is not a string literal (e.g. template import syntax `<%= path %>`).
 */
export function getSafeModuleSpecifier(
  decl: ImportDeclaration | ExportDeclaration,
): string | null {
  const moduleSpecifier = decl.getModuleSpecifier();
  if (!moduleSpecifier) {
    return null;
  }
  const compilerNode = moduleSpecifier.compilerNode;
  if (ts.isStringLiteral(compilerNode)) {
    return compilerNode.text;
  }
  return null;
}
