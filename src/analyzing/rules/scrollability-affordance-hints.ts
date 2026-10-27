import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
} from 'ts-morph';
import {
  isDomClassOrAttrMutation,
  isGlobalReference,
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLLABILITY_AFFORDANCE_HINTS_GUIDE_HASH = '8f04677e7be3';

const SCROLL_STATE_GUARD_TOKENS = [
  'scroll-state',
  'container-type',
] as const;

const AFFORDANCE_CLASS_REGEX =
  /['"`](?:has-scroll|has-scroll-left|has-scroll-right|has-scroll-top|has-scroll-bottom|is-scrollable|can-scroll|can-scroll-left|can-scroll-right|can-scroll-up|can-scroll-down|has-overflow|scrolled-down|scroll-shadow|overflow-left|overflow-right|overflow-top|overflow-bottom|overflowing|scrollable)['"`]/i;

function isGuardedByScrollState(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, SCROLL_STATE_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        SCROLL_STATE_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function hasScrollabilityGeometryCheck(handlerText: string): boolean {
  const hasHorizontalCheck =
    /\bscrollWidth\b/.test(handlerText) &&
    /\bclientWidth\b/.test(handlerText) &&
    (/\bscrollLeft\b/.test(handlerText) ||
      /scrollWidth\s*>\s*[a-zA-Z0-9_$.]+\.clientWidth/.test(handlerText));

  const hasVerticalCheck =
    /\bscrollHeight\b/.test(handlerText) &&
    /\bclientHeight\b/.test(handlerText) &&
    (/\bscrollTop\b/.test(handlerText) ||
      /scrollHeight\s*>\s*[a-zA-Z0-9_$.]+\.clientHeight/.test(handlerText));

  return hasHorizontalCheck || hasVerticalCheck;
}

function inspectScrollabilityHandler(handlerNode: Node): boolean {
  const resolved = resolveCallableNode(handlerNode);
  if (!isDomClassOrAttrMutation(resolved)) {
    return false;
  }
  const text = resolved.getText();
  if (!AFFORDANCE_CLASS_REGEX.test(text)) {
    return false;
  }
  return hasScrollabilityGeometryCheck(text);
}

function matchScrollabilityListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['scroll', 'resize']);
  if (!listener) {
    return null;
  }

  if (!inspectScrollabilityHandler(listener.handlerNode)) {
    return null;
  }

  return `Imperative '${listener.eventName}' listener comparing scroll geometry to toggle scrollability affordance classes can be modernized with CSS container-type: scroll-state and @container scroll-state(scrollable: ...).`;
}

function matchScrollabilityResizeObserver(newExpr: NewExpression): string | null {
  const callee = unwrapExpression(newExpr.getExpression());
  if (!isGlobalReference(callee, 'ResizeObserver')) {
    return null;
  }

  const firstArg = newExpr.getArguments()[0];
  if (!firstArg || !inspectScrollabilityHandler(firstArg)) {
    return null;
  }

  return 'ResizeObserver comparing scrollWidth/clientWidth or scrollHeight/clientHeight to toggle overflow affordance classes can be modernized with CSS @container scroll-state(scrollable: ...).';
}

export const scrollabilityAffordanceHintsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['scrollWidth', 'scrollHeight'],
  isGuarded: (node) => isGuardedByScrollState(node),
  matchCall: matchScrollabilityListener,
  matchNew: matchScrollabilityResizeObserver,
});

export const scrollabilityAffordanceHintsRule: AnalyzerRule = {
  id: 'scrollability-affordance-hints',
  guideId: 'scrollability-affordance-hints',
  guideHash: SCROLLABILITY_AFFORDANCE_HINTS_GUIDE_HASH,
  summary:
    'Scroll and ResizeObserver listeners comparing scrollLeft/scrollWidth/clientWidth or scrollTop/scrollHeight/clientHeight to toggle overflow shadow classes should be modernized with @container scroll-state(scrollable: ...).',
  matcher: scrollabilityAffordanceHintsMatcher,
  verifierRubric: {
    keepWhen: [
      'A scroll or ResizeObserver listener compares scrollLeft, scrollWidth, and clientWidth (or scrollTop, scrollHeight, and clientHeight) to toggle overflow shadow or scrollability affordance classes such as has-scroll-left, has-scroll-right, is-scrollable, can-scroll, or has-overflow.',
      'Dynamic CSS mask or shadow fade classes are toggled by scroll boundary checks.',
    ],
    dropWhen: [
      'The code is guarded by CSS.supports("container-type", "scroll-state").',
      'Standard container size queries (@container (min-width: ...)) or custom scrollbar styling (scrollbar-width: thin).',
      'Infinite scroll pagination triggers or chat auto-scroll-to-bottom logic.',
    ],
  },
};

export const scrollabilityAffordanceHintsRules: readonly AnalyzerRule[] = [
  scrollabilityAffordanceHintsRule,
];
