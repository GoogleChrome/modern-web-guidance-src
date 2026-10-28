import { Node, SyntaxKind, type CallExpression, type SourceFile } from 'ts-morph';
import { matchEventListenerCall, resolveCallableNode } from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CAROUSEL_SLIDE_EFFECTS_GUIDE_HASH = '2702432e2181';

const CAROUSEL_CONTEXT_RE =
  /\b(carousel|slider|slides|slide|coverflow|gallery|swiper|reel)\b/i;

const HORIZONTAL_GEOMETRY_RE =
  /\b(scrollLeft|offsetLeft|clientWidth|offsetWidth)\b|\.\s*(?:left|right|x)\b/;

const SLIDE_ITERATION_RE =
  /\b(forEach|for\s*\(|Array\.from)\b/;

const CONTINUOUS_STYLE_WRITE_RE =
  /\bstyle\s*\.\s*(?:transform|scale|opacity|filter)\s*=|\bstyle\s*\.\s*setProperty\s*\(|\.\s*currentTime\s*=/;

const INTERPOLATION_MATH_RE =
  /\bMath\.(?:abs|min|max|cos|sin|pow)\b|[*/]\s*(?:[0-9.]|[a-zA-Z_$])/;

const NON_CAROUSEL_EXCLUSION_RE =
  /\b(px_per_sec|playhead|wavescroll|audioContext|AudioContext|canvas|getContext|monaco|listView|virtual)\b/i;

function isAlreadyModern(fileContent: string): boolean {
  return (
    fileContent.includes('animation-timeline') ||
    fileContent.includes('view(inline') ||
    fileContent.includes('view(x')
  );
}

function expandHandlerText(handler: Node): string {
  const root = resolveCallableNode(handler);
  const rootText = root.getText();
  if (rootText.length > 350) {
    return rootText;
  }
  const parts = [rootText];
  const calls = [
    ...(Node.isCallExpression(root) ? [root] : []),
    ...root.getDescendantsOfKind(SyntaxKind.CallExpression).slice(0, 4),
  ];
  for (const call of calls) {
    const callee = resolveCallableNode(call.getExpression());
    if (callee !== call.getExpression()) {
      parts.push(callee.getText());
    }
    const firstArg = call.getArguments()[0];
    if (firstArg) {
      const resolvedArg = resolveCallableNode(firstArg);
      if (resolvedArg !== firstArg) {
        parts.push(resolvedArg.getText());
      }
    }
  }
  return parts.join('\n');
}

function matchScrollListener(
  call: CallExpression,
): AnalyzerMatch | null {
  const listener = matchEventListenerCall(call, ['scroll']);
  if (!listener) return null;

  const callbackText = expandHandlerText(listener.handlerNode);
  const fullScopeText = `${call.getText()}\n${callbackText}`;

  if (!CAROUSEL_CONTEXT_RE.test(fullScopeText)) {
    return null;
  }

  if (NON_CAROUSEL_EXCLUSION_RE.test(fullScopeText)) {
    return null;
  }

  if (
    !HORIZONTAL_GEOMETRY_RE.test(callbackText) ||
    !SLIDE_ITERATION_RE.test(callbackText) ||
    !CONTINUOUS_STYLE_WRITE_RE.test(callbackText) ||
    !INTERPOLATION_MATH_RE.test(callbackText)
  ) {
    return null;
  }

  return {
    line: call.getStartLineNumber(),
    column: call.getStartLinePos(),
    message:
      'Scroll listener computing per-slide transform, scale, or opacity from horizontal scroll geometry; replace with CSS animation-timeline: view(inline) and animation-range.',
  };
}

export const carouselSlideEffectsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['scroll'] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (isAlreadyModern(ctx.fileContent)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const m = matchScrollListener(call);
      if (m && !seenLines.has(m.line)) {
        seenLines.add(m.line);
        matches.push(m);
      }
    }

    return matches;
  },
};

export const carouselSlideEffectsRule: AnalyzerRule = {
  id: 'carousel-slide-effects',
  guideId: 'carousel-slide-effects',
  guideHash: CAROUSEL_SLIDE_EFFECTS_GUIDE_HASH,
  summary:
    'Detects scroll event listeners on carousels that loop over slides and compute inline transform/scale/opacity from getBoundingClientRect() or scrollLeft instead of CSS animation-timeline: view(inline).',
  matcher: carouselSlideEffectsMatcher,
  verifierRubric: {
    keepWhen: [
      'Scroll listener on a horizontal carousel or slider that iterates over slides and interpolates inline transform, scale, opacity, or Web Animations currentTime based on each slide position in the scrollport',
    ],
    dropWhen: [
      'Vertical page scroll parallax handler moving a hero background layer',
      'Discrete class toggle highlighting the active slide or pagination dot without continuous style interpolation',
      'Virtualized list or timeline canvas positioning rows',
    ],
  },
};

export default [carouselSlideEffectsRule] satisfies readonly AnalyzerRule[];
