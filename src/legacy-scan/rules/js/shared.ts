import {
  Node,
  type ParameterDeclaration,
  type PropertyDeclaration,
  type VariableDeclaration,
} from 'ts-morph';
import {
  getMemberAccess,
  getStaticString,
  resolveLexicalBinding,
  resolveLocalExpression,
  unwrapExpression,
  unwrapMethodCall,
  unwrapPropertyAccess,
} from '../../scanners/ast-helpers.ts';

export const JS_GUIDE_HASH = '78d968c460dd';

export const TEMPLATE_NAME_RE = /(?:^|_|[a-z0-9])(?:template|tpl|tmpl)(?:El|Elem|Element|Node|Ref)?$/i;
export const DOM_TYPE_RE = new RegExp(
  '\\b(?:Element|ShadowRoot|DocumentFragment|(?:HTML|XML)?Document|' +
    '(?:SVG|MathML)[A-Z]\\w*Element|HTML(?!Template\\b)[A-Z]\\w*Element|HTMLElement)\\b',
);

export type ReceiverDomKind = 'template' | 'non-template' | null;
export type ReceiverDecl = VariableDeclaration | ParameterDeclaration | PropertyDeclaration;

export function classifyDomTypeText(typeText: string | undefined): ReceiverDomKind {
  if (!typeText) return null;
  if (/\bHTMLTemplateElement\b/.test(typeText)) return 'template';
  return DOM_TYPE_RE.test(typeText) ? 'non-template' : null;
}

export function getCastDomKind(node: Node | undefined): ReceiverDomKind {
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

export function getCallDomKind(node: Node | undefined): ReceiverDomKind {
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

export function findReceiverDeclaration(expr: Node): ReceiverDecl | undefined {
  const member = getMemberAccess(expr);
  if (member && Node.isThisExpression(unwrapExpression(member.expression))) {
    const cls = expr.getFirstAncestor((a) => Node.isClassDeclaration(a) || Node.isClassExpression(a));
    return cls?.getProperty(member.name) ?? cls?.getConstructors()[0]?.getParameter(member.name);
  }
  if (!Node.isIdentifier(expr)) return undefined;
  const binding = resolveLexicalBinding(expr, expr.getText(), expr.getStart());
  if (binding?.kind !== 'variable' && binding?.kind !== 'parameter') return undefined;
  return Node.isIdentifier(binding.node.getNameNode()) ? binding.node : undefined;
}

export function isTemplateReceiver(rawNode: Node): boolean {
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
