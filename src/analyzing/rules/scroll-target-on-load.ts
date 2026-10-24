import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLL_TARGET_ON_LOAD_GUIDE_HASH = 'fa7c8b4bb8fa';

const SCROLL_INITIAL_TARGET_GUARD_TOKENS = [
  'scroll-initial-target',
  'scrollInitialTarget',
] as const;

function isGuardedByScrollInitialTarget(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, SCROLL_INITIAL_TARGET_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        SCROLL_INITIAL_TARGET_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function isInsideNestedEventListener(callNode: Node, rootBoundary: Node): boolean {
  let current: Node | undefined = callNode.getParent();
  while (current && current !== rootBoundary) {
    if (Node.isCallExpression(current)) {
      const callee = unwrapExpression(current.getExpression());
      if (Node.isPropertyAccessExpression(callee)) {
        const propName = callee.getName();
        if (
          propName === 'addEventListener' ||
          propName === 'addListener' ||
          propName === 'attachEvent' ||
          propName === 'on' ||
          propName === 'one' ||
          propName === 'bind' ||
          propName === 'delegate' ||
          propName === 'live'
        ) {
          return true;
        }
      }
    } else if (Node.isBinaryExpression(current)) {
      if (current.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
        const leftText = current.getLeft().getText();
        if (/\.on[a-zA-Z]+$/.test(leftText)) {
          return true;
        }
      }
    }
    current = current.getParent();
  }
  return false;
}

function isCandidateScrollCall(node: Node): boolean {
  if (!Node.isCallExpression(node)) {
    return false;
  }
  const callee = unwrapExpression(node.getExpression());
  if (Node.isPropertyAccessExpression(callee)) {
    const propName = callee.getName();
    return propName === 'scrollIntoView' || propName === 'scrollTo';
  }
  if (Node.isIdentifier(callee)) {
    return callee.getText() === 'scrollTo';
  }
  return false;
}

function isSmoothScrollCall(callExpr: CallExpression): boolean {
  return /behavior\s*:\s*['"`]smooth['"`]/i.test(callExpr.getText());
}

function hasCustomOffsetCalculation(callExpr: CallExpression): boolean {
  const text = callExpr.getText();
  return (
    /(?:offsetTop|getBoundingClientRect\s*\(\s*\)\s*\.(?:top|y)|scrollY|pageYOffset)\s*[-+]/.test(
      text,
    ) || /[-+]\s*(?:header|nav|offset)/i.test(text)
  );
}

function matchScrollTargetOnLoadListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['DOMContentLoaded', 'load']);
  if (!listener) {
    return null;
  }

  const handlerNode = resolveCallableNode(listener.handlerNode);
  const handlerText = handlerNode.getText();

  if (
    SCROLL_INITIAL_TARGET_GUARD_TOKENS.some((tok) => handlerText.includes(tok))
  ) {
    return null;
  }

  const candidateCalls = handlerNode
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((candidate) => isCandidateScrollCall(candidate));

  if (candidateCalls.length === 0) {
    return null;
  }

  const validScrollCalls = candidateCalls.filter((candidate) => {
    if (isInsideNestedEventListener(candidate, handlerNode)) {
      return false;
    }
    if (isSmoothScrollCall(candidate)) {
      return false;
    }
    if (hasCustomOffsetCalculation(candidate)) {
      return false;
    }
    if (isGuardedByScrollInitialTarget(candidate)) {
      return false;
    }
    return true;
  });

  if (validScrollCalls.length === 0) {
    return null;
  }

  const readsLocationHash = /\blocation\.hash\b/.test(handlerText);
  const queriesTargetForScroll =
    /\b(?:querySelector|getElementById|getElementsByClassName)\s*\(/.test(
      handlerText,
    );

  if (!readsLocationHash && !queriesTargetForScroll) {
    return null;
  }

  return `Imperative '${listener.eventName}' listener performing instant initial target scrolling can be modernized with CSS scroll-initial-target: nearest (with @supports guard) or native fragment navigation.`;
}

export const scrollTargetOnLoadMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['scrollIntoView', 'scrollTo'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByScrollInitialTarget(node)) {
        return;
      }

      const message = matchScrollTargetOnLoadListener(node);
      if (message) {
        matches.push({
          line: node.getStartLineNumber(),
          message,
        });
      }
    });

    return matches;
  },
};

export const scrollTargetOnLoadRule: AnalyzerRule = {
  id: 'scroll-target-on-load',
  guideId: 'scroll-target-on-load',
  guideHash: SCROLL_TARGET_ON_LOAD_GUIDE_HASH,
  summary:
    'DOMContentLoaded and load listeners manually scrolling to an initial target via location.hash or scrollIntoView / window.scrollTo should be modernized with CSS scroll-initial-target: nearest.',
  matcher: scrollTargetOnLoadMatcher,
  phase2Rubric: {
    keepWhen: [
      'A DOMContentLoaded or load event listener reads location.hash or queries an initial target element and calls scrollIntoView() or window.scrollTo() on initial page load.',
      'useEffect / componentDidMount / DOMContentLoaded scrollIntoView() calls centering an initial tab, card, or chat item.',
    ],
    dropWhen: [
      'The listener is guarded by CSS.supports("scroll-initial-target", "nearest").',
      'The listener performs animated smooth scrolling (behavior: "smooth") or custom pixel header-offset arithmetic (e.g. el.offsetTop - 80) not supported by CSS scroll-initial-target: nearest.',
      'User click scroll transitions or runtime interactive navigation handlers.',
    ],
  },
};

export const scrollTargetOnLoadRules: readonly AnalyzerRule[] = [
  scrollTargetOnLoadRule,
];
