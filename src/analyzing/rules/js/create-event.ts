import { Node, SyntaxKind, type CallExpression, type NewExpression, type VariableDeclaration } from 'ts-morph';
import {
  areNodesEqual,
  getAssignment,
  getMemberAccess,
  getSemanticParent,
  getStaticString,
  isCallableNode,
  isGlobalReference,
  isIdentifierReference,
  resolveLocalExpression,
  resolvesToBinding,
  unwrapExpression,
} from '../../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../../scanners/js-scanner.ts';
import type { AnalyzerRule, JsRuleMatcher } from '../../schema.ts';

import { JS_GUIDE_HASH } from './shared.ts';
export { JS_GUIDE_HASH };

const CTOR_MSG: Readonly<Record<string, string>> = {
  CustomEvent: 'new CustomEvent(type, { detail, bubbles, cancelable })',
  KeyboardEvent: 'new KeyboardEvent(type, { bubbles, cancelable, ... })',
  MessageEvent: 'new MessageEvent(type, { data, bubbles, cancelable })',
  MouseEvent: 'new MouseEvent(type, { bubbles, cancelable, ... })',
  MouseEvents: 'new MouseEvent(type, { bubbles, cancelable, ... })',
  UIEvent: 'new UIEvent(type, { bubbles, cancelable, view, detail })',
  UIEvents: 'new UIEvent(type, { bubbles, cancelable, view, detail })',
};
const STANDARD_IFACES = new Set([...Object.keys(CTOR_MSG), 'Event', 'Events', 'HTMLEvents']);
const NON_MIGRABLE_IFACES = new Set([
  'TouchEvent',
  'TouchEvents',
  'MutationEvent',
  'MutationEvents',
  'KeyEvents',
]);
const EVENT_CTORS = new Set([
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'UIEvent',
  'FocusEvent',
  'PointerEvent',
  'WheelEvent',
  'InputEvent',
  'MessageEvent',
]);
const GUARD_RE =
  /\b(?:createEvent(?:Object)?|dispatchEvent|fireEvent|CustomEvent|MouseEvent|KeyboardEvent|UIEvent|MessageEvent|FocusEvent|PointerEvent|WheelEvent|InputEvent|Event)\b/;
const DOC_PROPS = new Set(['document', 'ownerDocument', 'contentDocument']);
const POLYFILL_NAME_RE = /^(?:polyfill.*Event|.*EventPolyfill)$/i;
const INIT_EVENT_RE =
  /^init(?:Custom|Mouse|Keyboard|UI|Key|Focus|Wheel|Composition|Text|Touch|Mutation|Message)?Event$/;

interface AssignedTargetInfo {
  readonly name: string | null;
  readonly node: Node;
  readonly declNode?: VariableDeclaration;
}

function getReferenceName(node?: Node): string | null {
  if (!node) return null;
  const unwrapped = unwrapExpression(node);
  if (Node.isIdentifier(unwrapped)) return unwrapped.getText();
  return getMemberAccess(unwrapped)?.name ?? null;
}

function isDomDocument(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  if (isGlobalReference(unwrapped, 'document')) return true;
  if (Node.isPropertyAccessExpression(unwrapped) && DOC_PROPS.has(unwrapped.getName())) return true;
  const resolved = resolveLocalExpression(unwrapped, 2);
  return resolved !== unwrapped && isDomDocument(resolved);
}

function isNodeReferencingTarget(root: Node, target: AssignedTargetInfo): boolean {
  const check = (candidate: Node): boolean => {
    const unwrapped = unwrapExpression(candidate);
    if (target.name && Node.isIdentifier(target.node)) {
      if (
        Node.isIdentifier(unwrapped) &&
        isIdentifierReference(unwrapped) &&
        unwrapped.getText() === target.name
      ) {
        return !target.declNode || resolvesToBinding(unwrapped, target.declNode);
      }
      return false;
    }
    return areNodesEqual(unwrapped, target.node);
  };

  if (check(root)) return true;
  let found = false;
  root.forEachDescendant((desc, traversal) => {
    if (check(desc)) {
      found = true;
      traversal.stop();
    }
  });
  return found;
}

function hasMemberName(node: Node, name: string): boolean {
  for (const prop of node.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (prop.getName() === name) return true;
  }
  for (const elem of node.getDescendantsOfKind(SyntaxKind.ElementAccessExpression)) {
    if (getStaticString(elem.getArgumentExpression()) === name) return true;
  }
  return false;
}

function isInsideEventPolyfill(
  call: CallExpression,
  scope: Node,
  iface: string | null,
  assignedTarget: AssignedTargetInfo | null,
): boolean {
  const inPolyfillAncestor = call.getAncestors().some((ancestor) => {
    let symbolName: string | null = null;
    if (
      Node.isFunctionDeclaration(ancestor) ||
      Node.isFunctionExpression(ancestor) ||
      Node.isVariableDeclaration(ancestor)
    ) {
      symbolName = ancestor.getName() ?? null;
    } else {
      const assign = getAssignment(ancestor);
      if (assign?.operator === SyntaxKind.EqualsToken) {
        symbolName = getReferenceName(assign.left);
      }
    }
    return Boolean(symbolName && (EVENT_CTORS.has(symbolName) || POLYFILL_NAME_RE.test(symbolName)));
  });
  if (inPolyfillAncestor) return true;

  if (scope !== call.getSourceFile()) {
    if (hasMemberName(scope, 'createEventObject') || hasMemberName(scope, 'fireEvent')) {
      return true;
    }
    const isCustomEventFactory =
      (iface === 'CustomEvent' || hasMemberName(scope, 'initCustomEvent')) &&
      hasMemberName(scope, 'bubbles') &&
      hasMemberName(scope, 'cancelable') &&
      hasMemberName(scope, 'detail');
    if (isCustomEventFactory) {
      if (!assignedTarget) return true;
      return scope.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((ret) => {
        const expr = ret.getExpression();
        return Boolean(expr && isNodeReferencingTarget(expr, assignedTarget));
      });
    }
  }
  return false;
}

function hasModernEventFallback(call: CallExpression): boolean {
  const isEventCtorName = (node: Node): boolean => {
    const unwrapped = unwrapExpression(node);
    const name =
      Node.isIdentifier(unwrapped)
        ? unwrapped.getText()
        : getMemberAccess(unwrapped)?.name ?? null;
    return Boolean(name && (EVENT_CTORS.has(name) || name.endsWith('Event')));
  };
  const isConstructorRef = (exprNode: Node): boolean => {
    const unwrapped = unwrapExpression(exprNode);
    if (isEventCtorName(unwrapped)) return true;
    const resolved = Node.isIdentifier(unwrapped) ? resolveLocalExpression(unwrapped, 2) : unwrapped;
    return resolved !== unwrapped && isEventCtorName(resolved);
  };

  for (let cur: Node = call, parent = cur.getParent(); parent; cur = parent, parent = cur.getParent()) {
    if (
      Node.isCatchClause(cur) &&
      Node.isTryStatement(parent) &&
      parent
        .getTryBlock()
        .getDescendantsOfKind(SyntaxKind.NewExpression)
        .some((ne) => isConstructorRef(ne.getExpression()))
    ) {
      return true;
    }

    if (Node.isBinaryExpression(parent)) {
      const op = parent.getOperatorToken().getKind();
      if (
        (op === SyntaxKind.AmpersandAmpersandToken || op === SyntaxKind.BarBarToken) &&
        GUARD_RE.test(parent.getLeft().getText())
      ) {
        return true;
      }
    }

    if (Node.isIfStatement(parent) || Node.isConditionalExpression(parent)) {
      const cond = Node.isIfStatement(parent) ? parent.getExpression() : parent.getCondition();
      if (GUARD_RE.test(cond.getText())) return true;
      const thenBranch = Node.isIfStatement(parent) ? parent.getThenStatement() : parent.getWhenTrue();
      const elseBranch = Node.isIfStatement(parent) ? parent.getElseStatement() : parent.getWhenFalse();
      const sibling = cur === thenBranch ? elseBranch : thenBranch;
      const unwrapped = sibling ? unwrapExpression(sibling) : undefined;
      const isSiblingFallbackCtor = (ne: NewExpression): boolean =>
        isConstructorRef(ne.getExpression()) ||
        cond
          .getDescendantsOfKind(SyntaxKind.TypeOfExpression)
          .some((toe) => areNodesEqual(toe.getExpression(), ne.getExpression()));
      if (
        unwrapped &&
        (/\b(?:createEventObject|fireEvent)\b/.test(unwrapped.getText()) ||
          (Node.isNewExpression(unwrapped) && isSiblingFallbackCtor(unwrapped)) ||
          unwrapped
            .getDescendantsOfKind(SyntaxKind.NewExpression)
            .some(isSiblingFallbackCtor))
      ) {
        return true;
      }
    }
  }
  return false;
}

function getAssignedTargetInfo(outerExpr: Node): AssignedTargetInfo | null {
  for (let cur = outerExpr, parent = cur.getParent(); parent; cur = parent, parent = cur.getParent()) {
    if (Node.isConditionalExpression(parent) || Node.isParenthesizedExpression(parent)) continue;
    if (Node.isVariableDeclaration(parent) && parent.getInitializer() === cur) {
      const nameNode = parent.getNameNode();
      return {
        name: Node.isIdentifier(nameNode) ? nameNode.getText() : null,
        node: nameNode,
        declNode: parent,
      };
    }
    const assign = getAssignment(parent);
    if (assign && assign.operator === SyntaxKind.EqualsToken && assign.right === cur) {
      const left = unwrapExpression(assign.left);
      return {
        name: getReferenceName(left),
        node: left,
      };
    }
    break;
  }
  return null;
}

export const jsCreateEventMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['createEvent'],
  featureGuardTokens: ['CustomEvent', 'MouseEvent', 'KeyboardEvent', 'UIEvent', 'MessageEvent'],
  dedupeLines: true,
  maxLineLength: 500,
  matchCall(call, sourceFile) {
    const callee = unwrapExpression(call.getExpression());
    const args = call.getArguments();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'createEvent') return null;

    const iface = args.length === 1 ? getStaticString(args[0]) : null;
    if (args.length !== 1 || (iface && NON_MIGRABLE_IFACES.has(iface))) return null;

    const isDoc = isDomDocument(callee.getExpression());
    if (!isDoc && (!iface || !STANDARD_IFACES.has(iface))) return null;

    const { outer, parent } = getSemanticParent(call);
    const isDirectMember =
      Node.isPropertyAccessExpression(parent) || Node.isElementAccessExpression(parent);
    const accessedProp =
      isDirectMember && parent.getExpression() === outer ? getReferenceName(parent) : null;
    if (accessedProp && !INIT_EVENT_RE.test(accessedProp)) return null;

    const assignedTarget = getAssignedTargetInfo(outer);
    const scope = call.getFirstAncestor(isCallableNode) ?? sourceFile;
    const assignedName = assignedTarget?.name ?? null;
    const hasVarInit = Boolean(
      assignedName &&
        scope.getDescendantsOfKind(SyntaxKind.CallExpression).some((desc) => {
          if (desc.getStart() <= call.getStart()) return false;
          const descCallee = unwrapExpression(desc.getExpression());
          if (!Node.isPropertyAccessExpression(descCallee) && !Node.isElementAccessExpression(descCallee)) {
            return false;
          }
          if (getReferenceName(descCallee.getExpression()) !== assignedName) return false;
          const methodName = getReferenceName(descCallee);
          return methodName ? INIT_EVENT_RE.test(methodName) : isDoc && Node.isElementAccessExpression(descCallee);
        }),
    );

    if (
      (!accessedProp && !hasVarInit) ||
      isInsideEventPolyfill(call, scope, iface, assignedTarget) ||
      hasModernEventFallback(call)
    ) {
      return null;
    }

    const target = (iface && CTOR_MSG[iface]) ?? 'new Event(type, { bubbles, cancelable })';
    return `Legacy DOM createEvent() + init*Event() sequence can be replaced with ${target}.`;
  },
});

export const jsCreateEventRule: AnalyzerRule = {
  id: 'js/create-event',
  guideId: 'js',
  guideHash: JS_GUIDE_HASH,
  summary: 'Replace legacy document.createEvent() + init*Event() sequences with standard Event constructors.',
  matcher: jsCreateEventMatcher,
  verifierRubric: {
    keepWhen: ['Legacy DOM document.createEvent(...) constructs a synthetic DOM event followed by .initEvent(), .initCustomEvent(), .initMouseEvent(), .initKeyboardEvent(), .initUIEvent(), or .initMessageEvent() where standard Event constructors preserve behavior.'],
    dropWhen: [
      'TouchEvent probes in try/catch blocks, removed MutationEvent / Gecko KeyEvents interfaces, or uninitialized capability/prototype probes (.timeStamp, .__proto__, .code checks, wrapper calls).',
      'Feature-guarded fallback branches (if/else, ternaries, try/catch around Event constructors) or Event/CustomEvent constructor polyfills.',
      'Non-DOM .createEvent(...) APIs (calendar, emitter, log helpers) rather than a DOM document or paired .init*Event() sequence.',
      'Code assigning read-only Event properties in strict mode (event.srcElement = ..., event.target = ...), passing non-EventTarget values as relatedTarget in MouseEventInit, or requiring legacy keyCode/charCode semantics.',
    ],
  },
};

export default [jsCreateEventRule] satisfies readonly AnalyzerRule[];
