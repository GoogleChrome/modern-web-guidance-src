import {
  Node,
  SyntaxKind,
  type CallExpression,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLL_PROGRESS_INDICATOR_GUIDE_HASH = '069a0925b3ff';

const SCROLL_TIMELINE_GUARD_TOKENS = [
  'animation-timeline',
  'animationTimeline',
  'scroll-timeline',
  'scrollTimeline',
  'scroll()',
] as const;

function isGuardedByScrollTimelineSupport(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, SCROLL_TIMELINE_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        SCROLL_TIMELINE_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function computesScrollProgressRatio(rawText: string): boolean {
  const text = rawText.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  const readsScrollOffset = /\b(?:scrollTop|scrollY|pageYOffset)\b/.test(text);
  const readsTotalHeight =
    /\b(?:scrollHeight|documentHeight|offsetHeight)\b|\$\(\s*document\s*\)\.height\s*\(/.test(
      text,
    );
  const readsViewportHeight =
    /\b(?:clientHeight|innerHeight)\b|\$\(\s*window\s*\)\.height\s*\(/.test(
      text,
    );
  const hasSubtractionAndDivision = text.includes('-') && text.includes('/');

  return (
    readsScrollOffset &&
    readsTotalHeight &&
    readsViewportHeight &&
    hasSubtractionAndDivision
  );
}

function updatesProgressStyle(text: string): boolean {
  const setsStyleWidth =
    /\.style\.width\s*=/.test(text) ||
    /\.css\s*\(\s*['"`]width['"`]\s*,[^)]*%/.test(text);
  const setsScale =
    /\.style\.(?:transform|scale)\s*=[\s\S]*?scale(?:X|3d)?\s*\(/.test(text);
  const setsProgressCustomProp =
    /\.style\.setProperty\s*\(\s*['"`]--[a-zA-Z0-9_-]*(?:scroll|progress)[a-zA-Z0-9_-]*['"`]/.test(
      text,
    );

  return setsStyleWidth || setsScale || setsProgressCustomProp;
}

function updatesDomTextContent(text: string): boolean {
  return /\.(?:innerText|textContent|innerHTML)\s*=/.test(text);
}

function resolveScrollHandlerNode(callExpr: CallExpression): Node | null {
  const listener = matchEventListenerCall(callExpr, ['scroll']);
  if (listener) {
    return resolveCallableNode(listener.handlerNode);
  }

  const expr = callExpr.getExpression();
  const args = callExpr.getArguments();
  if (args.length === 1 && Node.isPropertyAccessExpression(expr)) {
    if (
      expr.getName() === 'scroll' &&
      /^(?:\$|jQuery)\s*\(/.test(expr.getExpression().getText())
    ) {
      return resolveCallableNode(args[0]!);
    }
  }

  const isRafCall =
    (Node.isIdentifier(expr) && expr.getText() === 'requestAnimationFrame') ||
    (Node.isPropertyAccessExpression(expr) &&
      expr.getName() === 'requestAnimationFrame');
  if (isRafCall && args.length >= 1 && Node.isIdentifier(args[0]!)) {
    const sfText = callExpr.getSourceFile().getFullText();
    if (/addEventListener\s*\(\s*['"`]scroll['"`]|\.onscroll\s*=/.test(sfText)) {
      return resolveCallableNode(args[0]!);
    }
  }

  return null;
}

function matchScrollProgressListener(callExpr: CallExpression): string | null {
  const handlerNode = resolveScrollHandlerNode(callExpr);
  if (!handlerNode) {
    return null;
  }

  const handlerText = handlerNode.getText();

  if (!computesScrollProgressRatio(handlerText)) {
    return null;
  }

  if (!updatesProgressStyle(handlerText)) {
    return null;
  }

  if (updatesDomTextContent(handlerText)) {
    return null;
  }

  return 'Scroll listener computing scroll progress ratio to update a progress bar can be modernized with CSS Scroll-Driven Animations (animation-timeline: scroll()).';
}

export const scrollProgressIndicatorMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['scrollHeight', 'documentHeight', 'offsetHeight', 'scrollTop'],
  isGuarded: (node) => isGuardedByScrollTimelineSupport(node),
  matchCall: (node) => matchScrollProgressListener(node),
});

export const scrollProgressIndicatorRule: AnalyzerRule = {
  id: 'scroll-progress-indicator',
  guideId: 'scroll-progress-indicator',
  guideHash: SCROLL_PROGRESS_INDICATOR_GUIDE_HASH,
  summary:
    'Scroll listeners computing (scrollTop / (scrollHeight - clientHeight)) to update progress bar width, scaleX(), or --scroll-progress should be modernized with CSS animation-timeline: scroll().',
  matcher: scrollProgressIndicatorMatcher,
  verifierRubric: {
    keepWhen: [
      'A scroll event listener calculates the scroll progress ratio (e.g. scrollTop / (scrollHeight - clientHeight) or scrollY / (scrollHeight - innerHeight)) and updates a progress bar element via style.width, .css("width", ...), style.transform = scaleX(...), or a --scroll-progress CSS custom property.',
    ],
    dropWhen: [
      'The listener is guarded by CSS.supports("animation-timeline", "scroll()").',
      'The scroll listener also formats and writes numeric scroll percentage text into DOM text nodes (e.g. .innerText = Math.round(scrollPercent) + "%"), which CSS animation-timeline: scroll() cannot replace.',
      'HTML <progress> form elements or file upload progress indicators unrelated to scroll progress.',
      'Infinite scroll pagination triggers or analytics scroll depth beacons.',
    ],
  },
};

export default [
  scrollProgressIndicatorRule,
] satisfies readonly AnalyzerRule[];
