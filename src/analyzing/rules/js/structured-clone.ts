import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import {
  getMemberAccess,
  getSingleArgument,
  getStaticString,
  isCallableNode,
  isGlobalMember,
  isGlobalReference,
  resolveCallableNode,
  resolveLocalExpression,
  unwrapExpression,
  unwrapMethodCall,
} from '../../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export { JS_GUIDE_HASH };

const NON_CLONEABLE_GLOBALS = new Set([
  'localStorage',
  'sessionStorage',
  'location',
  'navigator',
  'document',
  'window',
  'history',
  'performance',
  'crypto',
  'caches',
  'indexedDB',
  'Symbol',
]);
const NON_CLONEABLE_CHAIN_PROPERTIES = new Set([
  '$store',
  '$state',
  'dataset',
  'classList',
  'childNodes',
  'shadowRoot',
  'ownerDocument',
  'contentDocument',
  'contentWindow',
  'firstElementChild',
  'lastElementChild',
  'previousElementSibling',
  'nextElementSibling',
]);
const NON_CLONEABLE_CONSTRUCTORS = new Set([
  'Promise',
  'WeakMap',
  'WeakSet',
  'Proxy',
  'URLSearchParams',
  'FormData',
  'Headers',
  'Event',
  'CustomEvent',
  'MessageEvent',
  'ErrorEvent',
  'EventTarget',
  'XMLHttpRequest',
  'Request',
  'Response',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'MessageChannel',
  'BroadcastChannel',
  'AbortController',
  'AbortSignal',
  'MutationObserver',
  'ResizeObserver',
  'IntersectionObserver',
]);
const NON_CLONEABLE_STATIC_CALLS: Record<string, ReadonlySet<string>> = {
  Promise: new Set(['resolve', 'reject', 'all', 'race', 'any', 'allSettled']),
  Symbol: new Set(['for']),
  Proxy: new Set(['revocable']),
  Vue: new Set(['observable']),
  AbortSignal: new Set(['abort', 'timeout', 'any']),
  document: new Set([
    'createElement',
    'createElementNS',
    'createTextNode',
    'createDocumentFragment',
    'getElementById',
    'querySelector',
    'querySelectorAll',
    'getElementsByClassName',
    'getElementsByTagName',
    'getElementsByName',
  ]),
};
const REACTIVE_CALLS = new Set([
  'reactive',
  'shallowReactive',
  'readonly',
  'shallowReadonly',
  'defineProps',
  'withDefaults',
  'defineModel',
  'observable',
  'makeAutoObservable',
  'makeObservable',
]);
const REF_CALLS = new Set(['ref', 'shallowRef', 'computed']);
const SANITIZE_UNDEFINED_NAME_RE = /(?:clean|strip|omit|prune|remove).*undefined|sanitizeJson/i;

function hasSanitizeUndefinedAncestor(node: Node): boolean {
  return Boolean(
    node.getFirstAncestor((ancestor) => {
      let name: string | undefined;
      if (Node.isVariableDeclaration(ancestor)) {
        const nameNode = ancestor.getNameNode();
        name = Node.isIdentifier(nameNode) ? nameNode.getText() : undefined;
      } else if (Node.isFunctionDeclaration(ancestor) || Node.isMethodDeclaration(ancestor)) {
        name = ancestor.getName();
      } else if (Node.isPropertyAssignment(ancestor)) {
        name = getStaticString(ancestor.getNameNode()) ?? ancestor.getName();
      }
      return Boolean(name && SANITIZE_UNDEFINED_NAME_RE.test(name));
    }),
  );
}

function isPostMessageCall(node: CallExpression): boolean {
  const callee = unwrapExpression(node.getExpression());
  if (Node.isIdentifier(callee)) return callee.getText() === 'postMessage';
  return getMemberAccess(callee)?.name === 'postMessage';
}

function hasSubsequentPostMessage(node: Node, sourceFile: SourceFile): boolean {
  if (!sourceFile.getFullText().includes('postMessage')) return false;
  if (node.getFirstAncestor((ancestor) => Node.isCallExpression(ancestor) && isPostMessageCall(ancestor))) {
    return true;
  }
  const enclosingFn = node.getFirstAncestor(isCallableNode);
  const scope = enclosingFn ?? sourceFile;
  const nodeEnd = node.getEnd();

  return scope.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    if (call === node || !isPostMessageCall(call)) return false;
    if (call.getFirstAncestor(isCallableNode) !== enclosingFn) return false;
    return call.getStart() >= nodeEnd;
  });
}

function unwrapSingleJsonArg(node: Node, methodName: 'parse' | 'stringify'): Node | null {
  const method = unwrapMethodCall(node, { methodName });
  if (
    !method ||
    !Node.isPropertyAccessExpression(method.callee) ||
    method.callee.hasQuestionDotToken() ||
    !isGlobalReference(method.receiver, 'JSON')
  ) {
    return null;
  }
  const arg = getSingleArgument(method.call);
  return arg ? unwrapExpression(arg) : null;
}

function isTrivialPrimitive(node: Node): boolean {
  const expr = unwrapExpression(node);
  if (
    Node.isLiteralExpression(expr) ||
    Node.isTrueLiteral(expr) ||
    Node.isFalseLiteral(expr) ||
    Node.isNullLiteral(expr) ||
    Node.isTemplateExpression(expr) ||
    Node.isTypeOfExpression(expr) ||
    Node.isPrefixUnaryExpression(expr) ||
    (Node.isIdentifier(expr) && expr.getText() === 'undefined')
  ) {
    return true;
  }
  if (!Node.isBinaryExpression(expr)) return false;
  const op = expr.getOperatorToken().getKind();
  if (
    op === SyntaxKind.QuestionQuestionEqualsToken ||
    op === SyntaxKind.BarBarEqualsToken ||
    op === SyntaxKind.AmpersandAmpersandEqualsToken
  ) {
    return false;
  }
  if (
    op === SyntaxKind.AmpersandAmpersandToken ||
    op === SyntaxKind.BarBarToken ||
    op === SyntaxKind.QuestionQuestionToken
  ) {
    return isTrivialPrimitive(expr.getLeft()) && isTrivialPrimitive(expr.getRight());
  }
  if (op === SyntaxKind.CommaToken || op === SyntaxKind.EqualsToken) {
    return isTrivialPrimitive(expr.getRight());
  }
  return true;
}

function isLocalCallOf(node: Node, callNames: ReadonlySet<string>): boolean {
  const base = resolveLocalExpression(node, 2);
  const callee = Node.isCallExpression(base) ? unwrapExpression(base.getExpression()) : null;
  return Boolean(callee && Node.isIdentifier(callee) && callNames.has(callee.getText()));
}

function hasNonCloneableChain(expr: Node, isVueOptionsApi: boolean): boolean {
  let current = expr;
  while (Node.isPropertyAccessExpression(current) || Node.isElementAccessExpression(current)) {
    if (isGlobalReference(current, 'document') || isGlobalReference(current, 'Symbol')) {
      return true;
    }
    if (Node.isPropertyAccessExpression(current)) {
      const propName = current.getName();
      if (
        NON_CLONEABLE_CHAIN_PROPERTIES.has(propName) ||
        (propName === 'value' && isLocalCallOf(current.getExpression(), REF_CALLS))
      ) {
        return true;
      }
    }
    current = unwrapExpression(current.getExpression());
  }

  return (
    current !== expr &&
    (isGlobalReference(current, 'document') ||
      isGlobalReference(current, 'Symbol') ||
      (isVueOptionsApi && Node.isThisExpression(current)) ||
      isLocalCallOf(current, REACTIVE_CALLS))
  );
}

function isNonCloneable(node: Node, isVueOptionsApi = false, allowResolve = true): boolean {
  const expr = unwrapExpression(node);
  if (
    Node.isFunctionDeclaration(expr) ||
    Node.isFunctionExpression(expr) ||
    Node.isArrowFunction(expr) ||
    Node.isClassExpression(expr) ||
    (Node.isIdentifier(expr) && expr.getText() === 'undefined') ||
    (isVueOptionsApi && Node.isThisExpression(expr)) ||
    isGlobalMember(expr, NON_CLONEABLE_GLOBALS) !== null ||
    hasNonCloneableChain(expr, isVueOptionsApi)
  ) {
    return true;
  }

  if (allowResolve && Node.isIdentifier(expr)) {
    const resolved = resolveCallableNode(expr, 2);
    return resolved !== expr && isNonCloneable(resolved, isVueOptionsApi, false);
  }

  if (Node.isNewExpression(expr)) {
    const ctor = unwrapExpression(expr.getExpression());
    if (isGlobalMember(ctor, NON_CLONEABLE_CONSTRUCTORS)) return true;
    for (let cur: Node | undefined = expr.getParent(); Node.isIdentifier(ctor) && cur; cur = cur.getParent()) {
      const cls =
        Node.isBlock(cur) || Node.isSourceFile(cur) ? cur.getClass(ctor.getText()) : undefined;
      if (cls) return Boolean(cls.getInstanceMember('toJSON'));
    }
    return false;
  }

  if (Node.isCallExpression(expr)) {
    const callee = unwrapExpression(expr.getExpression());
    if (
      isGlobalReference(callee, 'Symbol') ||
      isGlobalReference(callee, 'Proxy') ||
      (Node.isIdentifier(callee) && REACTIVE_CALLS.has(callee.getText()))
    ) {
      return true;
    }
    if (!Node.isPropertyAccessExpression(callee)) return false;
    const methodName = callee.getName();
    return Object.entries(NON_CLONEABLE_STATIC_CALLS).some(
      ([obj, methods]) => methods.has(methodName) && isGlobalReference(callee.getExpression(), obj),
    );
  }

  if (Node.isObjectLiteralExpression(expr)) {
    return expr.getProperties().some((prop) => {
      if (Node.isMethodDeclaration(prop)) return true;
      if (!Node.isSpreadAssignment(prop)) {
        const nameText = getStaticString(prop.getNameNode()) ?? prop.getName();
        if (nameText === 'toJSON') return true;
      }
      const val = Node.isShorthandPropertyAssignment(prop)
        ? prop.getNameNode()
        : Node.isPropertyAssignment(prop)
          ? prop.getInitializer()
          : undefined;
      return Boolean(val && isNonCloneable(val, isVueOptionsApi));
    });
  }

  return (
    Node.isArrayLiteralExpression(expr) &&
    expr.getElements().some((el) => isNonCloneable(el, isVueOptionsApi))
  );
}

export const structuredCloneMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [['JSON.parse'], ['JSON.stringify']],
  featureGuardTokens: ['structuredClone'],
  dedupeLines: true,
  matchCall(node, sourceFile, ctx) {
    const inner = unwrapSingleJsonArg(node, 'parse');
    const clonedExpr = inner ? unwrapSingleJsonArg(inner, 'stringify') : null;
    if (!clonedExpr || isTrivialPrimitive(clonedExpr)) return null;
    if (Node.isNewExpression(clonedExpr) && isGlobalReference(clonedExpr.getExpression(), 'Date')) {
      return null;
    }
    if (hasSanitizeUndefinedAncestor(node) || hasSubsequentPostMessage(node, sourceFile)) {
      return null;
    }
    const isVueOptionsApi =
      /\.vue(?:\.block\d+)?(?:\.[cm]?[jt]sx?)?$/i.test(ctx.filePath) &&
      sourceFile.getExportAssignment(() => true) !== undefined;
    return isNonCloneable(clonedExpr, isVueOptionsApi)
      ? null
      : 'JSON.parse(JSON.stringify(...)) deep-copy workaround can be replaced with native structuredClone().';
  },
});

export const structuredCloneRule: AnalyzerRule = {
  id: 'js/structured-clone',
  guideId: 'js',
  guideHash: JS_GUIDE_HASH,
  summary: 'Replace JSON.parse(JSON.stringify(x)) deep-copy workarounds with structuredClone(x).',
  matcher: structuredCloneMatcher,
  verifierRubric: {
    keepWhen: ['JSON.parse(JSON.stringify(x)) is used to create an independent deep copy of plain objects, arrays, or plain data records so mutating or detaching the clone does not affect the original value, when the snippet shows no evidence of reactive Proxy wrappers, .toJSON() hooks, replacer/reviver arguments, non-cloneable values, or intentional JSON normalization.'],
    dropWhen: [
      'The snippet shows direct evidence that the cloned value is a Proxy wrapper or framework reactive state (such as new Proxy(...), Vue reactive(), ref().value, defineProps(), Vuex/Pinia $store/$state, MobX observable, or a local visibly assigned from component state) passed without unwrapping (for example toRaw()), where structuredClone() throws DataCloneError. Do not drop plain local objects, array copies, or function parameters solely because the file is a .vue component.',
      'The input defines an own enumerable .toJSON() method (which makes structuredClone() throw DataCloneError) or an inherited/non-enumerable .toJSON() hook (which JSON.stringify invokes but structuredClone() silently ignores), or the call uses custom JSON.stringify replacer / JSON.parse reviver arguments.',
      'The code explicitly relies on JSON serialization normalization rather than deep copying: serializing Date instances to ISO strings (date.toISOString()), explicitly stripping undefined keys or array slots, coercing NaN, ±Infinity, -0, or sparse array holes to null/0, or breaking shared internal object references into separate object identities.',
      'The clone mirrors a payload that is immediately serialized with JSON.stringify for a wire protocol and relies on dropping undefined keys, or is passed directly to postMessage(JSON.parse(JSON.stringify(x))) where postMessage already performs structured cloning.',
      'Surrounding code or types show the cloned value contains functions/callbacks, Symbol values, Promise, WeakMap, WeakSet, DOM Node instances, non-serializable platform objects/DOM properties (Storage/localStorage, element.dataset, element.style, element.children, element.attributes, Location, URLSearchParams, FormData, Headers, Event, AbortSignal/AbortController), streams (ReadableStream, WritableStream, TransformStream), DOM observers (MutationObserver, ResizeObserver, IntersectionObserver), or messaging ports and channels (MessagePort, MessageChannel, BroadcastChannel), where structuredClone() throws DataCloneError.',
      'The cloned value is an imported library object or singleton that may carry own enumerable methods (which JSON.stringify strips into plain data whereas structuredClone() throws DataCloneError).',
      'The code runs inside an isolated VM sandbox or test runner (such as a node:vm createContext realm or sandboxed plugin context) whose global object exposes only ECMAScript intrinsics, or visible project configuration declares engines.node < 17, a TypeScript lib without DOM or @types/node, or ESLint no-undef globals that omit structuredClone.',
      'The expression appears inside a test assertion or mock expectation verifying JSON-serialized shapes.',
    ],
  },
};

export default [structuredCloneRule] satisfies readonly AnalyzerRule[];
