import {
  Node,
  SyntaxKind,
  VariableDeclarationKind,
  ts,
  type ArrowFunction,
  type AsExpression,
  type BinaryExpression,
  type Block,
  type CallExpression,
  type ElementAccessExpression,
  type ExportDeclaration,
  type FunctionDeclaration,
  type FunctionExpression,
  type Identifier,
  type ImportDeclaration,
  type MethodDeclaration,
  type NonNullExpression,
  type ParameterDeclaration,
  type ParenthesizedExpression,
  type PropertyAccessExpression,
  type SatisfiesExpression,
  type SourceFile,
  type Statement,
  type TypeAssertion,
  type VariableDeclaration,
} from 'ts-morph';

type WrapperExpression =
  | ParenthesizedExpression
  | AsExpression
  | TypeAssertion
  | NonNullExpression
  | SatisfiesExpression;

function isWrapperExpression(node: Node): node is WrapperExpression {
  return (
    Node.isParenthesizedExpression(node) ||
    Node.isAsExpression(node) ||
    Node.isTypeAssertion(node) ||
    Node.isNonNullExpression(node) ||
    Node.isSatisfiesExpression(node)
  );
}

const callAndBinaryCache = new WeakMap<
  object,
  ReadonlyArray<CallExpression | BinaryExpression>
>();

/**
 * Returns all `CallExpression` and `BinaryExpression` descendants of `sourceFile` in
 * exact AST pre-order (`getPos()` ascending, then `getEnd()` descending for parent-before-child),
 * memoizing the combined sorted array per `SourceFile` across rules.
 */
export function getCallAndBinaryDescendants(
  sourceFile: SourceFile,
): ReadonlyArray<CallExpression | BinaryExpression> {
  const cacheKey: object = sourceFile.compilerNode ?? sourceFile;
  const cached = callAndBinaryCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const binaries = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  const sorted =
    calls.length === 0
      ? binaries
      : binaries.length === 0
        ? calls
        : (calls as Array<CallExpression | BinaryExpression>)
            .concat(binaries)
            .sort((a, b) => a.getPos() - b.getPos() || b.getEnd() - a.getEnd());
  callAndBinaryCache.set(cacheKey, sorted);
  return sorted;
}
/**
 * Strips parentheses, type assertions, non-null assertions, and satisfies wrappers
 * to reveal the underlying core expression.
 */
export function unwrapExpression(expr: Node): Node {
  let current = expr;
  while (isWrapperExpression(current)) {
    current = current.getExpression();
  }
  return current;
}

/**
 * Climbs upward past wrapper expressions (`(...)`, `as T`, `!`, `satisfies T`) to return
 * the outermost wrapper node (`outer`) and its enclosing semantic `parent`.
 */
export function getSemanticParent(
  node: Node,
): { readonly outer: Node; readonly parent: Node | undefined } {
  let outer = node;
  let parent = outer.getParent();
  while (parent && isWrapperExpression(parent)) {
    outer = parent;
    parent = outer.getParent();
  }
  return { outer, parent };
}

export function isCallableScope(
  scope: Node,
): scope is FunctionDeclaration | FunctionExpression | ArrowFunction | MethodDeclaration {
  return (
    Node.isFunctionDeclaration(scope) ||
    Node.isFunctionExpression(scope) ||
    Node.isArrowFunction(scope) ||
    Node.isMethodDeclaration(scope)
  );
}

export const isCallableNode = isCallableScope;

export function hasBindingName(
  decl: VariableDeclaration | ParameterDeclaration,
  name: string,
): boolean {
  const nameNode = decl.getNameNode();
  return Node.isIdentifier(nameNode)
    ? nameNode.getText() === name
    : nameNode
        .getDescendantsOfKind(SyntaxKind.BindingElement)
        .some((el) => Node.isIdentifier(el.getNameNode()) && el.getName() === name);
}

export interface ResolvedImport {
  readonly declaration: ImportDeclaration;
  readonly importedName: string;
}

interface ScopeBindingIndex {
  readonly sourceText: string;
  readonly varsByName: ReadonlyMap<string, readonly VariableDeclaration[]>;
  readonly functionsByName: ReadonlyMap<string, FunctionDeclaration>;
  readonly typeOrClassNames: ReadonlySet<string>;
  readonly hoistedVarsByName: ReadonlyMap<string, VariableDeclaration> | null;
  readonly importsByName: ReadonlyMap<string, ResolvedImport> | null;
  readonly importEqualsNames: ReadonlySet<string> | null;
}

const scopeBindingCache = new WeakMap<Node, ScopeBindingIndex>();

function addBindingDeclNames(decl: VariableDeclaration, onName: (name: string) => void): void {
  const nameNode = decl.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    onName(nameNode.getText());
    return;
  }
  for (const el of nameNode.getDescendantsOfKind(SyntaxKind.BindingElement)) {
    if (Node.isIdentifier(el.getNameNode())) onName(el.getName());
  }
}

function getScopeBindingIndex(scope: Block | SourceFile): ScopeBindingIndex {
  const sourceText = scope.getSourceFile().getFullText();
  const cached = scopeBindingCache.get(scope);
  if (cached && cached.sourceText === sourceText) return cached;

  const varsByName = new Map<string, VariableDeclaration[]>();
  for (const decl of scope.getVariableDeclarations()) {
    addBindingDeclNames(decl, (name) => {
      const list = varsByName.get(name);
      if (list) { if (!list.includes(decl)) list.push(decl); } else varsByName.set(name, [decl]);
    });
  }

  const functionsByName = new Map<string, FunctionDeclaration>();
  for (const fn of scope.getFunctions()) {
    const fnName = fn.getName();
    if (fnName && !functionsByName.has(fnName)) functionsByName.set(fnName, fn);
  }

  const typeOrClassNames = new Set<string>();
  for (const cls of scope.getClasses()) { const clsName = cls.getName(); if (clsName) typeOrClassNames.add(clsName); }
  for (const enm of scope.getEnums()) typeOrClassNames.add(enm.getName());

  let hoistedVarsByName: Map<string, VariableDeclaration> | null = null;
  const blockParent = scope.getParent();
  if (Node.isSourceFile(scope) || (blockParent && isCallableScope(blockParent))) {
    const hoisted = new Map<string, VariableDeclaration>();
    scope.forEachDescendant((desc, traversal) => {
      if (isCallableScope(desc) || Node.isClassDeclaration(desc) || Node.isClassExpression(desc)) {
        traversal.skip();
        return;
      }
      if (
        Node.isVariableDeclaration(desc) &&
        desc.getParentIfKind(SyntaxKind.VariableDeclarationList)?.getDeclarationKind() === VariableDeclarationKind.Var
      ) {
        addBindingDeclNames(desc, (name) => { if (!hoisted.has(name)) hoisted.set(name, desc); });
      }
    });
    hoistedVarsByName = hoisted;
  }

  let importsByName: Map<string, ResolvedImport> | null = null;
  let importEqualsNames: Set<string> | null = null;
  if (Node.isSourceFile(scope)) {
    const imports = new Map<string, ResolvedImport>();
    for (const declaration of scope.getImportDeclarations()) {
      const defName = declaration.getDefaultImport()?.getText();
      if (defName && !imports.has(defName)) imports.set(defName, { declaration, importedName: 'default' });
      const nsName = declaration.getNamespaceImport()?.getText();
      if (nsName && !imports.has(nsName)) imports.set(nsName, { declaration, importedName: '*' });
      for (const named of declaration.getNamedImports()) {
        const boundName = named.getAliasNode()?.getText() ?? named.getName();
        if (!imports.has(boundName)) imports.set(boundName, { declaration, importedName: named.getName() });
      }
    }
    const importEq = new Set<string>();
    for (const stmt of scope.getStatements()) {
      if (Node.isImportEqualsDeclaration(stmt) && !stmt.isTypeOnly()) importEq.add(stmt.getName());
    }
    importsByName = imports;
    importEqualsNames = importEq;
  }

  const index: ScopeBindingIndex = { sourceText, varsByName, functionsByName, typeOrClassNames, hoistedVarsByName, importsByName, importEqualsNames };
  scopeBindingCache.set(scope, index);
  return index;
}

export function findImportBinding(sourceFile: SourceFile, localName: string): ResolvedImport | null {
  return getScopeBindingIndex(sourceFile).importsByName?.get(localName) ?? null;
}

export type LexicalBinding =
  | { readonly kind: 'variable'; readonly node: VariableDeclaration }
  | { readonly kind: 'function'; readonly node: FunctionDeclaration }
  | { readonly kind: 'parameter'; readonly node: ParameterDeclaration }
  | { readonly kind: 'import'; readonly importBinding: ResolvedImport }
  | { readonly kind: 'other' };

/**
 * Walks enclosing lexical scopes from `startNode` up to `SourceFile` and returns
 * the innermost binding for `name` (or `null` if `name` is unbound / global).
 */
export function resolveLexicalBinding(
  startNode: Node,
  name: string,
  beforePos?: number,
): LexicalBinding | null {
  for (let current = startNode.getParent(); current; current = current.getParent()) {
    if (isCallableScope(current)) {
      const param = current.getParameters().find((p) => hasBindingName(p, name));
      if (param) return { kind: 'parameter', node: param };
      if ((Node.isFunctionDeclaration(current) || Node.isFunctionExpression(current)) && current.getName() === name) {
        return Node.isFunctionDeclaration(current) ? { kind: 'function', node: current } : { kind: 'other' };
      }
    }
    if (Node.isCatchClause(current)) {
      const catchVar = current.getVariableDeclaration();
      if (catchVar && hasBindingName(catchVar, name)) return { kind: 'variable', node: catchVar };
    }
    if (Node.isForStatement(current) || Node.isForOfStatement(current) || Node.isForInStatement(current)) {
      const init = current.getInitializer();
      const loopDecl = init && Node.isVariableDeclarationList(init)
        ? init.getDeclarations().find((d) => hasBindingName(d, name))
        : undefined;
      if (loopDecl) {
        return beforePos !== undefined && loopDecl.getStart() >= beforePos ? { kind: 'other' } : { kind: 'variable', node: loopDecl };
      }
    }
    if (Node.isBlock(current) || Node.isSourceFile(current)) {
      const idx = getScopeBindingIndex(current);
      const decl = idx.varsByName.get(name)?.find((d) => beforePos === undefined || d.getStart() < beforePos);
      if (decl) return { kind: 'variable', node: decl };
      const func = idx.functionsByName.get(name);
      if (func) return { kind: 'function', node: func };
      if (idx.typeOrClassNames.has(name)) return { kind: 'other' };
      const hoistedVar = idx.hoistedVarsByName?.get(name);
      if (hoistedVar) {
        return beforePos !== undefined && hoistedVar.getStart() >= beforePos ? { kind: 'other' } : { kind: 'variable', node: hoistedVar };
      }
      const importBinding = idx.importsByName?.get(name);
      if (importBinding) return { kind: 'import', importBinding };
      if (idx.importEqualsNames?.has(name)) return { kind: 'other' };
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

  const member = getMemberAccess(unwrapped);
  if (member?.name === globalName) {
    const rootExpr = unwrapExpression(member.expression);
    if (Node.isIdentifier(rootExpr)) {
      const rootName = rootExpr.getText();
      return GLOBAL_ROOT_IDENTIFIERS.has(rootName) && isUnshadowedGlobal(rootExpr, rootName);
    }
  }

  return false;
}

const NEGATIVE_COMPARISON_VALUES = new Set(['undefined', 'null', 'false']);

/**
 * Checks equality comparisons like `typeof Feature === 'undefined'`, `typeof Feature === 'function'`, or `Feature == null`.
 */
function checkBinaryComparisonPolarity(expr: BinaryExpression): 'positive' | 'negative' | null {
  const op = expr.getOperatorToken().getKind();
  const isEq = op === SyntaxKind.EqualsEqualsToken || op === SyntaxKind.EqualsEqualsEqualsToken;
  const isNeq =
    op === SyntaxKind.ExclamationEqualsToken || op === SyntaxKind.ExclamationEqualsEqualsToken;
  if (!isEq && !isNeq) return null;

  const left = unwrapExpression(expr.getLeft());
  const right = unwrapExpression(expr.getRight());
  const rightStr = getStaticStringValue(right);
  const leftStr = getStaticStringValue(left);
  if (
    (Node.isTypeOfExpression(left) && rightStr === 'function') ||
    (Node.isTypeOfExpression(right) && leftStr === 'function')
  ) {
    return isEq ? 'positive' : 'negative';
  }
  if (
    NEGATIVE_COMPARISON_VALUES.has(right.getText()) ||
    NEGATIVE_COMPARISON_VALUES.has(left.getText()) ||
    rightStr === 'undefined' ||
    leftStr === 'undefined'
  ) {
    return isEq ? 'negative' : 'positive';
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

function matchesTokenExact(name: string | null | undefined, featureTokens: readonly string[]): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return featureTokens.some((token) => token.toLowerCase() === lower);
}

function matchesTokenNameOrSubstring(name: string | null | undefined, featureTokens: readonly string[]): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return featureTokens.some((token) => {
    const tokenLower = token.toLowerCase();
    return lower === tokenLower || lower.includes(tokenLower);
  });
}

function getRootExpression(node: Node): Node {
  let root = unwrapExpression(node);
  for (let inner = getMemberAccess(root); inner; inner = getMemberAccess(root)) {
    root = unwrapExpression(inner.expression);
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
  const callInfo = unwrapMethodCall(node);
  if (!callInfo) return null;
  const { methodName, receiver, args } = callInfo;
  const [first, second] = args;
  if (
    ((methodName === 'hasOwn' && isGlobalReference(receiver, 'Object')) ||
      (methodName === 'has' && isGlobalReference(receiver, 'Reflect'))) &&
    first &&
    second
  ) {
    return { target: first, prop: second };
  }
  if (methodName === 'hasOwnProperty' && first && !second) {
    return { target: receiver, prop: first };
  }
  if (methodName === 'call' && first && second) {
    const target = unwrapExpression(receiver);
    if (
      (Node.isIdentifier(target) && target.getText() === 'hasOwnProperty') ||
      getMemberAccess(target)?.name === 'hasOwnProperty'
    ) {
      return { target: first, prop: second };
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
    if (seen.has(unwrapped)) return false;
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

  const callInfo = unwrapMethodCall(unwrapped);
  if (callInfo) {
    const { methodName, receiver } = callInfo;
    if (methodName === 'supports' && isGlobalReference(receiver, 'CSS')) {
      const argsText = callInfo.args.map((a) => a.getText()).join(' ');
      return (
        matchesTokenNameOrSubstring(argsText, featureTokens) ||
        featureTokens.some((t) => t.toLowerCase() === 'css.supports')
      );
    }
    return false;
  }

  const member = getMemberAccess(unwrapped);
  if (member) {
    if (matchesTokenNameOrSubstring(member.name, featureTokens)) {
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
    if (seen.has(unwrapped)) return null;
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
  if (Node.isReturnStatement(stmt) || Node.isThrowStatement(stmt) || Node.isBreakStatement(stmt)) return true;
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

function isGuardedByCallableEarlyReturn(callable: Node, featureTokens: readonly string[]): boolean {
  if (!isCallableScope(callable)) return false;
  const body = callable.getBody();
  return Boolean(body && Node.isBlock(body) && hasPositiveEarlyReturn(body.getStatements(), featureTokens));
}

interface SourceFileTokenCacheEntry {
  readonly text: string;
  readonly tokensLower: Map<string, boolean>;
}
const sourceFileTokenCache = new WeakMap<SourceFile, SourceFileTokenCacheEntry>();

function sourceFileContainsAnyToken(sf: SourceFile, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false;
  const sfText = sf.getFullText();
  let entry = sourceFileTokenCache.get(sf);
  if (!entry || entry.text !== sfText) {
    entry = { text: sfText, tokensLower: new Map() };
    sourceFileTokenCache.set(sf, entry);
  }
  let sfTextLower: string | undefined;
  for (const token of tokens) {
    const tokenLower = token.toLowerCase();
    let hasToken = entry.tokensLower.get(tokenLower);
    if (hasToken === undefined) {
      sfTextLower ??= sfText.toLowerCase();
      hasToken = sfTextLower.includes(tokenLower);
      entry.tokensLower.set(tokenLower, hasToken);
    }
    if (hasToken) return true;
  }
  return false;
}

function isPolyfillTarget(expr: Node): boolean {
  let root = unwrapExpression(expr);
  while (true) {
    const inner = getMemberAccess(root);
    if (!inner) break;
    root = unwrapExpression(inner.expression);
  }
  return Node.isIdentifier(root) && isUnshadowedGlobal(root, root.getText());
}

function isPolyfillDefinition(parent: Node, current: Node, tokens: readonly string[]): boolean {
  const assign = getAssignment(parent);
  if (assign?.right === current) {
    const member = getMemberAccess(assign.left);
    if (member && tokens.includes(member.name) && isPolyfillTarget(member.expression)) {
      return true;
    }
  }
  const defineProp = unwrapMethodCall(parent, { methodName: 'defineProperty' });
  if (
    defineProp &&
    isGlobalReference(defineProp.receiver, 'Object') &&
    defineProp.args[0] &&
    isPolyfillTarget(defineProp.args[0]) &&
    tokens.includes(getStaticStringValue(defineProp.args[1]) ?? '')
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether `node` is guarded by a branch-aware feature guard checking any of `featureTokens`.
 * Recognizes positive checks guarding `else` branches, negative checks guarding `then` branches,
 * ternary conditions, fallback logical RHS (`hasFeature || fallback`), and early returns.
 */
export function isProtectedByFeatureGuard(node: Node, featureTokens: readonly string[]): boolean {
  if (!sourceFileContainsAnyToken(node.getSourceFile(), featureTokens)) return false;

  const candidateCallables = Node.isCallExpression(node)
    ? node.getArguments()
    : Node.isBinaryExpression(node)
      ? [node.getRight()]
      : [];
  if (candidateCallables.some((arg) => isGuardedByCallableEarlyReturn(resolveCallableNode(arg), featureTokens))) {
    return true;
  }

  for (let current: Node = node, parent = current.getParent(); parent; current = parent, parent = current.getParent()) {
    if (Node.isIfStatement(parent) || Node.isConditionalExpression(parent)) {
      const [whenTrue, whenFalse, cond] = Node.isIfStatement(parent)
        ? [parent.getThenStatement(), parent.getElseStatement(), parent.getExpression()]
        : [parent.getWhenTrue(), parent.getWhenFalse(), parent.getCondition()];
      const expected = current === whenFalse ? 'positive' : current === whenTrue ? 'negative' : null;
      if (expected && conditionCheckPolarity(cond, featureTokens) === expected) return true;
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
    if (isPolyfillDefinition(parent, current, featureTokens)) {
      return true;
    }
  }
  return false;
}

const JQUERY_EVENT_SHORTHANDS: ReadonlySet<string> = new Set(['scroll', 'keydown', 'keyup', 'focus', 'blur']);

export interface MatchedEventListener {
  readonly eventName: string;
  readonly handlerNode: Node;
  readonly targetNode: Node | undefined;
}

export function getStaticStringValue(node: Node | undefined): string | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  return Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)
    ? unwrapped.getLiteralText()
    : null;
}
export const getStaticString = getStaticStringValue;

export function getStaticNumber(node: Node | undefined): number | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  if (Node.isNumericLiteral(unwrapped)) return unwrapped.getLiteralValue();
  if (Node.isPrefixUnaryExpression(unwrapped)) {
    const op = unwrapped.getOperatorToken();
    if (op !== SyntaxKind.MinusToken && op !== SyntaxKind.PlusToken) return null;
    const inner = getStaticNumber(unwrapped.getOperand());
    if (inner === null) return null;
    return op === SyntaxKind.MinusToken ? (inner === 0 ? 0 : -inner) : inner;
  }
  return null;
}

function extractAccessName(access: PropertyAccessExpression | ElementAccessExpression): string | null {
  return Node.isPropertyAccessExpression(access)
    ? access.getName()
    : getStaticStringValue(access.getArgumentExpression());
}

export function unwrapPropertyAccess(
  node: Node | undefined,
  name?: string,
): PropertyAccessExpression | ElementAccessExpression | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  if (!Node.isPropertyAccessExpression(unwrapped) && !Node.isElementAccessExpression(unwrapped)) {
    return null;
  }
  const propName = extractAccessName(unwrapped);
  return propName !== null && (name === undefined || propName === name) ? unwrapped : null;
}

export function getMemberAccess(
  node: Node | undefined,
): { readonly expression: Node; readonly name: string; readonly optional: boolean } | null {
  const access = unwrapPropertyAccess(node);
  const name = access ? extractAccessName(access) : null;
  return access && name !== null
    ? { expression: access.getExpression(), name, optional: access.hasQuestionDotToken() }
    : null;
}

export interface UnwrapMethodCallOptions {
  readonly methodName?: string | ReadonlySet<string>;
  readonly arity?: number | { readonly min?: number; readonly max?: number };
}

export interface UnwrappedMethodCall {
  readonly call: CallExpression;
  readonly callee: PropertyAccessExpression | ElementAccessExpression;
  readonly receiver: Node;
  readonly methodName: string;
  readonly args: Node[];
}

export function unwrapMethodCall(
  node: Node | undefined,
  options?: UnwrapMethodCallOptions,
): UnwrappedMethodCall | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  if (!Node.isCallExpression(unwrapped)) return null;
  const callee = unwrapPropertyAccess(unwrapped.getExpression());
  const methodName = callee ? extractAccessName(callee) : null;
  if (!callee || methodName === null) return null;
  const expected = options?.methodName;
  if (typeof expected === 'string' && methodName !== expected) return null;
  if (typeof expected === 'object' && expected !== null && !expected.has(methodName)) return null;
  const args = unwrapped.getArguments();
  const arity = options?.arity;
  if (typeof arity === 'number' && args.length !== arity) return null;
  if (typeof arity === 'object' && arity !== null) {
    if ((arity.min !== undefined && args.length < arity.min) || (arity.max !== undefined && args.length > arity.max)) {
      return null;
    }
  }
  return { call: unwrapped, callee, receiver: callee.getExpression(), methodName, args };
}

export function getSingleArgument(call: CallExpression): Node | null {
  const [first, second] = call.getArguments();
  return first && !second && !Node.isSpreadElement(first) ? first : null;
}

export function getAssignment(node: Node | undefined): {
  readonly binary: BinaryExpression;
  readonly left: Node;
  readonly right: Node;
  readonly operator: SyntaxKind;
} | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  if (!Node.isBinaryExpression(unwrapped)) return null;
  const operator = unwrapped.getOperatorToken().getKind();
  if (operator < SyntaxKind.FirstAssignment || operator > SyntaxKind.LastAssignment) return null;
  return { binary: unwrapped, left: unwrapped.getLeft(), right: unwrapped.getRight(), operator };
}

export function getAssignedTarget(expr: Node): Node | null {
  const { outer, parent } = getSemanticParent(expr);
  if (Node.isVariableDeclaration(parent) && parent.getInitializer() === outer) {
    return parent.getNameNode();
  }
  const assign = getAssignment(parent);
  if (
    assign?.right === outer &&
    (assign.operator === SyntaxKind.EqualsToken ||
      assign.operator === SyntaxKind.QuestionQuestionEqualsToken ||
      assign.operator === SyntaxKind.BarBarEqualsToken ||
      assign.operator === SyntaxKind.AmpersandAmpersandEqualsToken)
  ) {
    return assign.left;
  }
  return null;
}

export function areNodesEqual(a: Node | undefined, b: Node | undefined): boolean {
  if (!a || !b) return false;
  const [ua, ub] = [unwrapExpression(a), unwrapExpression(b)];
  if (ua === ub) return true;
  if (ua.getKind() !== ub.getKind()) return false;
  const [sA, sB] = [getStaticStringValue(ua), getStaticStringValue(ub)];
  if (sA !== null || sB !== null) return sA === sB;
  if (Node.isNumericLiteral(ua) && Node.isNumericLiteral(ub)) {
    return ua.getLiteralValue() === ub.getLiteralValue();
  }
  if (Node.isPrefixUnaryExpression(ua) && Node.isPrefixUnaryExpression(ub)) {
    return ua.getOperatorToken() === ub.getOperatorToken() && areNodesEqual(ua.getOperand(), ub.getOperand());
  }
  if (Node.isPostfixUnaryExpression(ua) && Node.isPostfixUnaryExpression(ub)) {
    return ua.getOperatorToken() === ub.getOperatorToken() && areNodesEqual(ua.getOperand(), ub.getOperand());
  }
  const [cA, cB] = [ua.forEachChildAsArray(), ub.forEachChildAsArray()];
  if (cA.length !== cB.length) return false;
  return cA.length === 0 ? ua.getText() === ub.getText() : cA.every((c, i) => areNodesEqual(c, cB[i]));
}

export function isGlobalMember(node: Node, names: ReadonlySet<string> | readonly string[]): string | null {
  const unwrapped = unwrapExpression(node);
  const name = Node.isIdentifier(unwrapped)
    ? unwrapped.getText()
    : (getMemberAccess(unwrapped)?.name ?? null);
  if (!name) return null;
  const matches = 'has' in names ? names.has(name) : names.includes(name);
  return matches && isGlobalReference(unwrapped, name) ? name : null;
}

export function isIdentifierReference(id: Identifier): boolean {
  const parent = id.getParent();
  if (!parent) return false;
  if (Node.hasName(parent) && !Node.isShorthandPropertyAssignment(parent) && parent.getNameNode() === id) return false;
  if (Node.isBindingElement(parent) && parent.getPropertyNameNode() === id) return false;
  if (Node.isImportClause(parent)) return false;
  if (Node.isJsxAttribute(parent) && parent.getNameNode() === id) return false;
  if (
    (Node.isJsxOpeningElement(parent) || Node.isJsxSelfClosingElement(parent) || Node.isJsxClosingElement(parent)) &&
    parent.getTagNameNode() === id &&
    /^[a-z]/.test(id.getText())
  ) {
    return false;
  }
  if (
    (Node.isLabeledStatement(parent) || Node.isBreakStatement(parent) || Node.isContinueStatement(parent)) &&
    parent.getLabel() === id
  ) {
    return false;
  }
  return !id.getFirstAncestor((a) => Node.isTypeNode(a) || Node.isImportDeclaration(a) || Node.isExportDeclaration(a));
}

export function resolvesToBinding(id: Identifier, declNode: Node): boolean {
  if (!isIdentifierReference(id)) return false;
  let declName: string | null = null;
  if (
    Node.isVariableDeclaration(declNode) ||
    Node.isParameterDeclaration(declNode) ||
    Node.isFunctionDeclaration(declNode) ||
    Node.isBindingElement(declNode)
  ) {
    const nameNode = declNode.getNameNode();
    declName = Node.isIdentifier(nameNode) ? nameNode.getText() : null;
  } else if (Node.isIdentifier(declNode)) {
    declName = declNode.getText();
  }
  if (!declName || id.getText() !== declName) return false;
  const binding = resolveLexicalBinding(id, declName);
  if (!binding || (binding.kind !== 'variable' && binding.kind !== 'function' && binding.kind !== 'parameter')) {
    return false;
  }
  return (
    binding.node === declNode ||
    (Node.isIdentifier(declNode) && binding.node.getNameNode() === declNode) ||
    (Node.isBindingElement(declNode) &&
      declNode.getFirstAncestor((a) => Node.isVariableDeclaration(a) || Node.isParameterDeclaration(a)) === binding.node)
  );
}

/**
 * Matches native `.addEventListener('<event>', handler)`, jQuery `.on('<event>', [selector,] handler)`,
 * and jQuery shorthands (`.scroll(handler)`, `.keydown(handler)`, `.keyup(handler)`, `.focus(handler)`, `.blur(handler)`)
 * when the event name is in `eventNames`, resolving `handlerNode` via `resolveCallableNode`.
 */
export function matchEventListenerCall(node: CallExpression, eventNames: readonly string[]): MatchedEventListener | null {
  const expr = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) return null;
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
      ?.trim().split(/\s+/).map((e) => e.split('.')[0])
      .find((e): e is string => Boolean(e && eventNames.includes(e)));
    return matchedEvent ? { eventName: matchedEvent, handlerNode: resolveCallableNode(lastArg), targetNode } : null;
  }
  if (lastArg && JQUERY_EVENT_SHORTHANDS.has(methodName) && eventNames.includes(methodName)) {
    return { eventName: methodName, handlerNode: resolveCallableNode(lastArg), targetNode };
  }
  return null;
}

const CLASS_LIST_MUTATION_METHODS = new Set(['add', 'remove', 'toggle', 'replace']);
const DIRECT_DOM_MUTATION_METHODS = new Set([
  'setAttribute', 'removeAttribute', 'toggleAttribute', 'addClass', 'removeClass', 'toggleClass',
]);

function isDirectClassOrAttrMutation(n: Node): boolean {
  const assign = getAssignment(n);
  if (assign) {
    return (
      (assign.operator === SyntaxKind.EqualsToken || assign.operator === SyntaxKind.PlusEqualsToken) &&
      getMemberAccess(assign.left)?.name === 'className'
    );
  }
  const callInfo = unwrapMethodCall(n);
  if (!callInfo) return false;
  const { methodName, receiver, args } = callInfo;
  if (DIRECT_DOM_MUTATION_METHODS.has(methodName)) return true;
  if (CLASS_LIST_MUTATION_METHODS.has(methodName)) {
    return getMemberAccess(receiver)?.name === 'classList';
  }
  return (
    methodName === 'attr' &&
    (args.length >= 2 || (args.length === 1 && args[0] !== undefined && Node.isObjectLiteralExpression(unwrapExpression(args[0]))))
  );
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
export function getSafeModuleSpecifier(decl: ImportDeclaration | ExportDeclaration): string | null {
  const spec = decl.compilerNode.moduleSpecifier;
  return spec && ts.isStringLiteral(spec) ? spec.text : null;
}

/**
 * Returns `true` when `spec` equals one of `packages` or is a subpath import (`<pkg>/...`).
 */
export function matchesPackageSpec(spec: string | null, packages: readonly string[]): boolean {
  return spec !== null && packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`));
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
  if (!Node.isCallExpression(unwrapped)) return false;
  const callee = unwrapExpression(unwrapped.getExpression());
  const firstArg = unwrapped.getArguments()[0];
  if (Node.isIdentifier(callee) && callee.getText() === 'require' && firstArg && Node.isStringLiteral(firstArg)) {
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

function matchesExpectedPropertyName(propName: string, identName: string, allowDefaultImport: boolean): boolean {
  return propName === identName || (allowDefaultImport && propName === 'default');
}

function isRequireExportExpression(
  expr: Node, identName: string, packages: readonly string[], allowDefaultImport: boolean, requireOpts: RequirePackageOptions | undefined,
): boolean {
  if (!sourceFileContainsAnyToken(expr.getSourceFile(), packages)) return false;
  const resolved = resolveLocalExpression(expr, 2);
  if (allowDefaultImport && isRequireOfPackage(resolved, packages, requireOpts)) return true;
  return (
    Node.isPropertyAccessExpression(resolved) &&
    matchesExpectedPropertyName(resolved.getName(), identName, allowDefaultImport) &&
    isRequireOfPackage(resolveLocalExpression(resolved.getExpression(), 2), packages, requireOpts)
  );
}

function matchesRequireVariableDeclaration(
  decl: VariableDeclaration, localName: string, identName: string, packages: readonly string[],
  allowDefaultImport: boolean, requireOpts: RequirePackageOptions | undefined,
): boolean {
  const nameNode = decl.getNameNode();
  const init = decl.getInitializer();
  if (!init) return false;
  if (Node.isIdentifier(nameNode)) return isRequireExportExpression(init, identName, packages, allowDefaultImport, requireOpts);
  if (Node.isObjectBindingPattern(nameNode)) {
    const el = nameNode.getElements().find((e) => e.getName() === localName);
    if (!el) return false;
    const propName = el.getPropertyNameNode()?.getText() ?? el.getName();
    return matchesExpectedPropertyName(propName, identName, allowDefaultImport) && isRequireOfPackage(resolveLocalExpression(init, 2), packages, requireOpts);
  }
  return false;
}

/**
 * Checks whether `node` refers to library export `identName` from one of `packages`
 * via ESM `import` (default, namespace, named, or aliased), CommonJS `require()`
 * (direct, property access, or destructured), or an unshadowed UMD browser global.
 */
export function isLibraryReference(
  node: Node, identName: string, packages: readonly string[], options?: LibraryReferenceOptions,
): boolean {
  const sf = node.getSourceFile();
  const tokenCandidates = options?.globalNamespaces ? [identName, ...packages, ...options.globalNamespaces] : [identName, ...packages];
  if (!sourceFileContainsAnyToken(sf, tokenCandidates)) return false;

  const allowDefaultImport = options?.allowDefaultImport ?? true;
  const allowGlobal = options?.allowGlobal ?? true;
  const unwrapped = unwrapExpression(node);

  if (Node.isIdentifier(unwrapped)) {
    const localName = unwrapped.getText();
    if (localName !== identName && !sourceFileContainsAnyToken(sf, packages)) return false;
    const binding = resolveLexicalBinding(unwrapped, localName);
    if (!binding) return allowGlobal && localName === identName;
    if (binding.kind === 'variable') return matchesRequireVariableDeclaration(binding.node, localName, identName, packages, allowDefaultImport, options);
    if (binding.kind === 'import') {
      const { declaration, importedName } = binding.importBinding;
      if (!matchesPackageSpec(getSafeModuleSpecifier(declaration), packages)) return false;
      return importedName === '*' ? allowDefaultImport : matchesExpectedPropertyName(importedName, identName, allowDefaultImport);
    }
    return false;
  }

  if (isRequireExportExpression(unwrapped, identName, packages, allowDefaultImport, options)) return true;

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
