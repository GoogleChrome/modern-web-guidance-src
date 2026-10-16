import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
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
 * Searches lexical ancestor scopes for a local FunctionDeclaration matching `name`.
 */
function findLocalFunctionDeclaration(startNode: Node, name: string): Node | null {
  let currentScope: Node | undefined = startNode.getParent();

  while (currentScope) {
    if (isParameterInScope(currentScope, name)) {
      return null;
    }

    if (Node.isBlock(currentScope) || Node.isSourceFile(currentScope)) {
      for (const stmt of currentScope.getStatements()) {
        if (Node.isFunctionDeclaration(stmt) && stmt.getName() === name) {
          return stmt;
        }
      }
    }

    currentScope = currentScope.getParent();
  }

  return null;
}

/**
 * Extends resolveLocalExpression(node, maxHops): if `node` (after unwrapping) is an
 * Identifier that resolves to a local FunctionDeclaration in the enclosing block/file,
 * returns that FunctionDeclaration; otherwise returns resolveLocalExpression(node, maxHops).
 */
export function resolveCallableNode(node: Node, maxHops: number = 1): Node {
  const unwrapped = unwrapExpression(node);
  if (Node.isIdentifier(unwrapped)) {
    const fnDecl = findLocalFunctionDeclaration(unwrapped, unwrapped.getText());
    if (fnDecl) {
      return fnDecl;
    }
  }

  const resolved = resolveLocalExpression(node, maxHops);
  if (Node.isIdentifier(resolved) && resolved !== unwrapped) {
    const fnDecl = findLocalFunctionDeclaration(resolved, resolved.getText());
    if (fnDecl) {
      return fnDecl;
    }
  }

  return resolved;
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
 * Unwraps `node` and returns `true` if it refers to `globalName` as an unshadowed global,
 * either directly as an identifier (e.g. `ResizeObserver`) or via standard global object
 * property access (`window.<globalName>`, `globalThis.<globalName>`, or `self.<globalName>`)
 * where the root object is also unshadowed.
 */
export function isGlobalReference(node: Node, globalName: string): boolean {
  const unwrapped = unwrapExpression(node);

  if (Node.isIdentifier(unwrapped)) {
    return unwrapped.getText() === globalName && isUnshadowedGlobal(unwrapped, globalName);
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    if (unwrapped.getName() !== globalName) {
      return false;
    }
    const rootExpr = unwrapExpression(unwrapped.getExpression());
    if (Node.isIdentifier(rootExpr)) {
      const rootName = rootExpr.getText();
      if (rootName === 'window' || rootName === 'globalThis' || rootName === 'self') {
        return isUnshadowedGlobal(rootExpr, rootName);
      }
    }
  }

  return false;
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

const BROWSER_GLOBAL_ROOTS = new Set([
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'CSS',
  'globalThis',
  'self',
]);

/**
 * Validates that an AST expression represents an authentic browser feature detection check
 * rather than a bare variable null-check (e.g. `if (container)`).
 */
function isValidFeatureCondition(expr: Node, featureTokens: readonly string[]): boolean {
  const unwrapped = unwrapExpression(expr);

  if (Node.isIdentifier(unwrapped)) {
    return featureTokens.some((token) => isGlobalReference(unwrapped, token));
  }

  if (Node.isBinaryExpression(unwrapped)) {
    const op = unwrapped.getOperatorToken().getKind();
    if (op === SyntaxKind.InKeyword) {
      return true;
    }
    return (
      isValidFeatureCondition(unwrapped.getLeft(), featureTokens) ||
      isValidFeatureCondition(unwrapped.getRight(), featureTokens)
    );
  }

  if (Node.isTypeOfExpression(unwrapped)) {
    const operand = unwrapExpression(unwrapped.getExpression());
    if (Node.isIdentifier(operand)) {
      return featureTokens.some((token) => isGlobalReference(operand, token));
    }
    return isValidFeatureCondition(operand, featureTokens);
  }

  if (Node.isCallExpression(unwrapped)) {
    const callee = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(callee)) {
      const obj = unwrapExpression(callee.getExpression());
      if (Node.isIdentifier(obj) && obj.getText() === 'CSS' && callee.getName() === 'supports') {
        return true;
      }
    }
    return false;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    let current: Node = unwrapped;
    while (Node.isPropertyAccessExpression(current)) {
      current = unwrapExpression(current.getExpression());
    }
    if (Node.isIdentifier(current)) {
      const rootText = current.getText();
      if (BROWSER_GLOBAL_ROOTS.has(rootText) && isUnshadowedGlobal(current, rootText)) {
        return true;
      }
      const propName = unwrapped.getName();
      if (featureTokens.includes(propName)) {
        return true;
      }
    }
    return false;
  }

  return false;
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

  if (!isValidFeatureCondition(unwrapped, featureTokens)) {
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
 * Checks whether a callable node's body contains an early return checking any of `featureTokens`.
 */
function isGuardedByCallableEarlyReturn(
  callable: Node,
  featureTokens: readonly string[],
): boolean {
  let body: Node | undefined;
  if (
    Node.isFunctionDeclaration(callable) ||
    Node.isFunctionExpression(callable) ||
    Node.isMethodDeclaration(callable)
  ) {
    body = callable.getBody();
  } else if (Node.isArrowFunction(callable)) {
    body = callable.getBody();
  }

  if (body && Node.isBlock(body)) {
    for (const stmt of body.getStatements()) {
      if (Node.isIfStatement(stmt)) {
        const polarity = conditionCheckPolarity(stmt.getExpression(), featureTokens);
        if (polarity === 'positive' && statementAlwaysExits(stmt.getThenStatement())) {
          return true;
        }
      }
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
  // If node is a CallExpression (e.g. addEventListener) or BinaryExpression (e.g. onscroll = handler),
  // check if any callable argument/RHS contains an early-return guard checking featureTokens.
  if (Node.isCallExpression(node)) {
    for (const arg of node.getArguments()) {
      const callable = resolveCallableNode(arg);
      if (isGuardedByCallableEarlyReturn(callable, featureTokens)) {
        return true;
      }
    }
  } else if (Node.isBinaryExpression(node)) {
    const callable = resolveCallableNode(node.getRight());
    if (isGuardedByCallableEarlyReturn(callable, featureTokens)) {
      return true;
    }
  }

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

const JQUERY_EVENT_SHORTHANDS: ReadonlySet<string> = new Set([
  'scroll',
  'keydown',
  'keyup',
  'focus',
  'blur',
]);

export interface MatchedEventListener {
  readonly eventName: string;
  readonly handlerNode: Node;
  readonly targetNode: Node | undefined;
}

/**
 * Matches native `.addEventListener('<event>', handler)`, jQuery `.on('<event>', [selector,] handler)`,
 * and jQuery shorthands (`.scroll(handler)`, `.keydown(handler)`, `.keyup(handler)`, `.focus(handler)`, `.blur(handler)`)
 * when the event name is in `eventNames`, resolving `handlerNode` via `resolveCallableNode`.
 */
export function matchEventListenerCall(
  node: CallExpression,
  eventNames: readonly string[],
): MatchedEventListener | null {
  const expr = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  const targetNode = expr.getExpression();
  const args = node.getArguments();

  // 1. Native .addEventListener('event', handler)
  if (methodName === 'addEventListener') {
    if (args.length < 2) {
      return null;
    }
    const eventArg = unwrapExpression(args[0]);
    if (!Node.isStringLiteral(eventArg) && !Node.isNoSubstitutionTemplateLiteral(eventArg)) {
      return null;
    }
    const evName = eventArg.getLiteralText();
    if (!eventNames.includes(evName)) {
      return null;
    }
    const handlerNode = resolveCallableNode(args[1]);
    return { eventName: evName, handlerNode, targetNode };
  }

  // 2. jQuery .on('event', [selector,] handler)
  if (methodName === 'on') {
    if (args.length < 2) {
      return null;
    }
    const eventArg = unwrapExpression(args[0]);
    if (!Node.isStringLiteral(eventArg) && !Node.isNoSubstitutionTemplateLiteral(eventArg)) {
      return null;
    }
    const rawEventText = eventArg.getLiteralText().trim();
    // Support namespaced events e.g. "scroll.myPlugin" -> "scroll"
    const parsedEvents = rawEventText.split(/\s+/).map((e) => e.split('.')[0]);
    const matchedEvent = parsedEvents.find((e) => eventNames.includes(e));
    if (!matchedEvent) {
      return null;
    }
    const rawHandler = args[args.length - 1];
    const handlerNode = resolveCallableNode(rawHandler);
    return { eventName: matchedEvent, handlerNode, targetNode };
  }

  // 3. jQuery shorthand methods: .scroll(handler), .keydown(handler), etc.
  if (JQUERY_EVENT_SHORTHANDS.has(methodName) && eventNames.includes(methodName)) {
    if (args.length === 0) {
      // Shorthand with 0 args is a trigger/action, not an event listener
      return null;
    }
    const rawHandler = args[args.length - 1];
    const handlerNode = resolveCallableNode(rawHandler);
    return { eventName: methodName, handlerNode, targetNode };
  }

  return null;
}

function isDirectClassOrAttrMutation(n: Node): boolean {
  // 1. className assignment: el.className = '...' or el.className += '...'
  if (Node.isBinaryExpression(n)) {
    const op = n.getOperatorToken().getKind();
    if (op === SyntaxKind.EqualsToken || op === SyntaxKind.PlusEqualsToken) {
      const left = unwrapExpression(n.getLeft());
      if (Node.isPropertyAccessExpression(left) && left.getName() === 'className') {
        return true;
      }
    }
    return false;
  }

  // 2. Call expressions
  if (Node.isCallExpression(n)) {
    const expr = unwrapExpression(n.getExpression());
    if (!Node.isPropertyAccessExpression(expr)) {
      return false;
    }
    const methodName = expr.getName();

    // classList.add, remove, toggle, replace
    if (
      methodName === 'add' ||
      methodName === 'remove' ||
      methodName === 'toggle' ||
      methodName === 'replace'
    ) {
      const caller = unwrapExpression(expr.getExpression());
      if (Node.isPropertyAccessExpression(caller) && caller.getName() === 'classList') {
        return true;
      }
    }

    // setAttribute, removeAttribute, toggleAttribute
    if (
      methodName === 'setAttribute' ||
      methodName === 'removeAttribute' ||
      methodName === 'toggleAttribute'
    ) {
      return true;
    }

    // jQuery .addClass, .removeClass, .toggleClass
    if (
      methodName === 'addClass' ||
      methodName === 'removeClass' ||
      methodName === 'toggleClass'
    ) {
      return true;
    }

    // jQuery .attr(name, value) or .attr({ name: value })
    if (methodName === 'attr') {
      const args = n.getArguments();
      if (args.length >= 2) {
        return true;
      }
      if (args.length === 1 && Node.isObjectLiteralExpression(unwrapExpression(args[0]))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Traverses `node` AST descendants to check for DOM class or attribute mutations:
 * .classList.add/remove/toggle/replace, .className = ..., .setAttribute(...),
 * .removeAttribute(...), .toggleAttribute(...), or jQuery .addClass/.removeClass/.toggleClass/.attr.
 */
export function isDomClassOrAttrMutation(node: Node): boolean {
  if (isDirectClassOrAttrMutation(node)) {
    return true;
  }
  let found = false;
  node.forEachDescendant((desc, traversal) => {
    if (isDirectClassOrAttrMutation(desc)) {
      found = true;
      traversal.stop();
    }
  });
  return found;
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
