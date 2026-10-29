import {
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const EFFICIENT_BACKGROUND_PROCESSING_GUIDE_HASH = 'c1c31bb3c3a4';

const AUTO_STATE_CHANGE_GUARD_TOKENS = [
  'contentvisibilityautostatechange',
  'ContentVisibilityAutoStateChangeEvent',
] as const;

const INTERSECTION_CHECK_RE = /\b(?:isIntersecting|intersectionRatio)\b/;

const LOOP_PAUSE_RE =
  /\b(?:cancelAnimationFrame|clearInterval)\s*\(/;

const LOOP_RESUME_RE =
  /\b(?:requestAnimationFrame|setInterval)\s*\(/;

const DISQUALIFYING_CALLBACK_RE =
  /\.(?:classList|src|srcset|poster|dataSrc)\b|dataset\.(?:src|srcset|poster)/;

function matchLoopPauseObserver(
  newExpr: NewExpression,
  sourceFile: SourceFile,
): string | null {
  const fileText = sourceFile.getFullText();
  if (fileText.includes('contentvisibilityautostatechange')) {
    return null;
  }

  const callee = unwrapExpression(newExpr.getExpression());
  if (!isGlobalReference(callee, 'IntersectionObserver')) {
    return null;
  }

  const args = newExpr.getArguments();
  if (args.length === 0 || !args[0]) {
    return null;
  }

  const callbackNode = resolveCallableNode(args[0], 2);
  const callbackText = callbackNode.getText();

  if (!INTERSECTION_CHECK_RE.test(callbackText)) {
    return null;
  }
  if (DISQUALIFYING_CALLBACK_RE.test(callbackText)) {
    return null;
  }
  const hasPause = LOOP_PAUSE_RE.test(callbackText);
  const hasResume = LOOP_RESUME_RE.test(callbackText);
  if (!hasPause && !hasResume) {
    return null;
  }

  return 'IntersectionObserver used to pause or resume requestAnimationFrame / setInterval background processing when off-screen; pair CSS content-visibility: auto with a contentvisibilityautostatechange listener (event.skipped) so background loops sync with the browser rendering lifecycle.';
}

export const efficientBackgroundProcessingMatcher: JsRuleMatcher =
  createJsCallMatcher({
    fastTokens: [
      ['IntersectionObserver'],
      ['isIntersecting', 'intersectionRatio'],
      ['requestAnimationFrame', 'cancelAnimationFrame', 'setInterval', 'clearInterval'],
    ],
    isGuarded: (node) =>
      isProtectedByFeatureGuard(node, AUTO_STATE_CHANGE_GUARD_TOKENS),
    matchNew: (node, sourceFile) => matchLoopPauseObserver(node, sourceFile),
  });

export const efficientBackgroundProcessingRule: AnalyzerRule = {
  id: 'efficient-background-processing',
  guideId: 'efficient-background-processing',
  guideHash: EFFICIENT_BACKGROUND_PROCESSING_GUIDE_HASH,
  summary:
    'IntersectionObserver callbacks pausing/resuming requestAnimationFrame or setInterval loops when off-screen should be modernized with CSS content-visibility: auto and contentvisibilityautostatechange.',
  matcher: efficientBackgroundProcessingMatcher,
  verifierRubric: {
    keepWhen: [
      'An IntersectionObserver callback checks entry.isIntersecting to start, stop, pause, or resume continuous background loops (requestAnimationFrame / cancelAnimationFrame or setInterval / clearInterval) for off-screen components such as <canvas>, WebGL, or live data widgets.',
    ],
    dropWhen: [
      'The code already listens to contentvisibilityautostatechange and uses IntersectionObserver only as a progressive-enhancement fallback.',
      'One-shot lazy loading of images, <video>/<audio> media elements, or scroll-triggered CSS entrance animations.',
    ],
  },
};

export default [
  efficientBackgroundProcessingRule,
] satisfies readonly AnalyzerRule[];
