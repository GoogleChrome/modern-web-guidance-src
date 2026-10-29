import { Node, SyntaxKind, type CallExpression, type NewExpression, type SourceFile } from 'ts-morph';
import {
  matchEventListenerCall,
  resolveCallableNode,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CAROUSEL_SNAP_HIGHLIGHTS_GUIDE_HASH = '3bbd361aa904';

const CAROUSEL_CONTEXT_RE =
  /\b(carousel|slider|slides|slide|snap|snapped|gallery|swiper|reel|track)\b/i;

const ACTIVE_SNAP_CLASS_RE =
  /['"](is-snapped|snapped|active|is-active|current|is-current|selected|is-selected)['"]/;

const CLASS_MUTATION_RE =
  /\bclassList\s*\.\s*(add|remove|toggle)\b|\.\s*(addClass|removeClass|toggleClass)\s*\(|\bsetAttribute\s*\(\s*['"]aria-current['"]/;

// Carve-out patterns owned by other rules:
// - scrollspy: document section / TOC / navbar link highlighting
const SCROLLSPY_EXCLUSION_RE =
  /\b(scrollspy|scroll-spy|toc|table-of-contents|navbar|sidebar|heading|headings|current-section|active-link)\b|getAttribute\s*\(\s*['"]href['"]\s*\)|location\.hash/i;

// - state-aware-sticky-headers: sticky header sentinel observers
const STICKY_HEADER_EXCLUSION_RE =
  /\b(is-stuck|is-pinned|stuck|pinned|sticky-active|header-stuck|is-sticky|sentinel)\b/i;

// - scroll-entry-exit-effects: one-shot entry reveal observers
const REVEAL_EXCLUSION_RE =
  /\bunobserve\s*\(|['"](fade-in|visible|is-visible|in-view|animate|appear|revealed)['"]/;

// - scroll-snap-state-sync & scroll-snap-realtime-feedback:
//   Math.round(scrollLeft / clientWidth) or Math.abs(slide.offsetLeft - scrollLeft)
const SNAP_INDEX_DIVISION_RE =
  /\b(?:Math\.(?:round|floor|ceil)|parseInt)\s*\([^)]*\b(?:scrollLeft|scrollTop)\b[^)]*\/[^)]*\b(?:clientWidth|clientHeight|offsetWidth|offsetHeight|slideWidth|slideHeight|itemWidth|itemHeight|cardWidth|width|height)\b/;

const DISTANCE_MINIMIZATION_RE =
  /\bMath\.abs\s*\([^)]*\b(?:offsetLeft|offsetTop)\b[^)]*-\s*[^)]*\b(?:scrollLeft|scrollTop)\b|\bMath\.abs\s*\([^)]*\b(?:scrollLeft|scrollTop)\b[^)]*-\s*[^)]*\b(?:offsetLeft|offsetTop)\b/;

function isAlreadyModern(fileContent: string): boolean {
  return (
    fileContent.includes('scroll-state(') ||
    fileContent.includes('::scroll-marker') ||
    fileContent.includes(':target-current')
  );
}

function matchIntersectionObserver(
  newExpr: NewExpression,
): AnalyzerMatch | null {
  const exprText = newExpr.getExpression().getText();
  if (exprText !== 'IntersectionObserver' && exprText !== 'window.IntersectionObserver') {
    return null;
  }

  const firstArg = newExpr.getArguments()[0];
  if (!firstArg) return null;

  const callback = resolveCallableNode(firstArg);
  const callbackText = callback.getText();
  if (!/\b(isIntersecting|intersectionRatio)\b/.test(callbackText)) {
    return null;
  }

  if (!CLASS_MUTATION_RE.test(callbackText) || !ACTIVE_SNAP_CLASS_RE.test(callbackText)) {
    return null;
  }

  const enclosingFn =
    newExpr.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
    newExpr.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ??
    newExpr.getFirstAncestorByKind(SyntaxKind.FunctionExpression) ??
    newExpr.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
  const scopeText = (enclosingFn ?? newExpr.getParent() ?? newExpr).getText();

  if (!CAROUSEL_CONTEXT_RE.test(scopeText)) {
    return null;
  }

  if (
    SCROLLSPY_EXCLUSION_RE.test(scopeText) ||
    STICKY_HEADER_EXCLUSION_RE.test(scopeText) ||
    REVEAL_EXCLUSION_RE.test(callbackText)
  ) {
    return null;
  }

  return {
    line: newExpr.getStartLineNumber(),
    column: newExpr.getStartLinePos(),
    message:
      'IntersectionObserver toggling active/snapped classes on carousel slides or pagination dots; replace with CSS @container scroll-state(snapped: x) and ::scroll-marker:target-current.',
  };
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
  const listener = matchEventListenerCall(call, ['scroll', 'scrollend']);
  if (!listener) return null;

  const callbackText = expandHandlerText(listener.handlerNode);
  if (!CLASS_MUTATION_RE.test(callbackText) || !ACTIVE_SNAP_CLASS_RE.test(callbackText)) {
    return null;
  }

  // Must inspect slide/container bounding rect or horizontal scroll geometry
  if (!/\b(getBoundingClientRect|scrollLeft)\b/.test(callbackText)) {
    return null;
  }

  // Carve out scroll-snap-state-sync and scroll-snap-realtime-feedback
  if (
    SNAP_INDEX_DIVISION_RE.test(callbackText) ||
    DISTANCE_MINIMIZATION_RE.test(callbackText)
  ) {
    return null;
  }

  const scopeText = `${call.getText()}\n${callbackText}`;
  if (!CAROUSEL_CONTEXT_RE.test(scopeText)) {
    return null;
  }

  if (
    SCROLLSPY_EXCLUSION_RE.test(scopeText) ||
    STICKY_HEADER_EXCLUSION_RE.test(scopeText)
  ) {
    return null;
  }

  return {
    line: call.getStartLineNumber(),
    column: call.getStartLinePos(),
    message:
      'Scroll listener toggling active/snapped classes on carousel slides or pagination dots; replace with CSS @container scroll-state(snapped: x) and ::scroll-marker:target-current.',
  };
}

export const carouselSnapHighlightsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['IntersectionObserver', 'scroll', 'scrollend'],
    ['classList', 'addClass', 'removeClass', 'toggleClass', 'aria-current'],
    [
      'carousel',
      'Carousel',
      'slider',
      'Slider',
      'slides',
      'Slides',
      'slide',
      'Slide',
      'snap',
      'Snap',
      'gallery',
      'Gallery',
      'swiper',
      'Swiper',
      'reel',
      'Reel',
      'track',
      'Track',
    ],
  ] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (isAlreadyModern(ctx.fileContent)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const newExpr of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      const m = matchIntersectionObserver(newExpr);
      if (m && !seenLines.has(m.line)) {
        seenLines.add(m.line);
        matches.push(m);
      }
    }

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

export const carouselSnapHighlightsRule: AnalyzerRule = {
  id: 'carousel-snap-highlights',
  guideId: 'carousel-snap-highlights',
  guideHash: CAROUSEL_SNAP_HIGHLIGHTS_GUIDE_HASH,
  summary:
    'Detects IntersectionObserver or scroll listeners that toggle active/snapped classes on carousel slides or pagination dots instead of CSS @container scroll-state(snapped: x) and ::scroll-marker.',
  matcher: carouselSnapHighlightsMatcher,
  verifierRubric: {
    keepWhen: [
      'IntersectionObserver or scroll listener observing carousel/slider items and toggling an active, current, or is-snapped class on the centered slide or pagination dot',
    ],
    dropWhen: [
      'Document table-of-contents or navigation scrollspy highlighting section links during vertical page scroll',
      'One-time scroll-triggered entrance/reveal animation that unobserves elements after they enter the viewport',
      'Sticky header sentinel observer toggling a stuck/pinned class on a top bar',
    ],
  },
};

export default [carouselSnapHighlightsRule] satisfies readonly AnalyzerRule[];
