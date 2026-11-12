import {
  Node,
  SyntaxKind,
  type ExpressionStatement,
  type ParameterDeclaration,
  type PropertyDeclaration,
  type VariableDeclaration,
} from 'ts-morph';
import {
  areNodesEqual,
  getMemberAccess,
  getSemanticParent,
  getStaticString,
  resolveLocalExpression,
  unwrapExpression,
  unwrapMethodCall,
  unwrapPropertyAccess,
} from '../../scanners/ast-helpers.ts';
import { createJsAstMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export const JS_REPLACE_CHILDREN_GUIDE_HASH = JS_GUIDE_HASH;

const TEMPLATE_NAME_RE = /(?:^|_|[a-z0-9])(?:template|tpl|tmpl)(?:El|Elem|Element|Node|Ref)?$/i;
const DOM_TYPE_RE = new RegExp(
  '\\b(?:Element|ShadowRoot|DocumentFragment|(?:HTML|XML)?Document|' +
    '(?:SVG|MathML)[A-Z]\\w*Element|HTML(?!Template\\b)[A-Z]\\w*Element|HTMLElement)\\b',
);
const HTML_READ_PROPS = new Set(['innerHTML', 'outerHTML', 'textContent']);
const CLEAR_MSG =
  'Assigning empty innerHTML invokes the HTML parser and fails under Trusted Types; ' +
  'use element.replaceChildren() (or element.replaceChildren(newContent)) instead.';

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

function isEmptyHtmlValue(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  return unwrapped.getKind() === SyntaxKind.NullKeyword || getStaticString(unwrapped) === '';
}

function readsHtmlProperties(root: Node, receiver: Node): boolean {
  return root.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((propAccess) => {
    return (
      HTML_READ_PROPS.has(propAccess.getName()) &&
      areNodesEqual(propAccess.getExpression(), receiver)
    );
  });
}

function isStatementValueDiscarded(node: Node): boolean {
  let current = node;
  while (true) {
    const { outer, parent } = getSemanticParent(current);
    if (!parent) return false;
    if (Node.isExpressionStatement(parent) || Node.isVoidExpression(parent)) return true;
    if (!Node.isBinaryExpression(parent) || parent.getRight() !== outer) return false;
    const opKind = parent.getOperatorToken().getKind();
    if (
      opKind !== SyntaxKind.CommaToken &&
      opKind !== SyntaxKind.AmpersandAmpersandToken &&
      opKind !== SyntaxKind.BarBarToken
    ) {
      return false;
    }
    current = parent;
  }
}

function hasRedundantNextInnerHtmlWrite(stmt: ExpressionStatement, receiver: Node): boolean {
  const parent = stmt.getParent();
  const statements = parent && Node.isStatemented(parent) ? parent.getStatements() : [];
  const startIndex = statements.indexOf(stmt) + 1;
  if (startIndex <= 0) return false;

  for (let i = startIndex; i < statements.length; i++) {
    const nextStmt = statements[i];
    if (!nextStmt) break;
    if (nextStmt.getFirstDescendant((d) => Node.isAwaitExpression(d) || Node.isYieldExpression(d))) {
      break;
    }
    if (Node.isVariableStatement(nextStmt)) {
      if (readsHtmlProperties(nextStmt, receiver)) break;
      continue;
    }
    if (!Node.isExpressionStatement(nextStmt)) break;

    let expr = unwrapExpression(nextStmt.getExpression());
    if (
      Node.isBinaryExpression(expr) &&
      (expr.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken ||
        expr.getOperatorToken().getKind() === SyntaxKind.BarBarToken)
    ) {
      if (readsHtmlProperties(expr.getLeft(), receiver)) break;
      expr = unwrapExpression(expr.getRight());
    }
    if (!Node.isBinaryExpression(expr)) break;

    const lhsAccess = unwrapPropertyAccess(expr.getLeft(), 'innerHTML');
    if (lhsAccess && areNodesEqual(lhsAccess.getExpression(), receiver)) {
      const rhs = expr.getRight();
      if (readsHtmlProperties(rhs, receiver)) return false;
      const opKind = expr.getOperatorToken().getKind();
      return opKind === SyntaxKind.EqualsToken
        ? !isEmptyHtmlValue(rhs)
        : opKind === SyntaxKind.PlusEqualsToken;
    }
    break;
  }
  return false;
}

export const jsReplaceChildrenInnerHtmlMatcher: JsRuleMatcher = createJsAstMatcher({
  fastTokens: ['innerHTML'],
  featureGuardTokens: ['replaceChildren'],
  dedupeLines: true,
  kinds: [SyntaxKind.BinaryExpression],
  matchNode(node) {
    if (!Node.isBinaryExpression(node)) return null;
    if (node.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) return null;
    if (!isEmptyHtmlValue(node.getRight())) return null;

    const lhs = unwrapPropertyAccess(node.getLeft(), 'innerHTML');
    if (!lhs || !Node.isPropertyAccessExpression(lhs)) return null;
    if (!isStatementValueDiscarded(node)) return null;

    const stmt = node.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (!stmt) return null;

    const receiver = lhs.getExpression();
    if (isTemplateReceiver(receiver)) return null;
    if (hasRedundantNextInnerHtmlWrite(stmt, receiver)) return null;
    return CLEAR_MSG;
  },
});

export const jsReplaceChildrenInnerHtmlRule: AnalyzerRule = {
  id: 'js/replace-children-innerhtml',
  guideId: 'js',
  guideHash: JS_REPLACE_CHILDREN_GUIDE_HASH,
  summary:
    'Replace standalone empty innerHTML assignments (el.innerHTML = "") with el.replaceChildren() to avoid ' +
    'HTML parsing and Trusted Types CSP failures.',
  matcher: jsReplaceChildrenInnerHtmlMatcher,
  verifierRubric: {
    keepWhen: [
      'A standalone statement clears a DOM Element, ShadowRoot, DocumentFragment (including template.content), or SVGElement via .innerHTML = "" or .innerHTML = null (including when followed by appendChild/append calls to insert new nodes), where el.replaceChildren() avoids HTML parsing and Trusted Types CSP failures.',
    ],
    dropWhen: [
      'The receiver is a <template> element (where template.innerHTML = "" clears template.content, whereas template.replaceChildren() leaves template.content untouched) rather than template.content or a regular DOM ParentNode.',
      'The receiver is bare document or a non-DOM mock, serializer, virtual DOM node, or plain JavaScript object that happens to define an innerHTML property.',
      'The empty innerHTML assignment is redundantly followed by another innerHTML assignment (= or +=) on the same receiver in the same block without intervening control flow, await/yield, or reads of its HTML/text content.',
      'The assignment is part of a chained assignment or expression context whose empty-string result is consumed, relies on Custom Element disconnectedCallback() ordering, or sits inside a genuine legacy-browser DOM polyfill/shim or explicit replaceChildren() feature-detection guard.',
    ],
  },
};

export default [jsReplaceChildrenInnerHtmlRule] satisfies readonly AnalyzerRule[];
