import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type SourceFile,
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
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
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
  /\b(?:header|navbar|nav|sticky|topBar|topbar|masthead|appBar|banner)\b/i;

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
    /intersectionRatio\s*<\s*1|!\s*[a-zA-Z0-9_$.]+\.isIntersecting/.test(
      callbackText,
    );

  if (!hasThresholdOne && !checksRatioOrIntersecting) {
    return null;
  }

  return 'IntersectionObserver toggling stuck/pinned classes on a sticky header can be modernized with CSS container-type: scroll-state and @container scroll-state(stuck: top).';
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

  const checksStickyPosition =
    /getBoundingClientRect\s*\(\s*\)\s*\.top|scrollY|pageYOffset|scrollTop|offsetTop/.test(
      handlerText,
    );
  const referencesHeaderOrSticky =
    STICKY_HEADER_TARGET_REGEX.test(handlerText) ||
    (listener.targetNode !== undefined &&
      STICKY_HEADER_TARGET_REGEX.test(listener.targetNode.getText()));

  if (!checksStickyPosition && !referencesHeaderOrSticky) {
    return null;
  }

  return 'Scroll listener toggling stuck/pinned classes on a sticky header can be modernized with CSS container-type: scroll-state and @container scroll-state(stuck: top).';
}

export const stateAwareStickyHeadersMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'IntersectionObserver',
    'scroll',
    'is-stuck',
    'is-pinned',
    'stuck',
    'sticky-active',
  ],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (Node.isNewExpression(node)) {
        if (isGuardedByScrollStateSupport(node)) {
          return;
        }
        const message = matchStickyIntersectionObserver(node);
        if (message) {
          matches.push({
            line: node.getStartLineNumber(),
            message,
          });
        }
        return;
      }

      if (Node.isCallExpression(node)) {
        if (isGuardedByScrollStateSupport(node)) {
          return;
        }
        const message = matchStickyScrollListener(node);
        if (message) {
          matches.push({
            line: node.getStartLineNumber(),
            message,
          });
        }
      }
    });

    return matches;
  },
};

export const stateAwareStickyHeadersRule: AnalyzerRule = {
  id: 'state-aware-sticky-headers',
  guideId: 'state-aware-sticky-headers',
  guideHash: STATE_AWARE_STICKY_HEADERS_GUIDE_HASH,
  summary:
    'IntersectionObserver and scroll listeners toggling .is-stuck / .is-pinned / .stuck / .sticky-active classes on sticky headers should be modernized with @container scroll-state(stuck: top).',
  matcher: stateAwareStickyHeadersMatcher,
  phase2Rubric: {
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
