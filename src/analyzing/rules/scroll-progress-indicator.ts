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
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
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

function computesScrollProgressRatio(text: string): boolean {
  const readsScrollOffset = /\b(?:scrollTop|scrollY|pageYOffset)\b/.test(text);
  const readsTotalHeight = /\b(?:scrollHeight|documentHeight|offsetHeight)\b/.test(
    text,
  );
  const readsViewportHeight = /\b(?:clientHeight|innerHeight)\b/.test(text);
  const hasSubtractionAndDivision = text.includes('-') && text.includes('/');

  return (
    readsScrollOffset &&
    readsTotalHeight &&
    readsViewportHeight &&
    hasSubtractionAndDivision
  );
}

function updatesProgressStyle(text: string): boolean {
  const setsStyleWidth = /\.style\.width\s*=/.test(text);
  const setsScale =
    /\.style\.(?:transform|scale)\s*=[\s\S]*?scale(?:X|3d)?\s*\(/.test(text);
  const setsProgressCustomProp =
    /\.style\.setProperty\s*\(\s*['"`]--[a-zA-Z0-9_-]*(?:scroll|progress)[a-zA-Z0-9_-]*['"`]/.test(
      text,
    );

  return setsStyleWidth || setsScale || setsProgressCustomProp;
}

function matchScrollProgressListener(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['scroll']);
  if (!listener) {
    return null;
  }

  const handlerNode = resolveCallableNode(listener.handlerNode);
  const handlerText = handlerNode.getText();

  if (!computesScrollProgressRatio(handlerText)) {
    return null;
  }

  if (!updatesProgressStyle(handlerText)) {
    return null;
  }

  return 'Scroll listener computing scroll progress ratio to update a progress bar can be modernized with CSS Scroll-Driven Animations (animation-timeline: scroll()).';
}

export const scrollProgressIndicatorMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['scrollHeight', 'documentHeight', 'offsetHeight'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByScrollTimelineSupport(node)) {
        return;
      }

      const message = matchScrollProgressListener(node);
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

export const scrollProgressIndicatorRule: AnalyzerRule = {
  id: 'scroll-progress-indicator',
  guideId: 'scroll-progress-indicator',
  guideHash: SCROLL_PROGRESS_INDICATOR_GUIDE_HASH,
  summary:
    'Scroll listeners computing (scrollTop / (scrollHeight - clientHeight)) to update progress bar width, scaleX(), or --scroll-progress should be modernized with CSS animation-timeline: scroll().',
  matcher: scrollProgressIndicatorMatcher,
  verifierRubric: {
    keepWhen: [
      'A scroll event listener calculates the scroll progress ratio (e.g. scrollTop / (scrollHeight - clientHeight) or scrollY / (scrollHeight - innerHeight)) and updates a progress bar element via style.width, style.transform = scaleX(...), or a --scroll-progress CSS custom property.',
    ],
    dropWhen: [
      'The listener is guarded by CSS.supports("animation-timeline", "scroll()").',
      'HTML <progress> form elements or file upload progress indicators unrelated to scroll progress.',
      'Infinite scroll pagination triggers or analytics scroll depth beacons.',
    ],
  },
};

export const scrollProgressIndicatorRules: readonly AnalyzerRule[] = [
  scrollProgressIndicatorRule,
];
