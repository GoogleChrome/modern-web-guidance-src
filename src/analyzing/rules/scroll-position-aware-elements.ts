import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';
import {
  isDomClassOrAttrMutation,
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';

export const SCROLL_POSITION_AWARE_ELEMENTS_GUIDE_HASH = '0c1f852a4ed8';

const SCROLL_STATE_GUARD_TOKENS = ['scroll-state', 'container-type'] as const;
const SCROLL_OFFSET_PROPERTIES = new Set([
  'scrollY',
  'pageYOffset',
  'scrollTop',
]);

const SCROLL_STATE_CLASSES = new Set([
  'stuck',
  'is-stuck',
  'sticky',
  'is-sticky',
  'scrolled',
  'is-scrolled',
  'visible',
  'show',
  'show-back-to-top',
  'active',
  'hide',
  'hidden',
]);

const COMPARISON_OPERATORS = new Set([
  SyntaxKind.GreaterThanToken,
  SyntaxKind.GreaterThanEqualsToken,
  SyntaxKind.LessThanToken,
  SyntaxKind.LessThanEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
]);

function handlerReadsScrollOffset(handlerNode: Node): boolean {
  let found = false;
  handlerNode.forEachDescendant((node) => {
    if (found) return;

    if (Node.isIdentifier(node) && SCROLL_OFFSET_PROPERTIES.has(node.getText())) {
      found = true;
      return;
    }

    if (Node.isPropertyAccessExpression(node)) {
      if (SCROLL_OFFSET_PROPERTIES.has(node.getName())) {
        found = true;
        return;
      }
    }

    // jQuery $(window).scrollTop()
    if (Node.isCallExpression(node)) {
      const expr = unwrapExpression(node.getExpression());
      if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'scrollTop') {
        found = true;
      }
    }
  });
  return found;
}

function handlerHasScrollComparison(handlerNode: Node): boolean {
  let found = false;
  handlerNode.forEachDescendant((node) => {
    if (found) return;
    if (Node.isBinaryExpression(node)) {
      const op = node.getOperatorToken().getKind();
      if (COMPARISON_OPERATORS.has(op)) {
        const leftText = node.getLeft().getText();
        const rightText = node.getRight().getText();
        const mentionsScroll =
          leftText.includes('scroll') ||
          leftText.includes('pageYOffset') ||
          rightText.includes('scroll') ||
          rightText.includes('pageYOffset');
        if (mentionsScroll) {
          found = true;
        }
      }
    }
  });
  return found;
}

function resolveHandlerNode(handlerNode: Node): Node {
  let current = unwrapExpression(handlerNode);
  if (Node.isCallExpression(current)) {
    const expr = unwrapExpression(current.getExpression());
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'bind') {
      current = unwrapExpression(expr.getExpression());
    }
  }

  if (Node.isPropertyAccessExpression(current)) {
    const propName = current.getName();
    let parent: Node | undefined = current.getParent();
    while (parent && !Node.isSourceFile(parent)) {
      if (Node.isClassDeclaration(parent)) {
        const method = parent.getMethod(propName);
        if (method) {
          return method;
        }
      }
      parent = parent.getParent();
    }
  }

  return resolveCallableNode(current);
}

function handlerMutatesScrollStateClass(handlerNode: Node): boolean {
  // Reject lazy-loading, parallax, infinite scroll, or nav link href handlers
  const handlerText = handlerNode.getText();
  if (
    handlerText.includes('setAttribute(\'src\'') ||
    handlerText.includes('setAttribute("src"') ||
    handlerText.includes('data-parallax') ||
    handlerText.includes('fetchMore') ||
    handlerText.includes('loadMore') ||
    handlerText.includes('href')
  ) {
    return false;
  }

  let found = false;
  handlerNode.forEachDescendant((node) => {
    if (found) return;

    // Check classList / className / addClass / removeClass / toggleClass
    if (isDomClassOrAttrMutation(node)) {
      if (Node.isCallExpression(node)) {
        const args = node.getArguments();
        for (const arg of args) {
          const unwrapped = unwrapExpression(arg);
          if (Node.isStringLiteral(unwrapped)) {
            const cls = unwrapped.getLiteralText().toLowerCase().trim();
            for (const targetCls of SCROLL_STATE_CLASSES) {
              if (cls === targetCls || cls.includes(targetCls)) {
                found = true;
                return;
              }
            }
          }
        }
      }
      return;
    }

    // Direct style display / visibility / opacity mutation
    if (
      Node.isBinaryExpression(node) &&
      node.getOperatorToken().getKind() === SyntaxKind.EqualsToken
    ) {
      const left = unwrapExpression(node.getLeft());
      if (Node.isPropertyAccessExpression(left)) {
        const prop = left.getName();
        if (prop === 'display' || prop === 'visibility' || prop === 'opacity') {
          const expr = unwrapExpression(left.getExpression());
          if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'style') {
            found = true;
          }
        }
      }
    }
  });
  return found;
}

export const scrollPositionAwareElementsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'scroll',
    'scrollY',
    'pageYOffset',
    'scrollTop',
    'classList',
    'addClass',
    'toggleClass',
    'removeClass',
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];
    const reportedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      const scrollMatch = matchEventListenerCall(node, ['scroll']);
      if (!scrollMatch) {
        return;
      }

      if (isProtectedByFeatureGuard(node, SCROLL_STATE_GUARD_TOKENS)) {
        return;
      }

      const handler = resolveHandlerNode(scrollMatch.handlerNode);
      if (!handlerReadsScrollOffset(handler)) {
        return;
      }

      if (!handlerHasScrollComparison(handler)) {
        return;
      }

      if (!handlerMutatesScrollStateClass(handler)) {
        return;
      }

      const line = node.getStartLineNumber();
      if (!reportedLines.has(line)) {
        reportedLines.add(line);
        matches.push({
          line,
          message:
            'Imperative scroll listener comparing scroll offset to toggle visibility/sticky state classes; modernize using CSS container-scroll-state-queries (@container scroll-state(scrollable: top)).',
        });
      }
    });

    return matches;
  },
};

export const scrollPositionAwareElementsRule: AnalyzerRule = {
  id: 'scroll-position-aware-elements/js-scroll-listener',
  guideId: 'scroll-position-aware-elements',
  guideHash: SCROLL_POSITION_AWARE_ELEMENTS_GUIDE_HASH,
  summary:
    'Flag window/container scroll listeners reading scrollY or scrollTop to toggle CSS visibility or sticky state classes, which can be replaced by @container scroll-state(scrollable: top).',
  matcher: scrollPositionAwareElementsJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'Window or container scroll event listeners that read scrollY, pageYOffset, or scrollTop to toggle visibility or sticky state classes (.scrolled, .sticky, .is-stuck, .show-back-to-top) on floating buttons, back-to-top buttons, or headers.',
    ],
    dropWhen: [
      'Implementations using CSS scroll-state container queries (@container scroll-state(...)) or IntersectionObserver sentinels.',
      'Complex scroll-driven parallax or layout engines that interpolate continuous dimensions rather than toggling binary state classes.',
      'Infinite scroll or pagination handlers that trigger network requests when reaching scroll bounds.',
    ],
  },
};

/**
 * Opt-in only until re-measured: retired from default production scan per Slice 6 audit.
 */
export const scrollPositionAwareElementsRules: readonly AnalyzerRule[] = [];
