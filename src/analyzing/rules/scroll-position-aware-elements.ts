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
  resolveLocalExpression,
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
  'fixed',
  'is-fixed',
  'nav-fixed',
  'fixed-header',
  'navbar-fixed-top',
  'fixed-top',
  'header-fixed',
  'top-nav-collapse',
  'navbar-shrink',
  'shrink',
  'shrunk',
  'shrinking',
  'small',
  'compact',
  'condensed',
  'reduced',
  'mini',
  'slim',
  'shadow',
  'shadow-sm',
  'custom-navigation-bar',
  'to-down',
  'page-loaded',
]);

const HEADER_TARGET_REGEX = /header|navbar|\bnav\b|topbar|top[-_]bar|masthead|logo|brand/i;
const NOT_HEADER_REGEX = /page[-_]?header|hero|banner|table|thead|\bth\b|card[-_]?header|modal[-_]?header|section[-_]?header|sidebar|sidenav|footer/i;

const SIZE_STYLE_PROPERTIES = new Set([
  'height',
  'minHeight',
  'maxHeight',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingBlock',
  'fontSize',
  'lineHeight',
  'width',
  'maxWidth',
  'marginTop',
  'transform',
]);

const JQUERY_SIZE_CSS_PROPERTIES = new Set([
  'height',
  'min-height',
  'max-height',
  'padding',
  'padding-top',
  'padding-bottom',
  'font-size',
  'line-height',
  'width',
  'max-width',
  'margin-top',
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
      // jQuery offset().top
      if (node.getName() === 'top') {
        const expr = unwrapExpression(node.getExpression());
        if (Node.isCallExpression(expr)) {
          const callee = unwrapExpression(expr.getExpression());
          if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'offset') {
            found = true;
            return;
          }
        }
      }
    }

    // jQuery $(window).scrollTop() or $(this).scrollTop()
    if (Node.isCallExpression(node)) {
      const expr = unwrapExpression(node.getExpression());
      if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'scrollTop') {
        found = true;
        return;
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
        const leftNode = resolveLocalExpression(node.getLeft(), 2);
        const rightNode = resolveLocalExpression(node.getRight(), 2);
        const leftText = leftNode.getText();
        const rightText = rightNode.getText();
        const mentionsScroll =
          leftText.includes('scroll') ||
          leftText.includes('pageYOffset') ||
          leftText.includes('windowpos') ||
          leftText.includes('position') ||
          rightText.includes('scroll') ||
          rightText.includes('pageYOffset') ||
          rightText.includes('windowpos') ||
          rightText.includes('position');
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

function getEffectiveHandlerNodes(handlerNode: Node, sourceFile: SourceFile): Node[] {
  const result: Node[] = [handlerNode];
  handlerNode.forEachDescendant((child) => {
    if (Node.isCallExpression(child)) {
      const expr = unwrapExpression(child.getExpression());
      if (Node.isIdentifier(expr)) {
        const fnName = expr.getText();
        if (
          !/^(if|for|while|switch|return|function|requestAnimationFrame|setTimeout|clearTimeout|alert|console)$/.test(
            fnName,
          )
        ) {
          const fnDecl = sourceFile.getFunction(fnName);
          if (fnDecl && !result.includes(fnDecl)) {
            result.push(fnDecl);
          } else {
            const varDecl = sourceFile.getVariableDeclaration(fnName);
            if (varDecl) {
              const init = varDecl.getInitializer();
              if (init && !result.includes(init)) {
                result.push(resolveCallableNode(init));
              }
            }
          }
        }
      }
    }
  });
  return result;
}

function isNestedInsideInteractionListener(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isCallExpression(current)) {
      const match = matchEventListenerCall(current, [
        'touchstart',
        'touchend',
        'touchmove',
        'click',
        'dblclick',
        'mousedown',
        'mouseup',
        'mousemove',
        'pointerdown',
        'pointerup',
        'pointermove',
        'keydown',
        'keyup',
        'keypress',
      ]);
      if (match) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function handlerMutatesScrollStateOrSize(handlerNode: Node): boolean {
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
        const callee = unwrapExpression(node.getExpression());
        let targetText = '';
        if (Node.isPropertyAccessExpression(callee)) {
          targetText = callee.getExpression().getText();
        }

        const isHeaderTarget =
          HEADER_TARGET_REGEX.test(targetText) && !NOT_HEADER_REGEX.test(targetText);

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
            if (isHeaderTarget) {
              found = true;
              return;
            }
          }
        }
      }
      return;
    }

    // Direct style display / visibility / opacity / size mutation
    if (
      Node.isBinaryExpression(node) &&
      node.getOperatorToken().getKind() === SyntaxKind.EqualsToken
    ) {
      const left = unwrapExpression(node.getLeft());
      if (Node.isPropertyAccessExpression(left)) {
        const prop = left.getName();
        const expr = unwrapExpression(left.getExpression());
        if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'style') {
          if (prop === 'display' || prop === 'visibility' || prop === 'opacity') {
            found = true;
            return;
          }
          if (SIZE_STYLE_PROPERTIES.has(prop)) {
            const targetText = expr.getExpression().getText();
            if (
              HEADER_TARGET_REGEX.test(targetText) &&
              !NOT_HEADER_REGEX.test(targetText)
            ) {
              found = true;
              return;
            }
          }
        }
      }
    }

    // jQuery .css('width', ...) or .css('height', ...) or .css('padding', ...)
    if (Node.isCallExpression(node)) {
      const expr = unwrapExpression(node.getExpression());
      if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'css') {
        const targetText = expr.getExpression().getText();
        if (
          HEADER_TARGET_REGEX.test(targetText) &&
          !NOT_HEADER_REGEX.test(targetText)
        ) {
          const args = node.getArguments();
          if (args.length > 0) {
            const firstArg = unwrapExpression(args[0]);
            if (Node.isStringLiteral(firstArg)) {
              const prop = firstArg.getLiteralText().toLowerCase().trim();
              if (JQUERY_SIZE_CSS_PROPERTIES.has(prop)) {
                found = true;
                return;
              }
            }
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
    'onscroll',
    'classList',
    'addClass',
    'toggleClass',
    'removeClass',
  ],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];
    const reportedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      let rawHandlerNode: Node | null = null;
      let rootNode: Node | null = null;

      // 1. Call expression: addEventListener('scroll', handler), $(window).scroll(handler), $(window).on('scroll', handler)
      if (Node.isCallExpression(node)) {
        const scrollMatch = matchEventListenerCall(node, ['scroll']);
        if (scrollMatch) {
          rootNode = node;
          rawHandlerNode = scrollMatch.handlerNode;
        }
      }

      // 2. Binary expression assignment: window.onscroll = handler, element.onscroll = handler
      if (
        !rootNode &&
        Node.isBinaryExpression(node) &&
        node.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      ) {
        const left = unwrapExpression(node.getLeft());
        if (Node.isPropertyAccessExpression(left) && left.getName() === 'onscroll') {
          rootNode = node;
          rawHandlerNode = resolveCallableNode(node.getRight());
        }
      }

      if (!rootNode || !rawHandlerNode) {
        return;
      }

      if (isProtectedByFeatureGuard(rootNode, SCROLL_STATE_GUARD_TOKENS)) {
        return;
      }

      if (isNestedInsideInteractionListener(rootNode)) {
        return;
      }

      const handler = resolveHandlerNode(rawHandlerNode);
      const effectiveNodes = getEffectiveHandlerNodes(handler, sourceFile);

      const hasOffset = effectiveNodes.some((n) => handlerReadsScrollOffset(n));
      if (!hasOffset) {
        return;
      }

      const hasComparison = effectiveNodes.some((n) => handlerHasScrollComparison(n));
      if (!hasComparison) {
        return;
      }

      const hasMutation = effectiveNodes.some((n) => handlerMutatesScrollStateOrSize(n));
      if (!hasMutation) {
        return;
      }

      const line = rootNode.getStartLineNumber();
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
  verifierRubric: {
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
export const scrollPositionAwareElementsRules: readonly AnalyzerRule[] = [
  scrollPositionAwareElementsRule,
];
