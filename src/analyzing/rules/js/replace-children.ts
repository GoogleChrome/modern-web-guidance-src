import {
  Node,
  SyntaxKind,
  type CallExpression,
  type ForOfStatement,
  type ForStatement,
  type ParameterDeclaration,
  type PropertyDeclaration,
  type VariableDeclaration,
} from 'ts-morph';
import {
  areNodesEqual,
  getAssignment,
  getMemberAccess,
  getSingleArgument,
  getStaticNumber,
  getStaticString,
  isGlobalReference,
  resolveLocalExpression,
  unwrapExpression,
  unwrapMethodCall,
  unwrapPropertyAccess,
} from '../../scanners/ast-helpers.ts';
import { createJsAstMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export const JS_REPLACE_CHILDREN_GUIDE_HASH = JS_GUIDE_HASH;

const FAST_TOKENS = [
  ['while', 'for', 'forEach'],
  ['removeChild', 'remove'],
  ['firstChild', 'lastChild', 'hasChildNodes', 'childNodes', 'children'],
] as const;
const TIDY_MSG =
  'Loop removes child nodes one by one; replace all children in a single call with ' +
  'element.replaceChildren().';
const SKIP_MSG =
  'Mutating a live DOM collection while iterating forward skips every other child.\n' +
  'Replace all children in a single call with element.replaceChildren().';

const TEMPLATE_NAME_RE = /(?:^|_|[a-z0-9])(?:template|tpl|tmpl)(?:El|Elem|Element|Node|Ref)?$/i;
const DOM_TYPE_RE = new RegExp(
  '\\b(?:Element|ShadowRoot|DocumentFragment|(?:HTML|XML)?Document|' +
    '(?:SVG|MathML)[A-Z]\\w*Element|HTML(?!Template\\b)[A-Z]\\w*Element|HTMLElement)\\b',
);

interface CollectionRef {
  readonly containerNode: Node;
  readonly collection: 'childNodes' | 'children';
  readonly boundVar?: string;
  readonly isLive?: boolean;
}

interface LoopMatch {
  readonly kind: 'tidy' | 'skipping';
  readonly containerNode: Node;
}

type ReceiverDomKind = 'template' | 'non-template' | null;
type ReceiverDecl = VariableDeclaration | ParameterDeclaration | PropertyDeclaration;

function classifyDomTypeText(typeText: string | undefined): ReceiverDomKind {
  if (!typeText) return null;
  if (/\bHTMLTemplateElement\b/.test(typeText)) return 'template';
  return DOM_TYPE_RE.test(typeText) ? 'non-template' : null;
}

function getCastDomKind(node: Node | undefined): ReceiverDomKind {
  let current = node;
  while (current) {
    if (
      Node.isAsExpression(current) ||
      Node.isTypeAssertion(current) ||
      Node.isSatisfiesExpression(current)
    ) {
      const kind = classifyDomTypeText(current.getTypeNode()?.getText());
      if (kind) return kind;
      current = current.getExpression();
      continue;
    }
    if (Node.isParenthesizedExpression(current) || Node.isNonNullExpression(current)) {
      current = current.getExpression();
      continue;
    }
    break;
  }
  return null;
}

function getCallDomKind(node: Node | undefined): ReceiverDomKind {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  const callNode = Node.isElementAccessExpression(unwrapped)
    ? unwrapExpression(unwrapped.getExpression())
    : unwrapped;
  if (!Node.isCallExpression(callNode)) return null;

  const typeArgKind = classifyDomTypeText(callNode.getTypeArguments()[0]?.getText());
  if (typeArgKind) return typeArgKind;

  const callInfo = unwrapMethodCall(callNode);
  if (!callInfo) return null;
  const { methodName, args } = callInfo;
  let tagHint: string | undefined;
  if (methodName === 'createElement' || methodName === 'createElementNS') {
    tagHint = getStaticString(methodName === 'createElementNS' ? args[1] : args[0]) ?? undefined;
  } else if (methodName === 'querySelector' || methodName === 'querySelectorAll') {
    tagHint =
      getStaticString(args[0])?.match(/^\s*([a-zA-Z][a-zA-Z0-9-]*)(?=$|[.#[:\s>,+~])/)?.[1];
  }
  if (!tagHint) return null;
  return tagHint.trim().toLowerCase() === 'template' ? 'template' : 'non-template';
}

function findReceiverDeclaration(expr: Node): ReceiverDecl | undefined {
  const member = getMemberAccess(expr);
  if (member && Node.isThisExpression(unwrapExpression(member.expression))) {
    const cls = expr.getFirstAncestor((a) => Node.isClassDeclaration(a) || Node.isClassExpression(a));
    return cls?.getProperty(member.name) ?? cls?.getConstructors()[0]?.getParameter(member.name);
  }
  if (!Node.isIdentifier(expr)) return undefined;
  const name = expr.getText();
  for (let scope: Node | undefined = expr.getParent(); scope; scope = scope.getParent()) {
    if (Node.isFunctionLikeDeclaration(scope)) {
      const param = scope.getParameter(name);
      if (param) return param;
    }
    if (Node.isBlock(scope) || Node.isSourceFile(scope)) {
      const varDecl = scope.getVariableDeclaration(
        (decl) => decl.getName() === name && decl.getStart() < expr.getStart(),
      );
      if (varDecl) return varDecl;
    }
  }
  return undefined;
}

function isTemplateReceiver(rawNode: Node): boolean {
  const outerCast = getCastDomKind(rawNode);
  if (outerCast) return outerCast === 'template';

  const expr = unwrapExpression(rawNode);
  const resolved = Node.isIdentifier(expr) ? resolveLocalExpression(expr, 2) : expr;
  if (unwrapPropertyAccess(expr, 'content')) return false;
  if (resolved !== expr && unwrapPropertyAccess(resolved, 'content')) return false;

  const decl = findReceiverDeclaration(expr);
  const initializer = decl?.getInitializer();
  if (initializer && unwrapPropertyAccess(initializer, 'content')) return false;

  const inferredKind =
    getCallDomKind(expr) ??
    classifyDomTypeText(decl?.getTypeNode()?.getText()) ??
    getCastDomKind(initializer) ??
    getCallDomKind(initializer) ??
    getCallDomKind(resolved);
  if (inferredKind) return inferredKind === 'template';

  const label = Node.isIdentifier(expr)
    ? expr.getText()
    : (getMemberAccess(expr)?.name.replace(/^#/, '') ?? '');
  return TEMPLATE_NAME_RE.test(label);
}

function extractSingleBodyCall(body: Node | undefined): CallExpression | null {
  if (!body) return null;
  let stmt = unwrapExpression(body);
  if (Node.isBlock(stmt)) {
    const statements = stmt.getStatements();
    if (statements.length !== 1 || !statements[0]) return null;
    stmt = statements[0];
  }
  const expr = Node.isExpressionStatement(stmt) ? unwrapExpression(stmt.getExpression()) : stmt;
  return Node.isCallExpression(expr) ? expr : null;
}

function extractCollectionRef(
  node: Node | undefined,
  expectedCollection?: 'childNodes' | 'children',
): CollectionRef | null {
  const member = getMemberAccess(node);
  if (!member || (member.name !== 'childNodes' && member.name !== 'children')) return null;
  if (expectedCollection && member.name !== expectedCollection) return null;
  return {
    containerNode: unwrapExpression(member.expression),
    collection: member.name,
  };
}

function extractLengthCollection(
  node: Node | undefined,
  expectedCollection?: 'childNodes' | 'children',
): CollectionRef | null {
  const member = getMemberAccess(node);
  if (!member || member.name !== 'length') return null;
  return extractCollectionRef(member.expression, expectedCollection);
}

function extractMinusOneCollection(
  node: Node | undefined,
  expectedCollection?: 'childNodes' | 'children',
): CollectionRef | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  if (!Node.isBinaryExpression(unwrapped)) return null;
  if (unwrapped.getOperatorToken().getKind() !== SyntaxKind.MinusToken) return null;
  if (getStaticNumber(unwrapped.getRight()) !== 1) return null;
  return extractLengthCollection(unwrapped.getLeft(), expectedCollection);
}

function isDirectChildExpr(
  node: Node,
  ref: CollectionRef,
  loopIndexName?: string,
): boolean {
  const unwrapped = unwrapExpression(node);
  if (ref.boundVar) {
    return Node.isIdentifier(unwrapped) && unwrapped.getText() === ref.boundVar;
  }

  const member = getMemberAccess(unwrapped);
  if (
    ref.collection === 'childNodes' &&
    member &&
    (member.name === 'firstChild' || member.name === 'lastChild') &&
    areNodesEqual(member.expression, ref.containerNode)
  ) {
    return true;
  }

  if (!Node.isElementAccessExpression(unwrapped)) return false;
  const indexedColl = extractCollectionRef(unwrapped.getExpression(), ref.collection);
  if (!indexedColl || !areNodesEqual(indexedColl.containerNode, ref.containerNode)) {
    return false;
  }

  const indexExpr = unwrapped.getArgumentExpression();
  if (!indexExpr) return false;
  if (getStaticNumber(indexExpr) === 0) return true;
  const minusOne = extractMinusOneCollection(indexExpr, ref.collection);
  if (minusOne && areNodesEqual(minusOne.containerNode, ref.containerNode)) {
    return true;
  }
  const unwrappedIdx = unwrapExpression(indexExpr);
  return Boolean(
    loopIndexName &&
      Node.isIdentifier(unwrappedIdx) &&
      unwrappedIdx.getText() === loopIndexName,
  );
}

function isRemovalCall(
  call: CallExpression | null,
  ref: CollectionRef,
  loopIndexName?: string,
): boolean {
  const callInfo = unwrapMethodCall(call ?? undefined, { methodName: new Set(['removeChild', 'remove']) });
  if (!callInfo) return false;
  const { methodName, receiver, args } = callInfo;
  if (methodName === 'removeChild') {
    return (
      args.length === 1 &&
      Boolean(args[0]) &&
      areNodesEqual(receiver, ref.containerNode) &&
      isDirectChildExpr(args[0], ref, loopIndexName)
    );
  }
  return args.length === 0 && isDirectChildExpr(receiver, ref, loopIndexName);
}

function extractWhileRef(cond: Node): CollectionRef | null {
  const unwrapped = unwrapExpression(cond);
  if (Node.isBinaryExpression(unwrapped)) {
    const op = unwrapped.getOperatorToken().getKind();
    const left = unwrapExpression(unwrapped.getLeft());
    const right = unwrapExpression(unwrapped.getRight());
    if (
      op === SyntaxKind.ExclamationEqualsEqualsToken ||
      op === SyntaxKind.ExclamationEqualsToken
    ) {
      if (
        right.getKind() === SyntaxKind.NullKeyword ||
        (Node.isIdentifier(right) && right.getText() === 'undefined')
      ) {
        return extractWhileRef(left);
      }
      return getStaticNumber(right) === 0 ? extractLengthCollection(left, 'childNodes') : null;
    }

    const childNodesLen = extractLengthCollection(left, 'childNodes');
    if (
      childNodesLen &&
      ((op === SyntaxKind.GreaterThanToken && getStaticNumber(right) === 0) ||
        (op === SyntaxKind.GreaterThanEqualsToken && getStaticNumber(right) === 1))
    ) {
      return childNodesLen;
    }

    if (op === SyntaxKind.EqualsToken && Node.isIdentifier(left)) {
      const rightMember = getMemberAccess(right);
      if (
        rightMember &&
        (rightMember.name === 'firstChild' || rightMember.name === 'lastChild')
      ) {
        return {
          containerNode: unwrapExpression(rightMember.expression),
          collection: 'childNodes',
          boundVar: left.getText(),
        };
      }
    }
    return null;
  }

  const hasChildNodesCall = unwrapMethodCall(unwrapped, {
    methodName: 'hasChildNodes',
    arity: 0,
  });
  if (hasChildNodesCall) {
    return {
      containerNode: unwrapExpression(hasChildNodesCall.receiver),
      collection: 'childNodes',
    };
  }

  const member = getMemberAccess(unwrapped);
  if (member && (member.name === 'firstChild' || member.name === 'lastChild')) {
    return {
      containerNode: unwrapExpression(member.expression),
      collection: 'childNodes',
    };
  }
  return extractLengthCollection(unwrapped, 'childNodes');
}

function getStepDirection(incrementor: Node | undefined, loopVarName: string): 1 | -1 | 0 {
  if (!incrementor) return 0;
  const expr = unwrapExpression(incrementor);

  if (Node.isPostfixUnaryExpression(expr) || Node.isPrefixUnaryExpression(expr)) {
    const operand = unwrapExpression(expr.getOperand());
    if (!Node.isIdentifier(operand) || operand.getText() !== loopVarName) return 0;
    const op = expr.getOperatorToken();
    if (op === SyntaxKind.PlusPlusToken) return 1;
    if (op === SyntaxKind.MinusMinusToken) return -1;
    return 0;
  }

  const assign = getAssignment(expr);
  if (!assign) return 0;
  const lhs = unwrapExpression(assign.left);
  if (!Node.isIdentifier(lhs) || lhs.getText() !== loopVarName) return 0;

  if (assign.operator === SyntaxKind.PlusEqualsToken) {
    return getStaticNumber(assign.right) === 1 ? 1 : 0;
  }
  if (assign.operator === SyntaxKind.MinusEqualsToken) {
    return getStaticNumber(assign.right) === 1 ? -1 : 0;
  }
  if (assign.operator === SyntaxKind.EqualsToken) {
    const rhs = unwrapExpression(assign.right);
    if (!Node.isBinaryExpression(rhs)) return 0;
    const rhsLeft = unwrapExpression(rhs.getLeft());
    if (!Node.isIdentifier(rhsLeft) || rhsLeft.getText() !== loopVarName) return 0;
    if (getStaticNumber(rhs.getRight()) !== 1) return 0;
    const rhsOp = rhs.getOperatorToken().getKind();
    if (rhsOp === SyntaxKind.PlusToken) return 1;
    if (rhsOp === SyntaxKind.MinusToken) return -1;
  }
  return 0;
}

function matchForStatement(stmt: ForStatement): LoopMatch | null {
  const init = stmt.getInitializer();
  const cond = stmt.getCondition();
  const incr = stmt.getIncrementor();
  const call = extractSingleBodyCall(stmt.getStatement());
  if (!cond || !call) return null;

  if (!init && !incr) {
    const ref = extractWhileRef(cond);
    return ref && isRemovalCall(call, ref)
      ? { kind: 'tidy', containerNode: ref.containerNode }
      : null;
  }

  let loopVarNode: Node | undefined;
  let initExpr: Node | undefined;
  if (init && Node.isVariableDeclarationList(init)) {
    const decls = init.getDeclarations();
    if (decls.length === 1 && decls[0]) {
      loopVarNode = decls[0].getNameNode();
      initExpr = decls[0].getInitializer();
    }
  } else {
    const assign = getAssignment(init);
    if (assign?.operator === SyntaxKind.EqualsToken) {
      loopVarNode = unwrapExpression(assign.left);
      initExpr = assign.right;
    }
  }

  const condExpr = unwrapExpression(cond);
  if (!loopVarNode || !Node.isIdentifier(loopVarNode) || !initExpr || !Node.isBinaryExpression(condExpr)) {
    return null;
  }
  const loopVarName = loopVarNode.getText();
  const condLeft = unwrapExpression(condExpr.getLeft());
  if (!Node.isIdentifier(condLeft) || condLeft.getText() !== loopVarName) return null;

  const condOp = condExpr.getOperatorToken().getKind();
  const condRight = condExpr.getRight();
  const step = getStepDirection(incr, loopVarName);

  if (getStaticNumber(initExpr) === 0 && step === 1) {
    const boundRef =
      condOp === SyntaxKind.LessThanToken
        ? extractLengthCollection(condRight)
        : condOp === SyntaxKind.LessThanEqualsToken
          ? extractMinusOneCollection(condRight)
          : null;
    if (boundRef && isRemovalCall(call, boundRef, loopVarName)) {
      return { kind: 'skipping', containerNode: boundRef.containerNode };
    }
  }

  const startMinusOne = extractMinusOneCollection(initExpr, 'childNodes');
  if (
    startMinusOne &&
    step === -1 &&
    ((condOp === SyntaxKind.GreaterThanEqualsToken && getStaticNumber(condRight) === 0) ||
      (condOp === SyntaxKind.GreaterThanToken && getStaticNumber(condRight) === -1)) &&
    isRemovalCall(call, startMinusOne, loopVarName)
  ) {
    return { kind: 'tidy', containerNode: startMinusOne.containerNode };
  }
  return null;
}

function isEmptyArrayReceiver(expr: Node): boolean {
  const unwrapped = unwrapExpression(expr);
  if (Node.isArrayLiteralExpression(unwrapped) && unwrapped.getElements().length === 0) {
    return true;
  }
  const protoMember = getMemberAccess(unwrapped);
  return Boolean(
    protoMember?.name === 'prototype' && isGlobalReference(protoMember.expression, 'Array'),
  );
}

function resolveIterableCollection(node: Node): CollectionRef | null {
  const unwrapped = unwrapExpression(node);
  const direct = extractCollectionRef(unwrapped);
  if (direct) return { ...direct, isLive: true };

  let snapshotSource: Node | undefined;
  if (Node.isArrayLiteralExpression(unwrapped)) {
    const elements = unwrapped.getElements();
    if (elements.length === 1 && elements[0] && Node.isSpreadElement(elements[0])) {
      snapshotSource = elements[0].getExpression();
    }
  } else {
    const callInfo = unwrapMethodCall(unwrapped, { arity: 1 });
    if (callInfo) {
      const arg = getSingleArgument(callInfo.call);
      if (arg) {
        if (callInfo.methodName === 'from' && isGlobalReference(callInfo.receiver, 'Array')) {
          snapshotSource = arg;
        } else if (callInfo.methodName === 'call') {
          const sliceAccess = getMemberAccess(callInfo.receiver);
          if (sliceAccess?.name === 'slice' && isEmptyArrayReceiver(sliceAccess.expression)) {
            snapshotSource = arg;
          }
        }
      }
    }
  }

  const snapshotRef = extractCollectionRef(snapshotSource, 'childNodes');
  return snapshotRef ? { ...snapshotRef, isLive: false } : null;
}

function matchCallbackLoop(
  target: CollectionRef | null,
  paramNameNode: Node | undefined,
  body: Node | undefined,
): LoopMatch | null {
  if (!target || !paramNameNode || !Node.isIdentifier(paramNameNode)) return null;
  const call = extractSingleBodyCall(body);
  if (!call) return null;
  if (!isRemovalCall(call, { ...target, boundVar: paramNameNode.getText() })) return null;
  return {
    kind: target.isLive ? 'skipping' : 'tidy',
    containerNode: target.containerNode,
  };
}

function matchForOfStatement(stmt: ForOfStatement): LoopMatch | null {
  if (stmt.getAwaitKeyword()) return null;
  const init = stmt.getInitializer();
  if (!Node.isVariableDeclarationList(init)) return null;
  const decls = init.getDeclarations();
  if (decls.length !== 1 || !decls[0]) return null;
  return matchCallbackLoop(
    resolveIterableCollection(stmt.getExpression()),
    decls[0].getNameNode(),
    stmt.getStatement(),
  );
}

function matchForEachCall(call: CallExpression): LoopMatch | null {
  const callInfo = unwrapMethodCall(call);
  if (!callInfo) return null;

  let targetNode: Node | undefined;
  let callbackNode: Node | undefined;
  if (callInfo.methodName === 'forEach' && callInfo.args.length === 1) {
    targetNode = callInfo.receiver;
    callbackNode = callInfo.args[0];
  } else if (callInfo.methodName === 'call' && callInfo.args.length === 2) {
    const forEachAccess = getMemberAccess(callInfo.receiver);
    if (forEachAccess?.name === 'forEach' && isEmptyArrayReceiver(forEachAccess.expression)) {
      targetNode = callInfo.args[0];
      callbackNode = callInfo.args[1];
    }
  }
  if (!targetNode || !callbackNode) return null;

  const callback = unwrapExpression(callbackNode);
  if ((!Node.isArrowFunction(callback) && !Node.isFunctionExpression(callback)) || callback.isAsync()) {
    return null;
  }
  const params = callback.getParameters();
  if (params.length !== 1 || !params[0] || params[0].isRestParameter() || params[0].getInitializer()) {
    return null;
  }
  return matchCallbackLoop(
    resolveIterableCollection(targetNode),
    params[0].getNameNode(),
    callback.getBody(),
  );
}

export const jsReplaceChildrenMatcher: JsRuleMatcher = createJsAstMatcher({
  fastTokens: FAST_TOKENS,
  featureGuardTokens: ['replaceChildren'],
  dedupeLines: true,
  kinds: [
    SyntaxKind.WhileStatement,
    SyntaxKind.ForStatement,
    SyntaxKind.ForOfStatement,
    SyntaxKind.CallExpression,
  ],
  matchNode(node) {
    let matched: LoopMatch | null = null;
    if (Node.isWhileStatement(node)) {
      const ref = extractWhileRef(node.getExpression());
      if (ref && isRemovalCall(extractSingleBodyCall(node.getStatement()), ref)) {
        matched = { kind: 'tidy', containerNode: ref.containerNode };
      }
    } else if (Node.isForStatement(node)) {
      matched = matchForStatement(node);
    } else if (Node.isForOfStatement(node)) {
      matched = matchForOfStatement(node);
    } else if (Node.isCallExpression(node)) {
      matched = matchForEachCall(node);
    }
    if (!matched || isTemplateReceiver(matched.containerNode)) return null;
    return matched.kind === 'skipping' ? SKIP_MSG : TIDY_MSG;
  },
});

export const jsReplaceChildrenRule: AnalyzerRule = {
  id: 'js/replace-children',
  guideId: 'js',
  guideHash: JS_REPLACE_CHILDREN_GUIDE_HASH,
  summary:
    'Replace loops that remove all child nodes one by one (including forward live-collection loops that ' +
    'skip every other child) with el.replaceChildren().',
  matcher: jsReplaceChildrenMatcher,
  verifierRubric: {
    keepWhen: [
      'The loop unconditionally removes all direct children of a DOM ParentNode (Element, Document, or DocumentFragment) without moving/reparenting nodes or running per-node teardown, and replacement with el.replaceChildren() preserves behavior.',
      'The loop iterates forward over a live DOM collection (such as el.children[i], el.childNodes[i], for...of over el.children/el.childNodes, or childNodes.forEach) and removes items during iteration, which skips every other child.',
    ],
    dropWhen: [
      'The receiver is a non-DOM object, custom tree or scene-graph wrapper, mock, or plain JavaScript object implementing its own childNodes/children/removeChild/remove API rather than a native DOM ParentNode.',
      'The receiver is a <template> element itself rather than template.content (since template.replaceChildren() does not clear template.content), or a leaf node such as Text or Comment.',
      'The loop removes only Element nodes on a mixed-content container where inline Text or Comment nodes must remain intact, or only removes a partial subset of children (bounded count or sentinel stop).',
      'The loop body consumes removeChild() return values to move or collect nodes, performs per-node teardown or disposal, or targets a Custom Element whose disconnectedCallback() relies on sequential per-node removal.',
      'The code sits inside an obsolete legacy-browser workaround (such as clearing children immediately before assigning innerHTML or setting textContent = ""), a genuine legacy-browser DOM polyfill/shim, or an explicit replaceChildren() guard.',
    ],
  },
};

export default [jsReplaceChildrenRule] satisfies readonly AnalyzerRule[];
