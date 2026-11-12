import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import {
  areNodesEqual,
  getAssignment,
  getSemanticParent,
  getStaticNumber,
  getStaticString,
  isCallableNode,
  isGlobalReference,
  isUnshadowedGlobal,
  resolveCallableNode,
  unwrapExpression,
  unwrapMethodCall,
  type UnwrappedMethodCall,
} from '../../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export const JS_COPYING_ARRAY_METHODS_GUIDE_HASH = JS_GUIDE_HASH;

type ReceiverKind = 'array' | 'typed-array' | 'non-array';

const MODERN_METHODS = ['toSorted', 'toReversed', 'findLast', 'findLastIndex'];
const NON_ARRAY_TYPE = new RegExp(
  '^(?:(?:Readonly)?(?:Set|Map|NodeList(?:Of)?|HTMLCollection(?:Of)?|DOMTokenList|' +
    'NamedNodeMap|FileList|HTMLOptionsCollection|(?:Async)?Iterable(?:Iterator)?|Generator|RegExpExecArray|' +
    'IArguments)(?:<.*>)?|string)$',
  's',
);
const ELEMENT_DOM_PROPERTY = new RegExp(
  '^(?:child(?:ren|Nodes)|classList|attributes|files|tBodies|rows|cells|options|' +
    'styleSheets|selectedOptions)$',
);
const DOCUMENT_COLLECTION_PROPERTY = new RegExp(
  '^(?:scripts|forms|images|links|embeds|applets|anchors)$',
);
const DOCUMENT_RECEIVER_RE = /(?:^|D)ocument$|^doc$/;
const DOM_OR_STRING_METHOD = new RegExp(
  '^(?:querySelectorAll|getElementsBy(?:TagName(?:NS)?|ClassName|Name)|match(?:All)?|search|' +
    '(?:starts|ends)With|replace(?:All)?|trim(?:Start|End)?|to(?:Lower|Upper)Case|substr(?:ing)?|' +
    'char(?:Code|CodePoint)?At|pad(?:Start|End)|repeat)$',
);

function isDocumentReceiver(expr: Node): boolean {
  const unwrapped = unwrapExpression(expr);
  if (isGlobalReference(unwrapped, 'document')) return true;
  const name = Node.isIdentifier(unwrapped)
    ? unwrapped.getText()
    : Node.isPropertyAccessExpression(unwrapped)
      ? unwrapped.getName()
      : null;
  return Boolean(name && (name === 'document' || DOCUMENT_RECEIVER_RE.test(name)));
}

function isMutatingOrDomMethod(call: CallExpression, methodName: string): boolean {
  if (DOM_OR_STRING_METHOD.test(methodName)) return true;
  if (methodName === 'set') return call.getArguments().length === 2;
  return methodName === 'add' || methodName === 'delete' || methodName === 'clear';
}

function isBinaryKind(node: Node | undefined, ...kinds: SyntaxKind[]): node is import('ts-morph').BinaryExpression {
  return Boolean(
    node &&
      Node.isBinaryExpression(node) &&
      kinds.includes(node.getOperatorToken().getKind()),
  );
}

function unwrapStrictMethod(node: Node | undefined): UnwrappedMethodCall | null {
  const method = unwrapMethodCall(node);
  if (!method || !Node.isPropertyAccessExpression(method.callee) || method.callee.hasQuestionDotToken()) {
    return null;
  }
  return method;
}

function getBindingKey(node: Node): string | null {
  const unwrapped = unwrapExpression(node);
  if (Node.isIdentifier(unwrapped)) return unwrapped.getText();
  if (Node.isPropertyAccessExpression(unwrapped) && Node.isThisExpression(unwrapped.getExpression())) {
    return `this.${unwrapped.getName()}`;
  }
  return null;
}

function classifyTypeText(
  typeText: string | undefined,
  sourceFile?: SourceFile,
  seenAliases?: Set<string>,
): ReceiverKind {
  const stripped = typeText
    ?.replace(/^(?:\s*(?:null|undefined)\s*\|)+|(?:\s*\|\s*(?:null|undefined))+\s*$/g, '')
    .trim();
  if (!stripped || /\[\]\s*$|^\s*(?:Readonly)?Array\s*<|^\s*(?:readonly\s+)?\[/.test(stripped)) {
    return 'array';
  }
  if (NON_ARRAY_TYPE.test(stripped)) return 'non-array';
  if (/\b(?:Int|Uint|Float|BigInt|BigUint)(?:8|16|32|64)(?:Clamped)?Array\b/.test(stripped)) {
    return 'typed-array';
  }
  const aliasName = stripped.match(/^([A-Za-z_$][\w$]*)(?:\s*<.*>)?$/)?.[1];
  if (sourceFile && aliasName && !seenAliases?.has(aliasName)) {
    const aliasTypeText = sourceFile.getTypeAlias(aliasName)?.getTypeNode()?.getText();
    if (aliasTypeText) {
      const nextSeen = new Set(seenAliases);
      nextSeen.add(aliasName);
      return classifyTypeText(aliasTypeText, sourceFile, nextSeen);
    }
  }
  return 'array';
}

function classifyCallReturnType(call: CallExpression, method: UnwrappedMethodCall | null): ReceiverKind {
  const sourceFile = call.getSourceFile();
  if (method) {
    const receiver = unwrapExpression(method.receiver);
    if (Node.isThisExpression(receiver)) {
      const cls = call.getFirstAncestor(
        (ancestor) => Node.isClassDeclaration(ancestor) || Node.isClassExpression(ancestor),
      );
      if (cls) {
        const retText = cls.getMethod(method.methodName)?.getReturnTypeNode()?.getText();
        if (retText) return classifyTypeText(retText, sourceFile);
        const propInit = cls.getProperty(method.methodName)?.getInitializer();
        const unwrappedInit = propInit ? unwrapExpression(propInit) : undefined;
        if (unwrappedInit && isCallableNode(unwrappedInit)) {
          return classifyTypeText(unwrappedInit.getReturnTypeNode()?.getText(), sourceFile);
        }
      }
    } else if (Node.isIdentifier(receiver)) {
      const retText = sourceFile
        .getClass(receiver.getText())
        ?.getStaticMethod(method.methodName)
        ?.getReturnTypeNode()
        ?.getText();
      if (retText) return classifyTypeText(retText, sourceFile);
    }
    return 'array';
  }

  const callee = unwrapExpression(call.getExpression());
  if (Node.isIdentifier(callee)) {
    const resolved = resolveCallableNode(callee, 2);
    if (isCallableNode(resolved)) {
      return classifyTypeText(resolved.getReturnTypeNode()?.getText(), resolved.getSourceFile());
    }
  }
  return 'array';
}

function shadowsBindingKey(node: Node, key: string): boolean {
  if (key.startsWith('this.')) {
    return (
      Node.isClassDeclaration(node) ||
      Node.isClassExpression(node) ||
      Node.isObjectLiteralExpression(node) ||
      Node.isFunctionDeclaration(node) ||
      Node.isFunctionExpression(node)
    );
  }
  if (isCallableNode(node)) {
    return Boolean(
      node.getParameter(key) ||
        node.getParameters().some((param) =>
          param
            .getNameNode()
            .getDescendantsOfKind(SyntaxKind.BindingElement)
            .some((el) => el.getName() === key),
        ),
    );
  }
  if (Node.isBlock(node) || Node.isSourceFile(node) || Node.isModuleBlock(node)) {
    return Boolean(node.getVariableDeclaration(key));
  }
  if (Node.isCatchClause(node)) {
    return node.getVariableDeclaration()?.getName() === key;
  }
  if (Node.isForStatement(node) || Node.isForOfStatement(node) || Node.isForInStatement(node)) {
    return Boolean(
      node
        .getInitializer()
        ?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
        .some((decl) => decl.getName() === key),
    );
  }
  return false;
}

function findInScope<T>(scope: Node, key: string, visit: (node: Node) => T | undefined): T | undefined {
  let found: T | undefined;
  scope.forEachChild((child) => {
    if (found !== undefined || shadowsBindingKey(child, key)) return;
    found = visit(child) ?? findInScope(child, key, visit);
  });
  return found;
}

function classifyReceiverNode(node: Node | undefined, depth = 0): ReceiverKind {
  if (!node || depth > 3) return 'array';
  const unwrapped = unwrapExpression(node);

  for (let cur: Node | undefined = node; cur && cur !== unwrapped; cur = cur.getParent()) {
    if (Node.isAsExpression(cur) || Node.isTypeAssertion(cur) || Node.isSatisfiesExpression(cur)) {
      const castKind = classifyTypeText(cur.getTypeNode()?.getText(), cur.getSourceFile());
      if (castKind !== 'array') return castKind;
    }
  }

  const key = getBindingKey(unwrapped);
  if (
    Node.isStringLiteral(unwrapped) ||
    Node.isNoSubstitutionTemplateLiteral(unwrapped) ||
    Node.isTemplateExpression(unwrapped) ||
    (Node.isPropertyAccessExpression(unwrapped) &&
      (ELEMENT_DOM_PROPERTY.test(unwrapped.getName()) ||
        (DOCUMENT_COLLECTION_PROPERTY.test(unwrapped.getName()) &&
          isDocumentReceiver(unwrapped.getExpression())))) ||
    (key === 'arguments' && isUnshadowedGlobal(unwrapped, 'arguments'))
  ) {
    return 'non-array';
  }

  if (Node.isNewExpression(unwrapped)) {
    const className = unwrapExpression(unwrapped.getExpression()).getText();
    return isUnshadowedGlobal(unwrapped, className)
      ? classifyTypeText(className, unwrapped.getSourceFile())
      : 'array';
  }

  if (isBinaryKind(unwrapped, SyntaxKind.BarBarToken, SyntaxKind.QuestionQuestionToken)) {
    const leftKind = classifyReceiverNode(unwrapped.getLeft(), depth + 1);
    return leftKind !== 'array' ? leftKind : classifyReceiverNode(unwrapped.getRight(), depth + 1);
  }

  const method = unwrapStrictMethod(unwrapped);
  if (method) {
    if (DOM_OR_STRING_METHOD.test(method.methodName)) return 'non-array';
    if (method.methodName === 'keys' || method.methodName === 'values' || method.methodName === 'entries') {
      return isGlobalReference(method.receiver, 'Object') ? 'array' : 'non-array';
    }
    if (isMutatingOrDomMethod(method.call, method.methodName)) {
      return classifyReceiverNode(method.receiver, depth + 1);
    }
    return classifyCallReturnType(method.call, method);
  }

  if (Node.isCallExpression(unwrapped)) {
    return classifyCallReturnType(unwrapped, null);
  }

  if (!key) return 'array';
  const scope =
    unwrapped.getFirstAncestor((ancestor) => shadowsBindingKey(ancestor, key)) ??
    unwrapped.getFirstAncestor(isCallableNode) ??
    unwrapped.getSourceFile();

  return (
    findInScope<ReceiverKind>(scope, key, (desc) => {
      let resolvedKind: ReceiverKind = 'array';
      if (Node.isVariableDeclaration(desc) || Node.isParameterDeclaration(desc) || Node.isPropertyDeclaration(desc)) {
        const declKey = Node.isPropertyDeclaration(desc) ? `this.${desc.getName()}` : desc.getName();
        if (declKey === key) {
          const typeKind = classifyTypeText(desc.getTypeNode()?.getText(), desc.getSourceFile());
          resolvedKind = typeKind !== 'array' ? typeKind : classifyReceiverNode(desc.getInitializer(), depth + 1);
        }
      } else {
        const assign = getAssignment(desc);
        if (
          assign &&
          (assign.operator === SyntaxKind.EqualsToken ||
            assign.operator === SyntaxKind.QuestionQuestionEqualsToken ||
            assign.operator === SyntaxKind.BarBarEqualsToken ||
            assign.operator === SyntaxKind.AmpersandAmpersandEqualsToken) &&
          getBindingKey(assign.left) === key
        ) {
          resolvedKind = classifyReceiverNode(assign.right, depth + 1);
        } else {
          const callInfo = unwrapStrictMethod(desc);
          if (callInfo && getBindingKey(callInfo.receiver) === key && isMutatingOrDomMethod(callInfo.call, callInfo.methodName)) {
            resolvedKind = 'non-array';
          }
        }
      }
      return resolvedKind !== 'array' ? resolvedKind : undefined;
    }) ?? 'array'
  );
}

function getSingleSpreadExpression(node: Node | undefined): Node | undefined {
  if (!node) return undefined;
  const unwrapped = unwrapExpression(node);
  if (!Node.isArrayLiteralExpression(unwrapped)) return undefined;
  const elements = unwrapped.getElements();
  return elements.length === 1 && Node.isSpreadElement(elements[0])
    ? elements[0].getExpression()
    : undefined;
}

function isZeroOrUndefinedSliceArg(arg: Node): boolean {
  const unwrapped = unwrapExpression(arg);
  return (
    (Node.isIdentifier(unwrapped) && unwrapped.getText() === 'undefined') ||
    getStaticNumber(unwrapped) === 0
  );
}

function extractCopySource(node: Node): { readonly receiverExpr: Node; readonly receiverText: string } | null {
  const method = unwrapStrictMethod(node);
  let copyTarget = getSingleSpreadExpression(node);

  if (!copyTarget && method) {
    const args = method.call.getArguments();
    if (method.methodName === 'concat' && args.length === 0) {
      copyTarget = method.receiver;
    } else if (
      method.methodName === 'slice' &&
      (args.length === 0 || (args.length === 1 && isZeroOrUndefinedSliceArg(args[0])))
    ) {
      copyTarget = method.receiver;
    }
  }

  const receiver = (method ? getSingleSpreadExpression(copyTarget) : undefined) ?? copyTarget;
  const receiverKind = receiver ? classifyReceiverNode(receiver) : 'non-array';
  if (
    !receiver ||
    receiverKind === 'non-array' ||
    (receiverKind === 'typed-array' && (receiver !== copyTarget || method?.methodName !== 'slice'))
  ) {
    return null;
  }

  const unwrapped = unwrapExpression(receiver);
  const rawText = unwrapped.getText();
  const needsParens = Node.isBinaryExpression(unwrapped) || Node.isConditionalExpression(unwrapped);
  return {
    receiverExpr: unwrapped,
    receiverText: needsParens ? `(${rawText})` : rawText,
  };
}

function hasIndexInversionExpression(targetNode: Node, receiverExpr: Node): boolean {
  const unwrappedTarget = unwrapExpression(targetNode);
  return targetNode
    .getAncestors()
    .slice(0, 3)
    .some((ancestor) => {
      if (!isBinaryKind(ancestor, SyntaxKind.MinusToken)) return false;
      const left = unwrapExpression(ancestor.getLeft());
      const right = unwrapExpression(ancestor.getRight());
      let lenCandidate: Node;
      let offsetLeft: Node;
      let offsetRight: Node;

      if (isBinaryKind(left, SyntaxKind.MinusToken)) {
        lenCandidate = unwrapExpression(left.getLeft());
        offsetLeft = unwrapExpression(left.getRight());
        offsetRight = right;
      } else if (isBinaryKind(right, SyntaxKind.PlusToken)) {
        lenCandidate = left;
        offsetLeft = unwrapExpression(right.getLeft());
        offsetRight = unwrapExpression(right.getRight());
      } else {
        return false;
      }

      if (!Node.isPropertyAccessExpression(lenCandidate) || lenCandidate.getName() !== 'length') {
        return false;
      }
      if (!areNodesEqual(lenCandidate.getExpression(), receiverExpr)) {
        return false;
      }
      if (offsetLeft !== unwrappedTarget && offsetRight !== unwrappedTarget) {
        return false;
      }
      return getStaticNumber(offsetLeft) === 1 || getStaticNumber(offsetRight) === 1;
    });
}

function isInvertedFindIndexCall(call: CallExpression, receiverExpr: Node): boolean {
  const outerCall = getSemanticParent(call).outer;
  if (hasIndexInversionExpression(outerCall, receiverExpr)) return true;

  const parent = outerCall.getParent();
  let assignedLhs: Node | undefined;
  if (Node.isVariableDeclaration(parent)) {
    assignedLhs = parent.getNameNode();
  } else {
    const assign = getAssignment(parent);
    if (assign?.operator === SyntaxKind.EqualsToken) {
      assignedLhs = assign.left;
    }
  }
  const lhsNode = assignedLhs ? unwrapExpression(assignedLhs) : undefined;
  if (!lhsNode || !Node.isIdentifier(lhsNode)) return false;

  const indexName = lhsNode.getText();
  const scope = call.getFirstAncestor(Node.isBlock) ?? call.getSourceFile();
  return Boolean(
    findInScope(scope, indexName, (node) =>
      Node.isIdentifier(node) &&
      node.getText() === indexName &&
      hasIndexInversionExpression(node, receiverExpr)
        ? true
        : undefined,
    ),
  );
}

function isModernArrayGuard(node: Node): boolean {
  return Boolean(
    node.getFirstAncestor((ancestor) => {
      const assign = getAssignment(ancestor);
      const assignLeft = assign?.operator === SyntaxKind.EqualsToken ? unwrapExpression(assign.left) : undefined;
      for (const candidate of [ancestor, assignLeft]) {
        if (!candidate) continue;
        const isNamedSymbol =
          (isCallableNode(candidate) && !Node.isArrowFunction(candidate)) ||
          Node.isPropertyAssignment(candidate) ||
          Node.isPropertyAccessExpression(candidate);
        if (isNamedSymbol && MODERN_METHODS.includes(candidate.getName() ?? '')) {
          return true;
        }
      }
      if (Node.isCallExpression(ancestor)) {
        return ancestor.getArguments().some((arg) => {
          const str = getStaticString(arg);
          return str !== null && MODERN_METHODS.includes(str);
        });
      }
      return false;
    }),
  );
}

export const copyingArrayMethodsMatcher = createJsCallMatcher({
  fastTokens: [['.slice(', '.concat(', '[...', '[ ...'], ['.sort(', '.reverse(']],
  dedupeLines: true,
  maxLineLength: 500,
  featureGuardTokens: MODERN_METHODS,
  isGuarded: isModernArrayGuard,
  matchCall(call) {
    const method = unwrapStrictMethod(call);
    if (!method) return null;
    const args = method.call.getArguments();
    const { methodName } = method;
    const isFindVariant = methodName === 'find' || methodName === 'findIndex';
    if (
      args.some(Node.isSpreadElement) ||
      (!isFindVariant && methodName !== 'sort' && methodName !== 'reverse')
    ) {
      return null;
    }

    let copyBase: Node | undefined;
    if (isFindVariant) {
      if (args.length < 1 || args.length > 2) return null;
      const innerReverse = unwrapStrictMethod(method.receiver);
      if (
        !innerReverse ||
        innerReverse.methodName !== 'reverse' ||
        innerReverse.call.getArguments().length > 0
      ) {
        return null;
      }
      copyBase = innerReverse.receiver;
    } else {
      const maxArgs = methodName === 'sort' ? 1 : 0;
      if (args.length > maxArgs) return null;
      if (methodName === 'reverse') {
        const chainedMethod = unwrapStrictMethod(getSemanticParent(call).outer.getParent()?.getParent());
        if (
          chainedMethod &&
          (chainedMethod.methodName === 'find' || chainedMethod.methodName === 'findIndex')
        ) {
          return null;
        }
      }
      copyBase = method.receiver;
      const { outer, parent } = getSemanticParent(call);
      if (
        parent &&
        Node.isNewExpression(parent) &&
        (isGlobalReference(parent.getExpression(), 'Map') ||
          isGlobalReference(parent.getExpression(), 'Set')) &&
        parent.getArguments().some((arg) => arg === outer)
      ) {
        return null;
      }
    }

    const callback = isFindVariant ? resolveCallableNode(unwrapExpression(args[0]), 2) : undefined;
    if (
      callback &&
      isCallableNode(callback) &&
      (callback.getParameters().some((param, idx) => idx > 0 || param.isRestParameter()) ||
        callback.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => id.getText() === 'arguments'))
    ) {
      return null;
    }

    const source = extractCopySource(copyBase);
    if (!source || (methodName === 'findIndex' && !isInvertedFindIndexCall(call, source.receiverExpr))) {
      return null;
    }

    const argList = args.map((arg) => arg.getText()).join(', ');
    if (methodName === 'sort') {
      return `Use ${source.receiverText}.toSorted(${argList}) instead of copying before .sort().`;
    }
    if (methodName === 'reverse') {
      return `Use ${source.receiverText}.toReversed() instead of copying before .reverse().`;
    }
    if (methodName === 'find') {
      return `Use ${source.receiverText}.findLast(${argList}) instead of copying and reversing before .find().`;
    }
    return (
      `Use ${source.receiverText}.findLastIndex(${argList}) instead of copying, reversing, and ` +
      `inverting .findIndex() (returns the final index directly without .length - 1 - ...).`
    );
  },
});

export const copyingArrayMethodsRule: AnalyzerRule = {
  id: 'js/copying-array-methods',
  guideId: 'js',
  guideHash: JS_COPYING_ARRAY_METHODS_GUIDE_HASH,
  summary: 'Replace shallow-copy array sorting, reversing, and reverse search with toSorted(), toReversed(), findLast(), and findLastIndex().',
  matcher: copyingArrayMethodsMatcher,
  verifierRubric: {
    keepWhen: ['Array (or TypedArray via .slice()) copied via [...arr], arr.slice(), arr.slice(0), or arr.concat().'],
    dropWhen: [
      'Spread [...x] on non-Array iterable (Set, Map, NodeList, HTMLCollection, DOMTokenList, FileList, arguments, string).',
      'Sparse holes (slice preserves holes; toSorted fills undefined), callback index/array args for findLast/findLastIndex (does not apply to toReversed() or toSorted()), or un-inverted findIndex.',
      'Visible project configuration in snippet targets pre-ES2023 (explicit engines.node < 20 or tsconfig lib/target older than ES2023; do not drop code merely because it uses var, ES5 syntax, or sits in a library/vendor file) or feature guards/polyfills.',
    ],
  },
};

export default [copyingArrayMethodsRule] satisfies readonly AnalyzerRule[];
