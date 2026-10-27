import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type BinaryExpression,
  type CallExpression,
  type ExportDeclaration,
  type FunctionDeclaration,
  type FunctionExpression,
  type ImportDeclaration,
  type MethodDeclaration,
  type ParameterDeclaration,
  type SourceFile,
  type Statement,
  type VariableDeclaration,
} from 'ts-morph';
import ts from 'typescript';

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

function getForLoopDeclarations(scope: Node): readonly VariableDeclaration[] {
  if (
    Node.isForStatement(scope) ||
    Node.isForOfStatement(scope) ||
    Node.isForInStatement(scope)
  ) {
    const init = scope.getInitializer();
    if (init && Node.isVariableDeclarationList(init)) {
      return init.getDeclarations();
    }
  }
  return [];
}

function bindingNameContains(nameNode: Node, targetName: string): boolean {
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText() === targetName;
  }
  if (Node.isObjectBindingPattern(nameNode) || Node.isArrayBindingPattern(nameNode)) {
    return nameNode
      .getElements()
      .some((el) => Node.isBindingElement(el) && bindingNameContains(el.getNameNode(), targetName));
  }
  return false;
}

function hasBindingName(
  decl: VariableDeclaration | ParameterDeclaration,
  targetName: string,
): boolean {
  return bindingNameContains(decl.getNameNode(), targetName);
}

interface ResolvedImport {
  readonly declaration: ImportDeclaration;
  readonly importedName: string;
  readonly isNamespace: boolean;
}

function findImportBinding(sourceFile: SourceFile, localName: string): ResolvedImport | null {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getDefaultImport()?.getText() === localName) {
      return { declaration, importedName: 'default', isNamespace: false };
    }
    if (declaration.getNamespaceImport()?.getText() === localName) {
      return { declaration, importedName: '*', isNamespace: true };
    }
    for (const named of declaration.getNamedImports()) {
      const boundName = named.getAliasNode()?.getText() ?? named.getName();
      if (boundName === localName) {
        return { declaration, importedName: named.getName(), isNamespace: false };
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
  let current: Node | undefined = startNode.getParent();

  while (current) {
    if (isCallableScope(current)) {
      if (current.getParameters().some((param) => hasBindingName(param, name))) {
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

    for (const decl of getForLoopDeclarations(current)) {
      if (hasBindingName(decl, name)) {
        if (beforePos !== undefined && decl.getStart() >= beforePos) {
          return { kind: 'other' };
        }
        return { kind: 'variable', node: decl };
      }
    }

    if (Node.isBlock(current) || Node.isSourceFile(current)) {
      for (const stmt of current.getStatements()) {
        if (Node.isVariableStatement(stmt)) {
          if (beforePos !== undefined && stmt.getStart() >= beforePos) {
            continue;
          }
          for (const decl of stmt.getDeclarationList().getDeclarations()) {
            if (hasBindingName(decl, name)) {
              return { kind: 'variable', node: decl };
            }
          }
        } else if (Node.isFunctionDeclaration(stmt) && stmt.getName() === name) {
          return { kind: 'function', node: stmt };
        } else if (Node.isClassDeclaration(stmt) && stmt.getName() === name) {
          return { kind: 'other' };
        }
      }
    }

    if (Node.isSourceFile(current)) {
      const importBinding = findImportBinding(current, name);
      if (importBinding) {
        return { kind: 'import', importBinding };
      }
    }

    current = current.getParent();
  }

  return null;
}

/**
 * Resolves a local variable reference up to `maxHops` (default 1) to its initializer expression.
 */
export function resolveLocalExpression(node: Node, maxHops: number = 1): Node {
  let current = unwrapExpression(node);
  for (let hops = 0; hops < maxHops && Node.isIdentifier(current); hops++) {
    const name = current.getText();
    const binding = resolveLexicalBinding(current, name, current.getStart());
    const init =
      binding?.kind === 'variable' && binding.node.getName() === name
        ? binding.node.getInitializer()
        : undefined;
    if (!init || init === current) {
      break;
    }
    current = unwrapExpression(init);
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
  const op = expr.getOperatorToken().getKind();
  if (!NEGATIVE_COMPARISON_VALUES.has(expr.getRight().getText())) {
    return null;
  }
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
    if (unwrapped.getOperatorToken().getKind() === SyntaxKind.InKeyword) {
      return true;
    }
    return (
      isValidFeatureCondition(unwrapped.getLeft(), featureTokens) ||
      isValidFeatureCondition(unwrapped.getRight(), featureTokens)
    );
  }

  if (Node.isTypeOfExpression(unwrapped)) {
    return isValidFeatureCondition(unwrapped.getExpression(), featureTokens);
  }

  if (Node.isCallExpression(unwrapped)) {
    const callee = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'supports') {
      const obj = unwrapExpression(callee.getExpression());
      return Node.isIdentifier(obj) && obj.getText() === 'CSS';
    }
    return false;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    let root: Node = unwrapped;
    while (Node.isPropertyAccessExpression(root)) {
      root = unwrapExpression(root.getExpression());
    }
    if (Node.isIdentifier(root)) {
      const rootText = root.getText();
      return (
        (BROWSER_GLOBAL_ROOTS.has(rootText) && isUnshadowedGlobal(root, rootText)) ||
        featureTokens.includes(unwrapped.getName())
      );
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
): 'positive' | 'negative' | null {
  const unwrapped = unwrapExpression(conditionExpr);

  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.ExclamationToken
  ) {
    const inner = conditionCheckPolarity(unwrapped.getOperand(), featureTokens);
    return inner === 'positive' ? 'negative' : inner === 'negative' ? 'positive' : null;
  }

  const condText = unwrapped.getText();
  if (
    !featureTokens.some((token) => condText.includes(token)) ||
    !isValidFeatureCondition(unwrapped, featureTokens)
  ) {
    return null;
  }

  if (Node.isBinaryExpression(unwrapped)) {
    return checkBinaryComparisonPolarity(unwrapped) ?? 'positive';
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
    const last = stmt.getStatements().at(-1);
    return last ? statementAlwaysExits(last) : false;
  }
  return false;
}

function hasPositiveEarlyReturn(
  statements: readonly Statement[],
  featureTokens: readonly string[],
  beforePos: number = Infinity,
): boolean {
  for (const stmt of statements) {
    if (stmt.getStart() >= beforePos) {
      break;
    }
    if (
      Node.isIfStatement(stmt) &&
      conditionCheckPolarity(stmt.getExpression(), featureTokens) === 'positive' &&
      statementAlwaysExits(stmt.getThenStatement())
    ) {
      return true;
    }
  }
  return false;
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

  let sfText: string | undefined;
  for (const token of tokens) {
    let hasToken = cache.get(token);
    if (hasToken === undefined) {
      sfText ??= sf.getFullText();
      hasToken = sfText.includes(token);
      cache.set(token, hasToken);
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

  // If node is a CallExpression (e.g. addEventListener) or BinaryExpression (e.g. onscroll = handler),
  // check if any callable argument/RHS contains an early-return guard checking featureTokens.
  if (Node.isCallExpression(node)) {
    if (
      node
        .getArguments()
        .some((arg) => isGuardedByCallableEarlyReturn(resolveCallableNode(arg), featureTokens))
    ) {
      return true;
    }
  } else if (
    Node.isBinaryExpression(node) &&
    isGuardedByCallableEarlyReturn(resolveCallableNode(node.getRight()), featureTokens)
  ) {
    return true;
  }

  for (
    let current: Node = node, parent = current.getParent();
    parent;
    current = parent, parent = current.getParent()
  ) {
    if (Node.isIfStatement(parent)) {
      const expectedPolarity =
        current === parent.getElseStatement()
          ? 'positive'
          : current === parent.getThenStatement()
            ? 'negative'
            : null;
      if (
        expectedPolarity &&
        conditionCheckPolarity(parent.getExpression(), featureTokens) === expectedPolarity
      ) {
        return true;
      }
    } else if (Node.isConditionalExpression(parent)) {
      const expectedPolarity =
        current === parent.getWhenFalse()
          ? 'positive'
          : current === parent.getWhenTrue()
            ? 'negative'
            : null;
      if (
        expectedPolarity &&
        conditionCheckPolarity(parent.getCondition(), featureTokens) === expectedPolarity
      ) {
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

function getStaticStringValue(node: Node | undefined): string | null {
  if (!node) {
    return null;
  }
  const unwrapped = unwrapExpression(node);
  return Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)
    ? unwrapped.getLiteralText()
    : null;
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

  if (methodName === 'addEventListener' && args.length >= 2) {
    const evName = getStaticStringValue(args[0]);
    if (evName && eventNames.includes(evName)) {
      return { eventName: evName, handlerNode: resolveCallableNode(args[1]), targetNode };
    }
    return null;
  }

  if (methodName === 'on' && args.length >= 2) {
    const rawEventText = getStaticStringValue(args[0])?.trim();
    if (!rawEventText) {
      return null;
    }
    const matchedEvent = rawEventText
      .split(/\s+/)
      .map((e) => e.split('.')[0])
      .find((e): e is string => Boolean(e && eventNames.includes(e)));
    if (!matchedEvent) {
      return null;
    }
    return {
      eventName: matchedEvent,
      handlerNode: resolveCallableNode(args[args.length - 1]),
      targetNode,
    };
  }

  if (
    args.length > 0 &&
    JQUERY_EVENT_SHORTHANDS.has(methodName) &&
    eventNames.includes(methodName)
  ) {
    return {
      eventName: methodName,
      handlerNode: resolveCallableNode(args[args.length - 1]),
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
    return (
      args.length >= 2 ||
      (args.length === 1 && Node.isObjectLiteralExpression(unwrapExpression(args[0])))
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

export interface LibraryReferenceOptions {
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
   * Whether curried factory calls on `require('pkg')()` (e.g. `const list = require('country-list')()`)
   * count as requiring the package. Defaults to `false`.
   */
  readonly allowCurriedRequire?: boolean;
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
  const requireOpts = options?.allowCurriedRequire
    ? { allowCurriedRequire: true }
    : undefined;

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
        requireOpts,
      );
    }
    if (binding.kind === 'import') {
      const { declaration, importedName, isNamespace } = binding.importBinding;
      if (!matchesPackageSpec(getSafeModuleSpecifier(declaration), packages)) {
        return false;
      }
      return isNamespace
        ? allowDefaultImport
        : matchesExpectedPropertyName(importedName, identName, allowDefaultImport);
    }
    return false;
  }

  if (isRequireExportExpression(unwrapped, identName, packages, allowDefaultImport, requireOpts)) {
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
