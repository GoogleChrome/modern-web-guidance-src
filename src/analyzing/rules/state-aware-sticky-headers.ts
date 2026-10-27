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
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const STATE_AWARE_STICKY_HEADERS_GUIDE_HASH = 'e9803becfae4';

const SCROLL_STATE_GUARD_TOKENS = [
  'scroll-state',
  'container-type',
] as const;

const STUCK_CLASS_REGEX =
  /['"`](?:is-stuck|is-pinned|stuck|sticky-active|header-stuck|is-sticky)['"`]/i;

const STICKY_HEADER_TARGET_REGEX =
  /(?:header|navbar|\bnav\b|sticky|topBar|topbar|masthead|appBar|banner)/i;

const DIRECTIONAL_HIDE_SHOW_REGEX =
  /\b(?:lastScroll|prevScroll|scrollUp|scrollDown|isHidden|header-hidden|headroom)\b/i;

function isGuardedByScrollStateSupport(node: Node): boolean {
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

function matchStickyIntersectionObserver(newExpr: NewExpression): string | null {
  const callee = unwrapExpression(newExpr.getExpression());
  if (!isGlobalReference(callee, 'IntersectionObserver')) {
    return null;
  }

  const args = newExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  const callbackNode = resolveCallableNode(args[0]);
  if (!isDomClassOrAttrMutation(callbackNode)) {
    return null;
  }

  const callbackText = callbackNode.getText();
  if (!STUCK_CLASS_REGEX.test(callbackText)) {
    return null;
  }

  const optionsText = args[1] ? resolveLocalExpression(args[1], 2).getText() : '';
  const hasThresholdOne = /threshold\s*:\s*(?:\[\s*1(?:\.0)?\s*\]|1(?:\.0)?\b)/.test(
    optionsText,
  );
  const checksRatioOrIntersecting =
    /intersectionRatio\s*<\s*1|!\s*[a-zA-Z0-9_$.]+\.isIntersecting|[a-zA-Z0-9_$.]+\.isIntersecting\s*===?\s*false/.test(
      callbackText,
    );

  if (!hasThresholdOne && !checksRatioOrIntersecting) {
    return null;
  }

  return 'IntersectionObserver toggling stuck/pinned classes on a sticky header can be modernized with CSS container-type: scroll-state and @container scroll-state(stuck: top).';
}

const ARBITRARY_PIXEL_SCROLL_THRESHOLD_REGEX =
  /(?:scrollY|pageYOffset|scrollTop(?:\s*\(\s*\))?)\s*(?:>=?|<=?|===?)\s*[1-9]\d*|[1-9]\d*\s*(?:<=?|>=?|===?)\s*(?:[a-zA-Z0-9_$.]+\.)?(?:scrollY|pageYOffset|scrollTop(?:\s*\(\s*\))?)/;

function hasStickyDockingMeasurement(handlerNode: Node): boolean {
  const handlerText = handlerNode.getText();
  if (
    /getBoundingClientRect\s*\(\s*\)\s*\.(?:top|y)\s*(?:<=?\s*0|===\s*0|<\s*1\b)/.test(
      handlerText,
    ) ||
    /\boffsetTop\b/.test(handlerText)
  ) {
    return true;
  }

  for (const ident of handlerNode.getDescendantsOfKind(SyntaxKind.Identifier)) {
    const resolved = resolveLocalExpression(ident, 2);
    if (resolved !== ident) {
      const resolvedText = resolved.getText();
      if (
        /\boffsetTop\b/.test(resolvedText) ||
        /getBoundingClientRect\s*\(\s*\)/.test(resolvedText)
      ) {
        return true;
      }
    }
  }

  return false;
}

function matchStickyScrollListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['scroll']);
  if (!listener) {
    return null;
  }

  const handlerNode = resolveCallableNode(listener.handlerNode);
  if (!isDomClassOrAttrMutation(handlerNode)) {
    return null;
  }

  const handlerText = handlerNode.getText();
  if (!STUCK_CLASS_REGEX.test(handlerText)) {
    return null;
  }

  if (DIRECTIONAL_HIDE_SHOW_REGEX.test(handlerText)) {
    return null;
  }

  if (ARBITRARY_PIXEL_SCROLL_THRESHOLD_REGEX.test(handlerText)) {
    return null;
  }

  const referencesHeaderOrSticky =
    STICKY_HEADER_TARGET_REGEX.test(handlerText) ||
    (listener.targetNode !== undefined &&
      STICKY_HEADER_TARGET_REGEX.test(listener.targetNode.getText()));

  if (!referencesHeaderOrSticky || !hasStickyDockingMeasurement(handlerNode)) {
    return null;
  }

  return 'Scroll listener toggling stuck/pinned classes on a sticky header can be modernized with CSS container-type: scroll-state and @container scroll-state(stuck: top).';
}

export const stateAwareStickyHeadersMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    'is-stuck',
    'is-pinned',
    'stuck',
    'sticky-active',
    'header-stuck',
    'is-sticky',
  ],
  isGuarded: (node) => isGuardedByScrollStateSupport(node),
  matchCall: matchStickyScrollListener,
  matchNew: matchStickyIntersectionObserver,
});

export const stateAwareStickyHeadersRule: AnalyzerRule = {
  id: 'state-aware-sticky-headers',
  guideId: 'state-aware-sticky-headers',
  guideHash: STATE_AWARE_STICKY_HEADERS_GUIDE_HASH,
  summary:
    'IntersectionObserver and scroll listeners toggling .is-stuck / .is-pinned / .stuck / .sticky-active classes on sticky headers should be modernized with @container scroll-state(stuck: top).',
  matcher: stateAwareStickyHeadersMatcher,
  verifierRubric: {
    keepWhen: [
      'An IntersectionObserver with threshold: [1] or checking intersectionRatio < 1 (or a 1px sentinel element) toggles .is-stuck, .is-pinned, .stuck, or .sticky-active when a sticky header docks.',
      'A scroll event listener compares header.getBoundingClientRect().top or scroll offset to toggle stuck/pinned styling classes on a sticky header.',
    ],
    dropWhen: [
      'The code is guarded by CSS.supports("container-type", "scroll-state").',
      'Static position: sticky headers with unchanging style.',
      'JavaScript-driven headers that hide on scroll down and show on scroll up.',
    ],
  },
};

export const stateAwareStickyHeadersRules: readonly AnalyzerRule[] = [
  stateAwareStickyHeadersRule,
];
