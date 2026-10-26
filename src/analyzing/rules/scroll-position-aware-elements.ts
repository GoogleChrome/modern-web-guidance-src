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

const POSITIONED_OR_HEADER_TARGET_REGEX =
  /header|navbar|\bnav\b|topbar|top[-_]bar|masthead|logo|brand|fixed[-_]?top|fixed[-_]?bottom|sticky[-_]?top|sticky[-_]?bottom|\bfixed\b|\bsticky\b|\baffix\b|back[-_]?to[-_]?top|scroll[-_]?to[-_]?top|go[-_]?to[-_]?top|\btotop\b|\bgotop\b/i;
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

function isScrollOffsetReadNode(node: Node): boolean {
  const parent = node.getParent();
  if (
    parent &&
    Node.isBinaryExpression(parent) &&
    parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
    parent.getLeft() === node
  ) {
    return false;
  }

  if (Node.isIdentifier(node)) {
    if (parent && Node.isPropertyAccessExpression(parent) && parent.getNameNode() === node) {
      return false;
    }
    return SCROLL_OFFSET_PROPERTIES.has(node.getText());
  }

  if (Node.isPropertyAccessExpression(node)) {
    if (parent && Node.isCallExpression(parent) && parent.getExpression() === node) {
      return false;
    }
    if (SCROLL_OFFSET_PROPERTIES.has(node.getName())) {
      return true;
    }
    // jQuery $navbar.offset().top
    if (node.getName() === 'top') {
      const expr = unwrapExpression(node.getExpression());
      if (Node.isCallExpression(expr)) {
        const callee = unwrapExpression(expr.getExpression());
        if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'offset') {
          return true;
        }
      }
    }
    return false;
  }

  // jQuery $(window).scrollTop() or $(this).scrollTop() getter (0 arguments)
  if (Node.isCallExpression(node) && node.getArguments().length === 0) {
    const expr = unwrapExpression(node.getExpression());
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'scrollTop') {
      return true;
    }
  }

  return false;
}

function subtreeReadsScrollOffset(root: Node): boolean {
  if (isScrollOffsetReadNode(root)) {
    return true;
  }
  let found = false;
  root.forEachDescendant((node) => {
    if (!found && isScrollOffsetReadNode(node)) {
      found = true;
    }
  });
  return found;
}

function findPriorAssignmentRhs(
  handlerNode: Node,
  identifierName: string,
  beforePos: number,
): Node | null {
  let latestRhs: Node | null = null;
  handlerNode.forEachDescendant((node) => {
    if (
      Node.isBinaryExpression(node) &&
      node.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
      node.getStart() < beforePos
    ) {
      const left = unwrapExpression(node.getLeft());
      if (Node.isIdentifier(left) && left.getText() === identifierName) {
        latestRhs = node.getRight();
      }
    }
  });
  return latestRhs;
}

function identifierRepresentsScrollOffset(id: Node, handlerNode: Node): boolean {
  const parent = id.getParent();
  if (parent && Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) {
    return false;
  }
  const name = id.getText();
  const assignedRhs = findPriorAssignmentRhs(handlerNode, name, id.getStart());
  if (assignedRhs) {
    return subtreeReadsScrollOffset(assignedRhs);
  }
  const resolved = resolveLocalExpression(id, 2);
  if (resolved !== id) {
    return subtreeReadsScrollOffset(resolved);
  }
  return /scroll|pageyoffset|windowpos/i.test(name);
}

function operandRepresentsScrollOffset(operand: Node, handlerNode: Node): boolean {
  const unwrapped = unwrapExpression(operand);
  if (subtreeReadsScrollOffset(unwrapped)) {
    return true;
  }
  if (Node.isIdentifier(unwrapped) && identifierRepresentsScrollOffset(unwrapped, handlerNode)) {
    return true;
  }
  let found = false;
  unwrapped.forEachDescendant((node) => {
    if (!found && Node.isIdentifier(node) && identifierRepresentsScrollOffset(node, handlerNode)) {
      found = true;
    }
  });
  return found;
}

function handlerReadsScrollOffset(handlerNode: Node): boolean {
  return subtreeReadsScrollOffset(handlerNode);
}

function handlerHasScrollComparison(handlerNode: Node): boolean {
  let found = false;
  handlerNode.forEachDescendant((node) => {
    if (found) return;
    if (Node.isBinaryExpression(node)) {
      const op = node.getOperatorToken().getKind();
      if (
        COMPARISON_OPERATORS.has(op) &&
        (operandRepresentsScrollOffset(node.getLeft(), handlerNode) ||
          operandRepresentsScrollOffset(node.getRight(), handlerNode))
      ) {
        found = true;
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

function isInsideBoundingRectHelper(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      if (current.getText().includes('getBoundingClientRect')) {
        return true;
      }
      break;
    }
    current = current.getParent();
  }
  return false;
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

function getMutationTargetText(targetExpr: Node): string {
  let base = unwrapExpression(targetExpr);
  if (
    Node.isPropertyAccessExpression(base) &&
    (base.getName() === 'classList' || base.getName() === 'style')
  ) {
    base = unwrapExpression(base.getExpression());
  }
  const resolved = resolveLocalExpression(base, 2);
  return resolved === base
    ? base.getText()
    : `${base.getText()} ${resolved.getText()}`;
}

function isPositionedOrHeaderTarget(targetExpr: Node): boolean {
  const targetText = getMutationTargetText(targetExpr);
  return (
    POSITIONED_OR_HEADER_TARGET_REGEX.test(targetText) &&
    !NOT_HEADER_REGEX.test(targetText)
  );
}

function handlerMutatesScrollStateOrSize(handlerNode: Node): boolean {
  // Reject lazy-loading, parallax, infinite scroll, or nav link href handlers
  const handlerText = handlerNode.getText();
  if (
    handlerText.includes('setAttribute(\'src\'') ||
    handlerText.includes('setAttribute("src"') ||
    handlerText.includes('data-parallax') ||
    handlerText.includes('getBoundingClientRect') ||
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
        const isPositionedTarget =
          Node.isPropertyAccessExpression(callee) &&
          isPositionedOrHeaderTarget(callee.getExpression());

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
            if (isPositionedTarget) {
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
          if (SIZE_STYLE_PROPERTIES.has(prop) && isPositionedOrHeaderTarget(expr)) {
            found = true;
            return;
          }
        }
      }
    }

    // jQuery .css('width', ...) or .css('height', ...) or .css('padding', ...)
    if (Node.isCallExpression(node)) {
      const expr = unwrapExpression(node.getExpression());
      if (
        Node.isPropertyAccessExpression(expr) &&
        expr.getName() === 'css' &&
        isPositionedOrHeaderTarget(expr.getExpression())
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

      if (isNestedInsideInteractionListener(rootNode) || isInsideBoundingRectHelper(rootNode)) {
        return;
      }

      const handler = resolveHandlerNode(rawHandlerNode);
      const effectiveNodes = getEffectiveHandlerNodes(handler, sourceFile);
      if (effectiveNodes.some((n) => n.getText().includes('getBoundingClientRect'))) {
        return;
      }

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
