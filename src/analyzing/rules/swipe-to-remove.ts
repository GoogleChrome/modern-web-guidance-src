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

export const SWIPE_TO_REMOVE_GUIDE_HASH = 'c58e8999adb0';

const SWIPE_MOVE_END_EVENTS = [
  'touchmove',
  'touchend',
  'pointermove',
  'pointerup',
] as const;

const HORIZONTAL_TRANSLATE_RE = /\btranslateX\s*\(|\btranslate3d\s*\(/i;

const HORIZONTAL_COORD_RE =
  /\b(?:clientX|pageX|screenX|deltaX|startX|initialX|touchStartX|diffX|offsetX|currentX|moveX)\b/i;

const REMOVAL_IDENT_RE =
  /^(?:onDismiss|onRemove|onDelete|onSwipeToRemove|onSwipeDismiss|removeItem|deleteItem|dismissItem|handleDismiss|handleDelete|handleRemove)$/i;

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

export const swipeToRemoveMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['translateX', 'translate3d'],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const content = ctx.fileContent;
    if (
      content.includes('scroll-snap-type') ||
      content.includes('scrollSnapType')
    ) {
      return [];
    }
    if (CAROUSEL_OR_SLIDER_RE.test(content)) {
      return [];
    }
    if (!fileCommitsSwipeRemoval(sourceFile)) {
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
        /(?:touch|pointer|swipe).*(?:move|end|up)/i.test(node.getName())
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
          'Manual horizontal touch/pointer translateX swipe-to-remove gesture detected; use a horizontal CSS Scroll Snap container (scroll-snap-type: x mandatory, overscroll-behavior-x: none, scrollbar-width: none) with an IntersectionObserver on the track so the browser handles momentum and snap physics natively.',
      });
    });

    return matches;
  },
};

export const swipeToRemoveRule: AnalyzerRule = {
  id: 'swipe-to-remove',
  guideId: 'swipe-to-remove',
  guideHash: SWIPE_TO_REMOVE_GUIDE_HASH,
  summary:
    'Manual horizontal touch/pointer translateX swipe-to-remove gestures should be replaced with a CSS Scroll Snap container (scroll-snap-type: x mandatory) and IntersectionObserver.',
  matcher: swipeToRemoveMatcher,
  verifierRubric: {
    keepWhen: [
      'A list item or card implements swipe-to-remove / swipe-to-dismiss by tracking horizontal touch or pointer coordinates (clientX, pageX, deltaX), applying inline translateX(...) / translate3d(...), and removing or dismissing the item past a threshold.',
    ],
    dropWhen: [
      'Swipe-to-reveal drawers or action strips that snap open to expose secondary action buttons without automatically removing or dismissing the item.',
      'Horizontal image carousels, slide decks, range sliders, or general 2D drag-and-drop reordering.',
    ],
  },
};

export default [
  swipeToRemoveRule,
] satisfies readonly AnalyzerRule[];
