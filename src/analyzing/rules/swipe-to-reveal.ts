import {
  Node,
  type SourceFile,
} from 'ts-morph';
import {
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

export const SWIPE_TO_REVEAL_GUIDE_HASH = '2890437c01db';

const SWIPE_MOVE_END_EVENTS = [
  'touchmove',
  'touchend',
  'pointermove',
  'pointerup',
] as const;

const HORIZONTAL_TRANSLATE_RE = /\btranslateX\s*\(|\btranslate3d\s*\(/i;

const HORIZONTAL_COORD_RE =
  /\b(?:clientX|pageX|screenX|deltaX|startX|initialX|touchStartX|diffX|offsetX|currentX|_startX|_currentX)\b/i;

const REMOVAL_IDENT_RE =
  /^(?:onDismiss|onRemove|onDelete|onSwipeToRemove|onSwipeDismiss|removeItem|deleteItem|dismissItem|handleDismiss|handleDelete|handleRemove)$/i;

const REVEAL_CONTEXT_RE =
  /\b(?:actionWidth|actionsWidth|panelWidth|menuWidth|revealWidth|maxSwipe|openOffset|snapOpen|isRevealed|swipeActions|actionButtons|trailingActions|leadingActions)\b/i;

const NAV_DRAWER_CARVEOUT_RE =
  /\b(?:sideNav|side-nav|navDrawer|nav-drawer|offcanvas|off-canvas|navigation-drawer|slideout)\b/i;

const CAROUSEL_OR_SLIDER_RE =
  /\b(?:carousel|swiper|slider|slideIndex|currentSlide|nextSlide|prevSlide|lightbox|gallery|multitrack)\b/i;

function fileCommitsSwipeRemoval(sourceFile: SourceFile): boolean {
  let hasRemoval = false;
  sourceFile.forEachDescendant((node) => {
    if (hasRemoval || !Node.isCallExpression(node)) {
      return;
    }
    const expr = unwrapExpression(node.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const method = expr.getName();
      const objText = expr.getExpression().getText();
      if (
        (method === 'remove' || method === 'removeChild') &&
        !objText.includes('classList') &&
        !objText.includes('EventListener')
      ) {
        hasRemoval = true;
      } else if (REMOVAL_IDENT_RE.test(method)) {
        hasRemoval = true;
      }
    } else if (Node.isIdentifier(expr) && REMOVAL_IDENT_RE.test(expr.getText())) {
      hasRemoval = true;
    }
  });
  return hasRemoval;
}

function handlerTranslatesHorizontally(handlerNode: Node): boolean {
  const text = handlerNode.getText();
  return HORIZONTAL_TRANSLATE_RE.test(text) && HORIZONTAL_COORD_RE.test(text);
}

export const swipeToRevealMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['translateX', 'translate3d'],
    ['touchmove', 'touchend', 'pointermove', 'pointerup'],
  ],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const content = ctx.fileContent;
    if (
      content.includes('scroll-snap-type') ||
      content.includes('scrollSnapType')
    ) {
      return [];
    }
    if (
      CAROUSEL_OR_SLIDER_RE.test(content) ||
      NAV_DRAWER_CARVEOUT_RE.test(content)
    ) {
      return [];
    }
    if (!REVEAL_CONTEXT_RE.test(content)) {
      return [];
    }
    // Disjoint from swipe-to-remove
    if (fileCommitsSwipeRemoval(sourceFile)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const reportedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      let handlerNode: Node | null = null;

      if (Node.isCallExpression(node)) {
        const listener = matchEventListenerCall(node, SWIPE_MOVE_END_EVENTS);
        if (listener) {
          handlerNode = listener.handlerNode;
        }
      } else if (
        Node.isMethodDeclaration(node) &&
        /(?:touch|pointer|swipe|update).*(?:move|end|up|$)/i.test(node.getName())
      ) {
        handlerNode = node;
      } else if (
        Node.isPropertyAssignment(node) &&
        /^on(?:TouchMove|TouchEnd|PointerMove|PointerUp)$/.test(node.getName())
      ) {
        const init = node.getInitializer();
        if (init) {
          handlerNode = resolveCallableNode(init);
        }
      }

      if (!handlerNode || !handlerTranslatesHorizontally(handlerNode)) {
        return;
      }

      const line = node.getStartLineNumber();
      if (reportedLines.has(line)) {
        return;
      }
      reportedLines.add(line);

      matches.push({
        line,
        message:
          'Manual horizontal touch/pointer translateX swipe-to-reveal gesture detected; wrap the foreground content and revealed action panel in a horizontal CSS Scroll Snap container (scroll-snap-type: x mandatory, overscroll-behavior: chain, scrollbar-width: none) so the browser handles momentum and snapping natively.',
      });
    });

    return matches;
  },
};

export const swipeToRevealRule: AnalyzerRule = {
  id: 'swipe-to-reveal',
  guideId: 'swipe-to-reveal',
  guideHash: SWIPE_TO_REVEAL_GUIDE_HASH,
  summary:
    'Manual horizontal touch/pointer translateX swipe-to-reveal action trays should be replaced with a CSS Scroll Snap container (scroll-snap-type: x mandatory, overscroll-behavior: chain).',
  matcher: swipeToRevealMatcher,
  verifierRubric: {
    keepWhen: [
      'A list row or content pane implements horizontal swipe-to-reveal by tracking touch/pointer clientX/pageX/deltaX coordinates and setting inline translateX(...) to snap open a secondary action button strip without automatically deleting the item.',
    ],
    dropWhen: [
      'Swipe-to-remove gestures that automatically delete or dismiss the item once swiped past a threshold.',
      'Off-canvas navigation drawers (sideNav, navDrawer, offcanvas) owned by navigation-drawer.',
      'Full-width image carousels, slide decks, range sliders, or timeline scrubbers.',
    ],
  },
};

export default [
  swipeToRevealRule,
] satisfies readonly AnalyzerRule[];
