import { Node, SyntaxKind, VariableDeclarationKind } from 'ts-morph';
import {
  getAssignment,
  getMemberAccess,
  getStaticString,
  isGlobalReference,
  resolveLexicalBinding,
  unwrapExpression,
} from '../../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export { JS_GUIDE_HASH };

const SIDE_EFFECT_KINDS = new Set([
  SyntaxKind.CallExpression,
  SyntaxKind.NewExpression,
  SyntaxKind.AwaitExpression,
  SyntaxKind.YieldExpression,
]);
const MUTABLE_VAR_KINDS = new Set([VariableDeclarationKind.Let, VariableDeclarationKind.Var]);
const GLOBAL_ROOTS = new Set(['window', 'document', 'self', 'globalThis']);
const POLYFILL_NAME_RE = /^(?:withResolvers|polyfill.*withResolvers)$/i;

function isOuterTarget(lhs: Node, exec: Node, localNames: ReadonlySet<string>): boolean {
  if (Node.isIdentifier(lhs)) {
    const name = lhs.getText();
    if (localNames.has(name)) return false;

    const searchStart = exec.getParent() ?? exec;
    const binding = resolveLexicalBinding(searchStart, name);
    if (!binding) return true;
    if (binding.kind === 'parameter') return true;
    if (binding.kind !== 'variable') return false;

    const declParent = binding.node.getParent();
    if (Node.isCatchClause(declParent)) return true;
    if (Node.isVariableDeclarationList(declParent)) {
      return MUTABLE_VAR_KINDS.has(declParent.getDeclarationKind());
    }
    return false;
  }

  const access = unwrapExpression(lhs);
  if (!Node.isPropertyAccessExpression(access) && !Node.isElementAccessExpression(access)) {
    return false;
  }
  if (access.getDescendants().some((desc) => SIDE_EFFECT_KINDS.has(desc.getKind()))) {
    return false;
  }

  const propName = Node.isPropertyAccessExpression(access)
    ? access.getName()
    : (getStaticString(access.getArgumentExpression()) ?? '');
  if (/^on[A-Za-z]/.test(propName)) return false;

  let root = unwrapExpression(access.getExpression());
  while (Node.isPropertyAccessExpression(root) || Node.isElementAccessExpression(root)) {
    root = unwrapExpression(root.getExpression());
  }
  if (Node.isIdentifier(root) && (GLOBAL_ROOTS.has(root.getText()) || localNames.has(root.getText()))) {
    return false;
  }
  return true;
}

function flattenCommaExprs(expr: Node): Node[] {
  const inner = unwrapExpression(expr);
  if (!Node.isBinaryExpression(inner) || inner.getOperatorToken().getKind() !== SyntaxKind.CommaToken) {
    return [inner];
  }
  return [...flattenCommaExprs(inner.getLeft()), ...flattenCommaExprs(inner.getRight())];
}

function hasTypeofPromise(condition: Node): boolean {
  let found = false;
  condition.forEachDescendant((desc, traversal) => {
    if (!Node.isTypeOfExpression(desc)) return;
    const target = unwrapExpression(desc.getExpression());
    if (Node.isIdentifier(target) && target.getText() === 'Promise') {
      found = true;
      traversal.stop();
      return;
    }
    const member = getMemberAccess(target);
    if (member?.name === 'Promise' && Node.isIdentifier(member.expression) && GLOBAL_ROOTS.has(member.expression.getText())) {
      found = true;
      traversal.stop();
    }
  });
  return found;
}

function isWithResolversGuard(node: Node): boolean {
  for (let cur = node.getParent(); cur; cur = cur.getParent()) {
    if (Node.isWithStatement(cur)) return true;

    const condExpr = Node.isIfStatement(cur)
      ? cur.getExpression()
      : Node.isConditionalExpression(cur)
        ? cur.getCondition()
        : undefined;
    if (condExpr && hasTypeofPromise(condExpr)) return true;

    if (Node.isBinaryExpression(cur) && getMemberAccess(cur.getLeft())?.name === 'withResolvers') {
      return true;
    }
    if (Node.isCallExpression(cur) && cur.getArguments().some((arg) => getStaticString(arg) === 'withResolvers')) {
      return true;
    }
    if (Node.hasName(cur) && POLYFILL_NAME_RE.test(cur.getName())) return true;
  }
  return false;
}

export const promiseWithResolversMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [['new Promise', 'window.Promise', 'globalThis.Promise', 'self.Promise']],
  featureGuardTokens: ['withResolvers'],
  dedupeLines: true,
  maxLineLength: 500,
  isGuarded: isWithResolversGuard,
  matchNew(node) {
    const args = node.getArguments();
    if (
      args.length !== 1 ||
      Node.isSpreadElement(args[0]) ||
      node.getTypeArguments().length > 1 ||
      !isGlobalReference(node.getExpression(), 'Promise')
    ) {
      return null;
    }

    const exec = unwrapExpression(args[0]);
    if (
      (!Node.isArrowFunction(exec) && !Node.isFunctionExpression(exec)) ||
      exec.isAsync() ||
      (Node.isFunctionExpression(exec) && exec.isGenerator())
    ) {
      return null;
    }

    const params = exec.getParameters();
    if (params.length < 1 || params.length > 2) return null;
    const paramNames = new Set<string>();
    for (const param of params) {
      const nameNode = param.getNameNode();
      if (param.isRestParameter() || param.hasInitializer() || !Node.isIdentifier(nameNode)) {
        return null;
      }
      paramNames.add(nameNode.getText());
    }

    const localNames = new Set(paramNames);
    const execName = Node.isFunctionExpression(exec) ? exec.getName() : undefined;
    if (execName) localNames.add(execName);

    const body = exec.getBody();
    const rawExprs = Node.isBlock(body)
      ? body.getStatements().map((stmt) => (Node.isExpressionStatement(stmt) ? stmt.getExpression() : null))
      : flattenCommaExprs(body);
    if (rawExprs.length < 1 || rawExprs.length > 2) return null;

    const assignedParams = new Set<string>();
    for (const raw of rawExprs) {
      if (!raw) return null;
      const assignment = getAssignment(raw);
      if (!assignment || assignment.operator !== SyntaxKind.EqualsToken) return null;

      const rhs = unwrapExpression(assignment.right);
      const lhs = unwrapExpression(assignment.left);
      if (!Node.isIdentifier(rhs)) return null;
      const rhsName = rhs.getText();
      if (!paramNames.has(rhsName) || assignedParams.has(rhsName) || !isOuterTarget(lhs, exec, localNames)) {
        return null;
      }
      assignedParams.add(rhsName);
    }

    return 'Deferred new Promise() executor only assigns resolve/reject externally; replace with Promise.withResolvers().';
  },
});

export const jsPromiseWithResolversRule: AnalyzerRule = {
  id: 'js/promise-with-resolvers',
  guideId: 'js',
  guideHash: JS_GUIDE_HASH,
  summary: 'Replace deferred new Promise() executors that assign resolve/reject externally with Promise.withResolvers().',
  matcher: promiseWithResolversMatcher,
  verifierRubric: {
    keepWhen: ['new Promise((resolve[, reject]) => { ... }) is used to expose resolve and/or reject outside the promise constructor (to outer let/var bindings, object properties, class fields, or callback holders) so Promise.withResolvers() removes the boilerplate declarations and executor closure without changing runtime or TypeScript semantics.'],
    dropWhen: [
      'Visible project configuration in the snippet targets an environment before ES2024 (explicit engines.node < 22 or tsconfig lib/target without ES2024; do not infer pre-ES2024 merely from var or library filenames).',
      'There is visible evidence in the snippet that the LHS receiver inside the executor can be nullish or has a throwing setter that relies on new Promise catching synchronous executor throws (never drop ordinary this.resolve, deferred.resolve, or outer variable assignments, even inside an outer try/catch block).',
      'The new Promise constructor resolves to a custom Promise subclass, library Promise implementation (such as Bluebird or RSVP), or shadowed Promise binding, or sits inside a Promise.withResolvers polyfill/feature-guard.',
    ],
  },
};

export default [jsPromiseWithResolversRule] satisfies readonly AnalyzerRule[];
