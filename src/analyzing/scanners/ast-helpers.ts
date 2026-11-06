import {
  Node,
  SyntaxKind,
  ts,
  type ArrowFunction,
  type BinaryExpression,
  type CallExpression,
  type ExportDeclaration,
  type FunctionDeclaration,
  type FunctionExpression,
  type ImportDeclaration,
  type MethodDeclaration,
  type SourceFile,
  type Statement,
  type VariableDeclaration,
} from 'ts-morph';

/**
 * Strips parentheses, type assertions, non-null assertions, and satisfies wrappers
 * to reveal the underlying core expression.
 */
export function unwrapExpression(expr: Node): Node {
  let current = expr;
  while (
    Node.isParenthesizedExpression(current) ||
    Node.isAsExpression(current) ||
    Node.isTypeAssertion(current) ||
    Node.isNonNullExpression(current) ||
    Node.isSatisfiesExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
}

function isCallableScope(
  scope: Node,
): scope is FunctionDeclaration | FunctionExpression | ArrowFunction | MethodDeclaration {
  return (
    Node.isFunctionDeclaration(scope) ||
    Node.isFunctionExpression(scope) ||
    Node.isArrowFunction(scope) ||
    Node.isMethodDeclaration(scope)
  );
}

function hasBindingName(decl: VariableDeclaration, name: string): boolean {
  const nameNode = decl.getNameNode();
  return Node.isIdentifier(nameNode)
    ? nameNode.getText() === name
    : nameNode
        .getDescendantsOfKind(SyntaxKind.BindingElement)
        .some((el) => Node.isIdentifier(el.getNameNode()) && el.getName() === name);
}

interface ResolvedImport {
  readonly declaration: ImportDeclaration;
  readonly importedName: string;
}

function findImportBinding(sourceFile: SourceFile, localName: string): ResolvedImport | null {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getDefaultImport()?.getText() === localName) {
      return { declaration, importedName: 'default' };
    }
    if (declaration.getNamespaceImport()?.getText() === localName) {
      return { declaration, importedName: '*' };
    }
    for (const named of declaration.getNamedImports()) {
      const boundName = named.getAliasNode()?.getText() ?? named.getName();
      if (boundName === localName) {
        return { declaration, importedName: named.getName() };
      }
    }
  }
  return null;
}

type LexicalBinding =
  | { readonly kind: 'variable'; readonly node: VariableDeclaration }
  | { readonly kind: 'function'; readonly node: FunctionDeclaration }
  | { readonly kind: 'import'; readonly importBinding: ResolvedImport }
  | { readonly kind: 'other' };

/**
 * Walks enclosing lexical scopes from `startNode` up to `SourceFile` and returns
 * the innermost binding for `name` (or `null` if `name` is unbound / global).
 */
function resolveLexicalBinding(
  startNode: Node,
  name: string,
  beforePos?: number,
): LexicalBinding | null {
  for (let current = startNode.getParent(); current; current = current.getParent()) {
    if (isCallableScope(current)) {
      if (current.getParameter(name)) {
        return { kind: 'other' };
      }
      if (
        (Node.isFunctionDeclaration(current) || Node.isFunctionExpression(current)) &&
        current.getName() === name
      ) {
        return Node.isFunctionDeclaration(current)
          ? { kind: 'function', node: current }
          : { kind: 'other' };
      }
    }

    if (Node.isCatchClause(current)) {
      const catchVar = current.getVariableDeclaration();
      if (catchVar && hasBindingName(catchVar, name)) {
        return { kind: 'other' };
      }
    }

    if (
      Node.isForStatement(current) ||
      Node.isForOfStatement(current) ||
      Node.isForInStatement(current)
    ) {
      const init = current.getInitializer();
      if (init && Node.isVariableDeclarationList(init)) {
        const loopDecl = init.getDeclarations().find((d) => hasBindingName(d, name));
        if (loopDecl) {
          return beforePos !== undefined && loopDecl.getStart() >= beforePos
            ? { kind: 'other' }
            : { kind: 'variable', node: loopDecl };
        }
      }
    }

    if (Node.isBlock(current) || Node.isSourceFile(current)) {
      const decl = current.getVariableDeclaration(
        (d) => hasBindingName(d, name) && (beforePos === undefined || d.getStart() < beforePos),
      );
      if (decl) {
        return { kind: 'variable', node: decl };
      }
      const func = current.getFunction(name);
      if (func) {
        return { kind: 'function', node: func };
      }
      if (current.getClass(name)) {
        return { kind: 'other' };
      }
    }

    if (Node.isSourceFile(current)) {
      const importBinding = findImportBinding(current, name);
      if (importBinding) {
        return { kind: 'import', importBinding };
      }
    }
  }

  return null;
}

/**
 * Resolves a local variable reference up to `maxHops` (default 1) to its initializer expression.
 */
export function resolveLocalExpression(node: Node, maxHops: number = 1): Node {
  let current = unwrapExpression(node);
  const seen = new Set<Node>();
  for (let hops = 0; hops < maxHops && Node.isIdentifier(current); hops++) {
    seen.add(current);
    const name = current.getText();
    const binding = resolveLexicalBinding(current, name, current.getStart());
    const init =
      binding?.kind === 'variable' && Node.isIdentifier(binding.node.getNameNode())
        ? binding.node.getInitializer()
        : undefined;
    if (!init || init === current) {
      break;
    }
    const unwrappedInit = unwrapExpression(init);
    if (seen.has(unwrappedInit)) {
      break;
    }
    current = unwrappedInit;
  }
  return current;
}

/**
 * Extends resolveLocalExpression(node, maxHops): if `node` (or its resolved target) is an
 * Identifier that resolves to a local FunctionDeclaration in the enclosing block/file,
 * returns that FunctionDeclaration; otherwise returns resolveLocalExpression(node, maxHops).
 */
export function resolveCallableNode(node: Node, maxHops: number = 1): Node {
  const resolved = resolveLocalExpression(node, maxHops);
  if (Node.isIdentifier(resolved)) {
    const binding = resolveLexicalBinding(resolved, resolved.getText());
    if (binding?.kind === 'function') {
      return binding.node;
    }
  }
  return resolved;
}

/**
 * Checks whether an identifier referring to `globalName` (e.g. 'Temporal', 'Date')
 * is an unshadowed global and not bound by a local variable, parameter, or import.
 */
export function isUnshadowedGlobal(node: Node, globalName: string): boolean {
  return resolveLexicalBinding(node, globalName) === null;
}

const GLOBAL_ROOT_IDENTIFIERS = new Set(['window', 'globalThis', 'self']);

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

  if (Node.isPropertyAccessExpression(unwrapped) && unwrapped.getName() === globalName) {
    const rootExpr = unwrapExpression(unwrapped.getExpression());
    if (Node.isIdentifier(rootExpr)) {
      const rootName = rootExpr.getText();
      return GLOBAL_ROOT_IDENTIFIERS.has(rootName) && isUnshadowedGlobal(rootExpr, rootName);
    }
  }

  return false;
}

const NEGATIVE_COMPARISON_VALUES = new Set([
  "'undefined'",
  '"undefined"',
  'undefined',
  'null',
  'false',
]);

/**
 * Checks for negative equality comparisons like `typeof Feature === 'undefined'` or `Feature == null`.
 */
function checkBinaryComparisonPolarity(expr: BinaryExpression): 'positive' | 'negative' | null {
  if (!NEGATIVE_COMPARISON_VALUES.has(expr.getRight().getText())) {
    return null;
  }
  const op = expr.getOperatorToken().getKind();
  if (op === SyntaxKind.EqualsEqualsToken || op === SyntaxKind.EqualsEqualsEqualsToken) {
    return 'negative';
  }
  if (op === SyntaxKind.ExclamationEqualsToken || op === SyntaxKind.ExclamationEqualsEqualsToken) {
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

function getStaticStringValue(node: Node | undefined): string | null {
  if (!node) {
    return null;
  }
  const unwrapped = unwrapExpression(node);
  return Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)
    ? unwrapped.getLiteralText()
    : null;
}

function matchesTokenExact(name: string | null | undefined, featureTokens: readonly string[]): boolean {
  if (!name) {
    return false;
  }
  const lower = name.toLowerCase();
  return featureTokens.some((token) => token.toLowerCase() === lower);
}

function matchesTokenNameOrSubstring(name: string | null | undefined, featureTokens: readonly string[]): boolean {
  if (!name) {
    return false;
  }
  const lower = name.toLowerCase();
  return featureTokens.some((token) => {
    const tokenLower = token.toLowerCase();
    return lower === tokenLower || lower.includes(tokenLower);
  });
}

function getRootExpression(node: Node): Node {
  let root = unwrapExpression(node);
  while (Node.isPropertyAccessExpression(root)) {
    root = unwrapExpression(root.getExpression());
  }
  return root;
}

interface PropertyCheck {
  readonly target: Node;
  readonly prop: Node;
}

function extractPropertyCheck(node: Node): PropertyCheck | null {
  if (Node.isBinaryExpression(node) && node.getOperatorToken().getKind() === SyntaxKind.InKeyword) {
    return { target: node.getRight(), prop: node.getLeft() };
  }

  if (Node.isCallExpression(node)) {
    const callee = unwrapExpression(node.getExpression());
    if (Node.isPropertyAccessExpression(callee)) {
      const method = callee.getName();
      const args = node.getArguments();
      const first = args[0];
      const second = args[1];

      if (method === 'hasOwn' && first && second && isGlobalReference(callee.getExpression(), 'Object')) {
        return { target: first, prop: second };
      }
      if (method === 'hasOwnProperty' && first) {
        return { target: callee.getExpression(), prop: first };
      }
      if (method === 'call' && first && second) {
        const target = unwrapExpression(callee.getExpression());
        const isHasOwn =
          (Node.isIdentifier(target) && target.getText() === 'hasOwnProperty') ||
          (Node.isPropertyAccessExpression(target) && target.getName() === 'hasOwnProperty');
        if (isHasOwn) {
          return { target: first, prop: second };
        }
      }
    }
  }

  return null;
}

/**
 * Validates that an AST expression represents an authentic browser feature detection check
 * rather than a bare variable null-check (e.g. `if (container)`).
 */
function isValidFeatureCondition(
  expr: Node,
  featureTokens: readonly string[],
  seen: Set<Node> = new Set(),
): boolean {
  const unwrapped = unwrapExpression(expr);

  const propCheck = extractPropertyCheck(unwrapped);
  if (propCheck) {
    const propName = getStaticStringValue(propCheck.prop);
    if (matchesTokenNameOrSubstring(propName, featureTokens)) {
      return true;
    }
    const targetRoot = getRootExpression(propCheck.target);
    const hasGlobalTargetRoot =
      Node.isIdentifier(targetRoot) &&
      (BROWSER_GLOBAL_ROOTS.has(targetRoot.getText()) ||
        /^HTML[A-Z]/.test(targetRoot.getText()) ||
        matchesTokenExact(targetRoot.getText(), featureTokens)) &&
      isUnshadowedGlobal(targetRoot, targetRoot.getText());
    return hasGlobalTargetRoot
      ? isValidFeatureCondition(propCheck.target, featureTokens, seen)
      : false;
  }

  if (Node.isIdentifier(unwrapped)) {
    const name = unwrapped.getText();
    if (matchesTokenExact(name, featureTokens) && isUnshadowedGlobal(unwrapped, name)) {
      return true;
    }
    if (seen.has(unwrapped)) {
      return false;
    }
    seen.add(unwrapped);
    const resolved = resolveLocalExpression(unwrapped, 5);
    return resolved !== unwrapped && !seen.has(resolved)
      ? isValidFeatureCondition(resolved, featureTokens, seen)
      : false;
  }

  if (Node.isBinaryExpression(unwrapped)) {
    return (
      isValidFeatureCondition(unwrapped.getLeft(), featureTokens, seen) ||
      isValidFeatureCondition(unwrapped.getRight(), featureTokens, seen)
    );
  }

  if (Node.isTypeOfExpression(unwrapped)) {
    return isValidFeatureCondition(unwrapped.getExpression(), featureTokens, seen);
  }

  if (Node.isCallExpression(unwrapped)) {
    const callee = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'supports') {
      if (isGlobalReference(callee.getExpression(), 'CSS')) {
        const argsText = unwrapped.getArguments().map((a) => a.getText()).join(' ');
        return (
          matchesTokenNameOrSubstring(argsText, featureTokens) ||
          featureTokens.some((t) => t.toLowerCase() === 'css.supports')
        );
      }
    }
    return false;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    if (matchesTokenNameOrSubstring(unwrapped.getName(), featureTokens)) {
      return true;
    }
    const root = getRootExpression(unwrapped);
    if (Node.isIdentifier(root)) {
      const rootText = root.getText();
      const isGlobalRoot =
        (BROWSER_GLOBAL_ROOTS.has(rootText) ||
          /^HTML[A-Z]/.test(rootText) ||
          matchesTokenExact(rootText, featureTokens)) &&
        isUnshadowedGlobal(root, rootText);
      if (isGlobalRoot) {
        return matchesTokenNameOrSubstring(unwrapped.getText(), featureTokens);
      }
    }
  }

  return false;
}

/**
 * Determines whether a conditional expression tests positively or negatively for any of `featureTokens`.
 */
function conditionCheckPolarity(
  conditionExpr: Node,
  featureTokens: readonly string[],
  seen: Set<Node> = new Set(),
): 'positive' | 'negative' | null {
  const unwrapped = unwrapExpression(conditionExpr);

  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.ExclamationToken
  ) {
    const inner = conditionCheckPolarity(unwrapped.getOperand(), featureTokens, seen);
    return inner === 'positive' ? 'negative' : inner === 'negative' ? 'positive' : null;
  }

  if (Node.isBinaryExpression(unwrapped)) {
    const op = unwrapped.getOperatorToken().getKind();
    if (op === SyntaxKind.AmpersandAmpersandToken || op === SyntaxKind.BarBarToken) {
      const left = conditionCheckPolarity(unwrapped.getLeft(), featureTokens, seen);
      const right = conditionCheckPolarity(unwrapped.getRight(), featureTokens, seen);
      if (left && right) {
        return left === right ? left : null;
      }
      return left ?? right;
    }
  }

  if (Node.isIdentifier(unwrapped)) {
    if (seen.has(unwrapped)) {
      return null;
    }
    seen.add(unwrapped);
    const resolved = resolveLocalExpression(unwrapped, 5);
    if (resolved !== unwrapped && !seen.has(resolved)) {
      return conditionCheckPolarity(resolved, featureTokens, seen);
    }
  }

  if (!isValidFeatureCondition(unwrapped, featureTokens, seen)) {
    return null;
  }

  return Node.isBinaryExpression(unwrapped)
    ? (checkBinaryComparisonPolarity(unwrapped) ?? 'positive')
    : 'positive';
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
    const last = stmt.getStatements().at(-1);
    return Boolean(last && statementAlwaysExits(last));
  }
  return false;
}

function hasPositiveEarlyReturn(
  statements: readonly Statement[],
  featureTokens: readonly string[],
  beforePos: number = Infinity,
): boolean {
  return statements.some(
    (stmt) =>
      stmt.getStart() < beforePos &&
      Node.isIfStatement(stmt) &&
      conditionCheckPolarity(stmt.getExpression(), featureTokens) === 'positive' &&
      statementAlwaysExits(stmt.getThenStatement()),
  );
}

function isGuardedByCallableEarlyReturn(
  callable: Node,
  featureTokens: readonly string[],
): boolean {
  if (!isCallableScope(callable)) {
    return false;
  }
  const body = callable.getBody();
  return Boolean(
    body && Node.isBlock(body) && hasPositiveEarlyReturn(body.getStatements(), featureTokens),
  );
}

const sourceFileTokenCache = new WeakMap<SourceFile, Map<string, boolean>>();

function sourceFileContainsAnyToken(
  sf: SourceFile,
  tokens: readonly string[],
): boolean {
  let cache = sourceFileTokenCache.get(sf);
  if (!cache) {
    cache = new Map<string, boolean>();
    sourceFileTokenCache.set(sf, cache);
  }

  let sfTextLower: string | undefined;
  for (const token of tokens) {
    const tokenLower = token.toLowerCase();
    let hasToken = cache.get(tokenLower);
    if (hasToken === undefined) {
      sfTextLower ??= sf.getFullText().toLowerCase();
      hasToken = sfTextLower.includes(tokenLower);
      cache.set(tokenLower, hasToken);
    }
    if (hasToken) {
      return true;
    }
  }
  return false;
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
  if (!sourceFileContainsAnyToken(node.getSourceFile(), featureTokens)) {
    return false;
  }

  const candidateCallables = Node.isCallExpression(node)
    ? node.getArguments()
    : Node.isBinaryExpression(node)
      ? [node.getRight()]
      : [];
  if (
    candidateCallables.some((arg) =>
      isGuardedByCallableEarlyReturn(resolveCallableNode(arg), featureTokens),
    )
  ) {
    return true;
  }

  for (
    let current: Node = node, parent = current.getParent();
    parent;
    current = parent, parent = current.getParent()
  ) {
    if (Node.isIfStatement(parent) || Node.isConditionalExpression(parent)) {
      const [whenTrue, whenFalse, cond] = Node.isIfStatement(parent)
        ? [parent.getThenStatement(), parent.getElseStatement(), parent.getExpression()]
        : [parent.getWhenTrue(), parent.getWhenFalse(), parent.getCondition()];
      const expected =
        current === whenFalse ? 'positive' : current === whenTrue ? 'negative' : null;
      if (expected && conditionCheckPolarity(cond, featureTokens) === expected) {
        return true;
      }
    } else if (Node.isBinaryExpression(parent)) {
      const op = parent.getOperatorToken().getKind();
      if (
        (op === SyntaxKind.BarBarToken || op === SyntaxKind.QuestionQuestionToken) &&
        current === parent.getRight() &&
        conditionCheckPolarity(parent.getLeft(), featureTokens) === 'positive'
      ) {
        return true;
      }
    } else if (
      (Node.isBlock(parent) || Node.isSourceFile(parent)) &&
      hasPositiveEarlyReturn(parent.getStatements(), featureTokens, current.getStart())
    ) {
      return true;
    }
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
  const [firstArg, secondArg] = args;
  const lastArg = args.at(-1);

  if (methodName === 'addEventListener' && secondArg) {
    const evName = getStaticStringValue(firstArg);
    return evName && eventNames.includes(evName)
      ? { eventName: evName, handlerNode: resolveCallableNode(secondArg), targetNode }
      : null;
  }

  if (methodName === 'on' && secondArg && lastArg) {
    const matchedEvent = getStaticStringValue(firstArg)
      ?.trim()
      .split(/\s+/)
      .map((e) => e.split('.')[0])
      .find((e): e is string => Boolean(e && eventNames.includes(e)));
    return matchedEvent
      ? {
          eventName: matchedEvent,
          handlerNode: resolveCallableNode(lastArg),
          targetNode,
        }
      : null;
  }

  if (
    lastArg &&
    JQUERY_EVENT_SHORTHANDS.has(methodName) &&
    eventNames.includes(methodName)
  ) {
    return {
      eventName: methodName,
      handlerNode: resolveCallableNode(lastArg),
      targetNode,
    };
  }

  return null;
}

const CLASS_LIST_MUTATION_METHODS = new Set(['add', 'remove', 'toggle', 'replace']);
const DIRECT_DOM_MUTATION_METHODS = new Set([
  'setAttribute',
  'removeAttribute',
  'toggleAttribute',
  'addClass',
  'removeClass',
  'toggleClass',
]);

function isDirectClassOrAttrMutation(n: Node): boolean {
  if (Node.isBinaryExpression(n)) {
    const op = n.getOperatorToken().getKind();
    if (op === SyntaxKind.EqualsToken || op === SyntaxKind.PlusEqualsToken) {
      const left = unwrapExpression(n.getLeft());
      return Node.isPropertyAccessExpression(left) && left.getName() === 'className';
    }
    return false;
  }

  if (!Node.isCallExpression(n)) {
    return false;
  }
  const expr = unwrapExpression(n.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  const methodName = expr.getName();

  if (DIRECT_DOM_MUTATION_METHODS.has(methodName)) {
    return true;
  }

  if (CLASS_LIST_MUTATION_METHODS.has(methodName)) {
    const caller = unwrapExpression(expr.getExpression());
    return Node.isPropertyAccessExpression(caller) && caller.getName() === 'classList';
  }

  if (methodName === 'attr') {
    const args = n.getArguments();
    const firstArg = args[0];
    return (
      args.length >= 2 ||
      (args.length === 1 && firstArg !== undefined && Node.isObjectLiteralExpression(unwrapExpression(firstArg)))
    );
  }

  return false;
}

/**
 * Traverses `node` AST descendants to check for DOM class or attribute mutations:
 * .classList.add/remove/toggle/replace, .className = ..., .setAttribute(...),
 * .removeAttribute(...), .toggleAttribute(...), or jQuery .addClass/.removeClass/.toggleClass/.attr.
 */
export function isDomClassOrAttrMutation(node: Node): boolean {
  return (
    isDirectClassOrAttrMutation(node) ||
    Boolean(node.forEachDescendant((desc) => isDirectClassOrAttrMutation(desc) || undefined))
  );
}

/**
 * Safely extracts the module specifier string from an import/export declaration,
 * returning null if the specifier is not a string literal (e.g. template import syntax `<%= path %>`).
 */
export function getSafeModuleSpecifier(
  decl: ImportDeclaration | ExportDeclaration,
): string | null {
  const spec = decl.compilerNode.moduleSpecifier;
  return spec && ts.isStringLiteral(spec) ? spec.text : null;
}

/**
 * Returns `true` when `spec` equals one of `packages` or is a subpath import (`<pkg>/...`).
 */
export function matchesPackageSpec(
  spec: string | null,
  packages: readonly string[],
): boolean {
  return (
    spec !== null &&
    packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))
  );
}

export interface RequirePackageOptions {
  readonly allowCurriedRequire?: boolean;
}

/**
 * Returns `true` when `node` unwraps to `require('<pkg>')` (or `require('<pkg>')()` when
 * `options.allowCurriedRequire` is `true`) for any package in `packages`.
 */
export function isRequireOfPackage(
  node: Node,
  packages: readonly string[],
  options?: RequirePackageOptions,
): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isCallExpression(unwrapped)) {
    return false;
  }
  const callee = unwrapExpression(unwrapped.getExpression());
  const firstArg = unwrapped.getArguments()[0];
  if (
    Node.isIdentifier(callee) &&
    callee.getText() === 'require' &&
    firstArg &&
    Node.isStringLiteral(firstArg)
  ) {
    return matchesPackageSpec(firstArg.getLiteralText(), packages);
  }
  return Boolean(options?.allowCurriedRequire && isRequireOfPackage(callee, packages, options));
}

export interface LibraryReferenceOptions extends RequirePackageOptions {
  /**
   * Whether default imports (`import lib from 'pkg'`), namespace imports (`import * as lib from 'pkg'`),
   * and bare `require('pkg')` bindings match `identName`. Defaults to `true`.
   */
  readonly allowDefaultImport?: boolean;
  /**
   * Whether an unshadowed global (`identName`, `window.<identName>`, `globalThis.<identName>`, `self.<identName>`)
   * matches without an explicit import or `require()`. Defaults to `true`.
   */
  readonly allowGlobal?: boolean;
  /**
   * Optional UMD global namespace identifiers (e.g. `['Popper', 'FloatingUIDOM']`) whose
   * `<Namespace>.<identName>` property access is recognized when `allowGlobal` is `true`.
   */
  readonly globalNamespaces?: readonly string[];
}

function matchesExpectedPropertyName(
  propName: string,
  identName: string,
  allowDefaultImport: boolean,
): boolean {
  return propName === identName || (allowDefaultImport && propName === 'default');
}

function isRequireExportExpression(
  expr: Node,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean,
  requireOpts: RequirePackageOptions | undefined,
): boolean {
  const resolved = resolveLocalExpression(expr, 2);
  if (allowDefaultImport && isRequireOfPackage(resolved, packages, requireOpts)) {
    return true;
  }
  return (
    Node.isPropertyAccessExpression(resolved) &&
    matchesExpectedPropertyName(resolved.getName(), identName, allowDefaultImport) &&
    isRequireOfPackage(resolveLocalExpression(resolved.getExpression(), 2), packages, requireOpts)
  );
}

function matchesRequireVariableDeclaration(
  decl: VariableDeclaration,
  localName: string,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean,
  requireOpts: RequirePackageOptions | undefined,
): boolean {
  const nameNode = decl.getNameNode();
  const init = decl.getInitializer();
  if (!init) {
    return false;
  }

  if (Node.isIdentifier(nameNode)) {
    return isRequireExportExpression(init, identName, packages, allowDefaultImport, requireOpts);
  }

  if (Node.isObjectBindingPattern(nameNode)) {
    const el = nameNode.getElements().find((e) => e.getName() === localName);
    if (!el) {
      return false;
    }
    const propName = el.getPropertyNameNode()?.getText() ?? el.getName();
    return (
      matchesExpectedPropertyName(propName, identName, allowDefaultImport) &&
      isRequireOfPackage(resolveLocalExpression(init, 2), packages, requireOpts)
    );
  }

  return false;
}

/**
 * Checks whether `node` refers to library export `identName` from one of `packages`
 * via ESM `import` (default, namespace, named, or aliased), CommonJS `require()`
 * (direct, property access, or destructured), or an unshadowed UMD browser global.
 */
export function isLibraryReference(
  node: Node,
  identName: string,
  packages: readonly string[],
  options?: LibraryReferenceOptions,
): boolean {
  const allowDefaultImport = options?.allowDefaultImport ?? true;
  const allowGlobal = options?.allowGlobal ?? true;
  const unwrapped = unwrapExpression(node);

  if (Node.isIdentifier(unwrapped)) {
    const localName = unwrapped.getText();
    const binding = resolveLexicalBinding(unwrapped, localName);
    if (!binding) {
      return allowGlobal && localName === identName;
    }
    if (binding.kind === 'variable') {
      return matchesRequireVariableDeclaration(
        binding.node,
        localName,
        identName,
        packages,
        allowDefaultImport,
        options,
      );
    }
    if (binding.kind === 'import') {
      const { declaration, importedName } = binding.importBinding;
      if (!matchesPackageSpec(getSafeModuleSpecifier(declaration), packages)) {
        return false;
      }
      return importedName === '*'
        ? allowDefaultImport
        : matchesExpectedPropertyName(importedName, identName, allowDefaultImport);
    }
    return false;
  }

  if (isRequireExportExpression(unwrapped, identName, packages, allowDefaultImport, options)) {
    return true;
  }

  if (
    allowGlobal &&
    Node.isPropertyAccessExpression(unwrapped) &&
    matchesExpectedPropertyName(unwrapped.getName(), identName, allowDefaultImport) &&
    options?.globalNamespaces?.some((ns) => isGlobalReference(unwrapped.getExpression(), ns))
  ) {
    return true;
  }

  return allowGlobal && isGlobalReference(unwrapped, identName);
}
