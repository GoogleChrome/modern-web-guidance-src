import {
  Node,
  SyntaxKind,
  type CallExpression,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
  resolveLocalExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const ANIMATE_TO_FROM_TOP_LAYER_GUIDE_HASH = '4dfb9d341374';

const TOP_LAYER_GUARD_TOKENS = [
  '@starting-style',
  'starting-style',
  'allow-discrete',
  'transition-behavior',
  'overlay',
  'canTransitionDisplay',
] as const;

const TOP_LAYER_CONTEXT_REGEX =
  /\b(?:dialog|modal|popover|closing|is-closing|data-closing)\b/i;

function isGuardedByTopLayerSupport(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, TOP_LAYER_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        TOP_LAYER_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
        current.getExpression().getDescendantsOfKind(SyntaxKind.ExclamationToken).length > 0 &&
        node.getStart() >= current.getThenStatement().getStart() &&
        node.getEnd() <= current.getThenStatement().getEnd()
      ) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchTopLayerExitListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, [
    'animationend',
    'transitionend',
    'webkitAnimationEnd',
    'webkitTransitionEnd',
  ]);
  if (!listener) {
    return null;
  }

  const handlerNode = resolveCallableNode(listener.handlerNode);
  const handlerText = handlerNode.getText();

  const callsHidePopover = /\.hidePopover\s*\(/.test(handlerText);
  const callsDialogClose = /\.close\s*\(/.test(handlerText);

  if (!callsHidePopover && !callsDialogClose) {
    return null;
  }

  if (callsDialogClose && !callsHidePopover) {
    const targetText = listener.targetNode
      ? `${listener.targetNode.getText()} ${resolveLocalExpression(listener.targetNode, 2).getText()}`
      : '';
    if (
      !TOP_LAYER_CONTEXT_REGEX.test(targetText) &&
      !TOP_LAYER_CONTEXT_REGEX.test(handlerText)
    ) {
      return null;
    }
  }

  return `Imperative '${listener.eventName}' listener delaying .close() or .hidePopover() after exit animation can be modernized with CSS @starting-style, transition-behavior: allow-discrete, and overlay.`;
}

export const animateToFromTopLayerMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    ['animationend', 'transitionend', 'webkitAnimationEnd', 'webkitTransitionEnd'],
    ['close', 'hidePopover'],
  ],
  isGuarded: (node) => isGuardedByTopLayerSupport(node),
  matchCall: (node) => matchTopLayerExitListener(node),
});

export const animateToFromTopLayerRule: AnalyzerRule = {
  id: 'animate-to-from-top-layer',
  guideId: 'animate-to-from-top-layer',
  guideHash: ANIMATE_TO_FROM_TOP_LAYER_GUIDE_HASH,
  summary:
    'animationend and transitionend listeners on <dialog> or popover elements that call .close() or .hidePopover() after a closing class animation should be modernized with @starting-style, transition-behavior: allow-discrete, and overlay.',
  matcher: animateToFromTopLayerMatcher,
  verifierRubric: {
    keepWhen: [
      'An animationend or transitionend listener on a <dialog> or popover element calls .close() or .hidePopover() after a closing animation finishes.',
      'Double requestAnimationFrame or setTimeout(0) handlers toggle open/closing classes on top-layer dialog or popover elements.',
    ],
    dropWhen: [
      'The code is guarded by @starting-style, transition-behavior: allow-discrete, or overlay support checks.',
      'Transitions on persistent non-top-layer DOM elements, or Framer Motion / GSAP FLIP animations.',
    ],
  },
};

export default [
  animateToFromTopLayerRule,
] satisfies readonly AnalyzerRule[];
