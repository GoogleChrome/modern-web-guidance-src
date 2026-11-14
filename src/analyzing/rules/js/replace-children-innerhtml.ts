import { Node, SyntaxKind, type ExpressionStatement } from 'ts-morph';
import {
  areNodesEqual,
  getSemanticParent,
  getStaticString,
  isGlobalReference,
  resolveLocalExpression,
  unwrapExpression,
  unwrapMethodCall,
  unwrapPropertyAccess,
} from '../../scanners/ast-helpers.ts';
import { createJsAstMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH, findReceiverDeclaration, isTemplateReceiver } from './shared.ts';
export const JS_REPLACE_CHILDREN_GUIDE_HASH = JS_GUIDE_HASH;

const HTML_READ_PROPS = new Set(['innerHTML', 'outerHTML', 'textContent']);
const DOCUMENT_FRAGMENT_TYPE_RE = /\bDocumentFragment\b/;
const CLEAR_MSG =
  'Assigning empty innerHTML invokes the HTML parser and fails under Trusted Types; ' +
  'use element.replaceChildren() (or element.replaceChildren(newContent)) instead.';

function isDocumentFragmentNode(node: Node | undefined): boolean {
  if (!node) return false;
  const contentAccess = unwrapPropertyAccess(node, 'content');
  if (contentAccess && isTemplateReceiver(contentAccess.getExpression())) return true;
  if (unwrapMethodCall(node)?.methodName === 'createDocumentFragment') return true;
  let current: Node | undefined = node;
  while (current) {
    if (
      Node.isAsExpression(current) ||
      Node.isTypeAssertion(current) ||
      Node.isSatisfiesExpression(current)
    ) {
      if (DOCUMENT_FRAGMENT_TYPE_RE.test(current.getTypeNode()?.getText() ?? '')) return true;
      current = current.getExpression();
      continue;
    }
    if (Node.isParenthesizedExpression(current) || Node.isNonNullExpression(current)) {
      current = current.getExpression();
      continue;
    }
    break;
  }
  return false;
}

function isDocumentFragmentReceiver(rawNode: Node): boolean {
  if (isDocumentFragmentNode(rawNode)) return true;
  const expr = unwrapExpression(rawNode);
  const resolved = Node.isIdentifier(expr) ? resolveLocalExpression(expr, 2) : expr;
  if (resolved !== expr && isDocumentFragmentNode(resolved)) return true;
  const decl = findReceiverDeclaration(expr);
  if (!decl) return false;
  if (DOCUMENT_FRAGMENT_TYPE_RE.test(decl.getTypeNode()?.getText() ?? '')) return true;
  return isDocumentFragmentNode(decl.getInitializer());
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
    if (isGlobalReference(receiver, 'document')) return null;
    if (isTemplateReceiver(receiver)) return null;
    if (isDocumentFragmentReceiver(receiver)) return null;
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
      'A standalone statement clears a DOM Element, ShadowRoot, or SVGElement via .innerHTML = "" or .innerHTML = null (including when followed by appendChild/append calls to insert new nodes), where el.replaceChildren() avoids HTML parsing and Trusted Types CSP failures.',
    ],
    dropWhen: [
      'The receiver is a <template> element (where template.innerHTML = "" clears template.content, whereas template.replaceChildren() leaves template.content untouched) or a DocumentFragment / template.content (DocumentFragment has no innerHTML setter, so .innerHTML = "" is a no-op whereas replaceChildren() removes children).',
      'The receiver is bare document or a non-DOM mock, serializer, virtual DOM node, or plain JavaScript object that happens to define an innerHTML property.',
      'The empty innerHTML assignment is redundantly followed by another innerHTML assignment (= or +=) on the same receiver in the same block without intervening control flow, await/yield, or reads of its HTML/text content.',
      'The assignment is part of a chained assignment or expression context whose empty-string result is consumed, relies on Custom Element disconnectedCallback() ordering, or sits inside a genuine legacy-browser DOM polyfill/shim or explicit replaceChildren() feature-detection guard.',
    ],
  },
};

export default [jsReplaceChildrenInnerHtmlRule] satisfies readonly AnalyzerRule[];
