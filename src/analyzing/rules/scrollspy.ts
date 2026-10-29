import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SCROLLSPY_GUIDE_HASH = 'fffee90dc52d';

const SCROLLSPY_FEATURE_TOKENS = [
  'scroll-target-group',
  'scrollTargetGroup',
  'target-current',
  ':target-current',
] as const;

function isGuardedByScrollTargetGroup(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, SCROLLSPY_FEATURE_TOKENS)) {
    return true;
  }

  // Check if enclosing scope or if statement checks CSS.supports for scroll-target-group
  let curr: Node | undefined = node;
  while (curr && !Node.isSourceFile(curr)) {
    if (Node.isIfStatement(curr)) {
      const expr = unwrapExpression(curr.getExpression());
      const resolved = resolveLocalExpression(expr);
      const text = resolved.getText();
      if (text.includes('scroll-target-group') || text.includes('scrollTargetGroup')) {
        return true;
      }
    }
    curr = curr.getParent();
  }
  return false;
}

const scrollspyDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector:
    '[data-spy="scroll"], [data-bs-spy="scroll"], [data-spy], [data-bs-spy], [class*="scrollspy"], [data-scrollspy]',
  fastTokens: ['data-spy', 'data-bs-spy', 'scrollspy', 'data-target', 'data-bs-target'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['data-spy', 'data-bs-spy'],
  matchElement: (element: DomElementView, _ctx: DomMatcherContext) => {
    const dataSpy = element.getAttribute('data-spy')?.toLowerCase().trim();
    const dataBsSpy = element.getAttribute('data-bs-spy')?.toLowerCase().trim();

    if (dataSpy === 'scroll' || dataBsSpy === 'scroll') {
      const attrName = dataBsSpy === 'scroll' ? 'data-bs-spy' : 'data-spy';
      return {
        message:
          `Legacy scrollspy attribute (${attrName}="scroll") tracks active sections imperatively; modernize with CSS scroll-target-group: auto and :target-current.`,
      };
    }

    if (element.hasAttribute('data-scrollspy')) {
      return {
        message:
          'Legacy data-scrollspy attribute tracks active sections imperatively; modernize with CSS scroll-target-group: auto and :target-current.',
      };
    }

    const classAttr = element.getAttribute('class')?.toLowerCase() ?? '';
    const hasScrollSpyClass = classAttr.includes('scrollspy');
    const hasTargetAttr =
      element.hasAttribute('data-target') ||
      element.hasAttribute('data-bs-target');

    if (hasScrollSpyClass && (hasTargetAttr || element.hasAttribute('data-spy') || element.hasAttribute('data-bs-spy'))) {
      return {
        message:
          'Legacy scrollspy class and target attributes track navigation sections imperatively; modernize with CSS scroll-target-group: auto and :target-current.',
      };
    }

    return null;
  },
};

function getHandlerText(node: Node): string {
  const unwrapped = unwrapExpression(node);
  if (Node.isIdentifier(unwrapped)) {
    const resolved = resolveLocalExpression(unwrapped, 3);
    if (resolved !== unwrapped) {
      return resolved.getText();
    }
    const name = unwrapped.getText();
    const sourceFile = unwrapped.getSourceFile();
    const fnDecl = sourceFile.getFunction(name);
    if (fnDecl) {
      return fnDecl.getText();
    }
  }
  return unwrapped.getText();
}

function isScrollSpyPluginInvocation(node: Node): boolean {
  if (node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)?.getName() === 'ScrollSpy') {
    return false;
  }
  if (Node.isCallExpression(node)) {
    const expr = unwrapExpression(node.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const callerText = unwrapExpression(expr.getExpression()).getText();
      // Exclude UIkit.scrollspy
      if (callerText.includes('UIkit')) {
        return false;
      }

      const name = expr.getName().toLowerCase();
      if (name === 'scrollspy') {
        const args = node.getArguments();
        if (args.length > 0) {
          const firstArg = unwrapExpression(args[0]);
          // Reject string commands like 'refresh' or 'dispose'
          if (Node.isStringLiteral(firstArg)) {
            return false;
          }
          if (Node.isObjectLiteralExpression(firstArg)) {
            const text = firstArg.getText();
            // Reject non-nav plugins like thesmart jquery-scrollspy with min/max/onEnter/onLeave
            if (
              text.includes('onEnter') ||
              text.includes('onLeave') ||
              (text.includes('min:') && text.includes('max:')) ||
              text.includes('cls:')
            ) {
              return false;
            }
          }
        }
        return true;
      }
    }
  } else if (Node.isNewExpression(node)) {
    const expr = unwrapExpression(node.getExpression());
    const text = expr.getText();
    if (
      text === 'ScrollSpy' ||
      text.endsWith('.ScrollSpy') ||
      text === 'scrollspy' ||
      text.endsWith('.scrollspy')
    ) {
      return true;
    }
  }
  return false;
}

const SECTION_GEOMETRY_RE =
  /\b(?:offsetTop|getBoundingClientRect)\b|\.(?:offset|position)\s*\(/;

const DOM_ACTIVE_MUTATION_RE =
  /\b(?:classList\s*\.\s*(?:add|toggle)|addClass|toggleClass|className|setAttribute)\b|aria-current/;

function isHandlerMeasuringSections(handlerNode: Node): boolean {
  const handlerText = getHandlerText(handlerNode);
  const measuresSectionGeometry = SECTION_GEOMETRY_RE.test(handlerText);
  const mutatesDomActiveState = DOM_ACTIVE_MUTATION_RE.test(handlerText);

  const modifiesActiveNav =
    (handlerText.includes('active') ||
      handlerText.includes('aria-current') ||
      handlerText.includes('current')) &&
    (handlerText.includes('nav') ||
      handlerText.includes('link') ||
      handlerText.includes('section') ||
      handlerText.includes('menu') ||
      handlerText.includes('toc') ||
      handlerText.includes('href'));

  return measuresSectionGeometry && mutatesDomActiveState && modifiesActiveNav;
}

function isScrollEventListenerMeasuringSections(node: Node): boolean {
  if (!Node.isCallExpression(node)) {
    return false;
  }
  const expr = unwrapExpression(node.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  const methodName = expr.getName();

  let isScroll = false;
  let handlerArg: Node | undefined;

  if (methodName === 'addEventListener') {
    const args = node.getArguments();
    if (args.length >= 2) {
      const first = unwrapExpression(args[0] as Node);
      if (
        Node.isStringLiteral(first) &&
        first.getLiteralText().toLowerCase() === 'scroll'
      ) {
        isScroll = true;
        handlerArg = args[1];
      }
    }
  } else if (methodName === 'on') {
    const args = node.getArguments();
    if (args.length >= 2) {
      const first = unwrapExpression(args[0] as Node);
      if (Node.isStringLiteral(first)) {
        const evText = first.getLiteralText().toLowerCase();
        if (evText.includes('scroll') && !evText.includes('resize')) {
          isScroll = true;
          handlerArg = args[args.length - 1];
        }
      }
    }
  } else if (methodName === 'scroll') {
    const args = node.getArguments();
    if (args.length >= 1) {
      isScroll = true;
      handlerArg = args[0];
    }
  }

  if (!isScroll || !handlerArg) {
    return false;
  }

  return isHandlerMeasuringSections(handlerArg);
}

function isIntersectionObserverScrollSpy(node: Node): boolean {
  if (!Node.isNewExpression(node)) {
    return false;
  }
  const expr = unwrapExpression(node.getExpression());
  const exprText = expr.getText();
  if (
    exprText !== 'IntersectionObserver' &&
    !exprText.endsWith('.IntersectionObserver')
  ) {
    return false;
  }
  const args = node.getArguments();
  if (args.length === 0) {
    return false;
  }
  const cb = args[0] as Node;
  const cbText = getHandlerText(cb);

  // Reject simple image lazy loaders
  if (cbText.includes('lazy') || cbText.includes('.src =') || cbText.includes('dataset.src')) {
    return false;
  }

  const togglesActive =
    DOM_ACTIVE_MUTATION_RE.test(cbText) &&
    (cbText.includes('active') ||
      cbText.includes('aria-current') ||
      cbText.includes('target-current'));
  const targetsNavigation =
    cbText.includes('nav') ||
    cbText.includes('toc') ||
    cbText.includes('menu') ||
    cbText.includes('link') ||
    cbText.includes('href') ||
    cbText.includes('section');

  return togglesActive && targetsNavigation;
}

export const scrollspyJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'scrollspy',
    'ScrollSpy',
    'IntersectionObserver',
    'offsetTop',
    'getBoundingClientRect',
  ],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    // Skip jQuery scrollspy plugin definition files themselves
    if (/\$\.fn\.scrollspy\s*=/i.test(ctx.fileContent)) {
      return matches;
    }
    const hasPluginOrObserver =
      ctx.fileContent.includes('scrollspy') ||
      ctx.fileContent.includes('ScrollSpy') ||
      ctx.fileContent.includes('IntersectionObserver');
    const hasScrollActiveLoop =
      ctx.fileContent.includes('scroll') &&
      (ctx.fileContent.includes('active') ||
        ctx.fileContent.includes('aria-current') ||
        ctx.fileContent.includes('target-current'));
    if (!hasPluginOrObserver && !hasScrollActiveLoop) {
      return matches;
    }
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (
        !Node.isCallExpression(node) &&
        !Node.isNewExpression(node) &&
        !Node.isBinaryExpression(node)
      ) {
        return;
      }

      if (isScrollSpyPluginInvocation(node)) {
        const line = node.getStartLineNumber();
        if (visitedLines.has(line)) {
          return;
        }
        if (isGuardedByScrollTargetGroup(node)) {
          return;
        }
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'Legacy scrollspy plugin invocation tracks active section imperatively; modernize with CSS scroll-target-group: auto and :target-current.',
        });
        return;
      }

      if (isScrollEventListenerMeasuringSections(node)) {
        const line = node.getStartLineNumber();
        if (visitedLines.has(line)) {
          return;
        }
        if (isGuardedByScrollTargetGroup(node)) {
          return;
        }
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'Manual scroll listener calculates section positions to toggle active navigation state; modernize with CSS scroll-target-group: auto and :target-current.',
        });
        return;
      }

      if (isIntersectionObserverScrollSpy(node)) {
        const line = node.getStartLineNumber();
        if (visitedLines.has(line)) {
          return;
        }
        if (isGuardedByScrollTargetGroup(node)) {
          return;
        }
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'IntersectionObserver navigation callback toggles active link on section intersection; modernize with CSS scroll-target-group: auto and :target-current.',
        });
        return;
      }

      // Check window.onscroll = ... or el.onscroll = ...
      if (Node.isBinaryExpression(node)) {
        if (node.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
          const left = unwrapExpression(node.getLeft());
          if (
            Node.isPropertyAccessExpression(left) &&
            left.getName().toLowerCase() === 'onscroll'
          ) {
            const right = node.getRight();
            if (isHandlerMeasuringSections(right)) {
              const line = node.getStartLineNumber();
              if (visitedLines.has(line)) {
                return;
              }
              if (isGuardedByScrollTargetGroup(node)) {
                return;
              }
              visitedLines.add(line);
              matches.push({
                line,
                message:
                  'Manual onscroll assignment calculates section positions to toggle active navigation state; modernize with CSS scroll-target-group: auto and :target-current.',
              });
            }
          }
        }
      }
    });

    return matches;
  },
};

export const scrollspyRule: AnalyzerRule = {
  id: 'scrollspy',
  guideId: 'scrollspy',
  guideHash: SCROLLSPY_GUIDE_HASH,
  summary:
    'Legacy Bootstrap data-spy="scroll" or data-bs-spy="scroll" attributes should be modernized with CSS scroll-target-group: auto and :target-current.',
  matcher: scrollspyDomMatcher,
  verifierRubric: {
    keepWhen: [
      'DOM element specifies legacy Bootstrap data-spy="scroll" or data-bs-spy="scroll" attribute (or scrollspy classes with data-target/data-bs-target) to highlight active navigation links based on scroll position.',
      'JavaScript initializes a scrollspy plugin via $(...).scrollspy(...) or new bootstrap.ScrollSpy(...).',
      'JavaScript scroll event listener measures section positions (offsetTop, getBoundingClientRect().top, scrollY, pageYOffset) to compute the active section and toggle "active" class or aria-current on navigation links.',
      'IntersectionObserver callback tracks section visibility to toggle active or aria-current states on navigation or TOC links.',
    ],
    dropWhen: [
      'The navigation container or stylesheet already implements CSS scroll-target-group: auto and :target-current.',
      'The scroll event listener handles unrelated scroll behaviors such as infinite scroll loading, scroll-to-top floating button visibility, parallax canvas animations, or reading progress bars.',
      'IntersectionObserver is used for lazy loading images, infinite scrolling, or animation entry triggers without managing active navigation link state.',
      'Complex multi-container scroll coordinators or custom interactive graph navigators with non-linear section hierarchies that cannot map to fragment links.',
    ],
  },
};

export const scrollspyJsRule: AnalyzerRule = {
  id: 'scrollspy/js',
  guideId: 'scrollspy',
  guideHash: SCROLLSPY_GUIDE_HASH,
  summary:
    'Imperative scrollspy plugin calls, IntersectionObserver section watchers, and manual position scroll listeners should be modernized with CSS scroll-target-group: auto and :target-current.',
  matcher: scrollspyJsMatcher,
  verifierRubric: scrollspyRule.verifierRubric,
};

export default [scrollspyRule, scrollspyJsRule] satisfies readonly AnalyzerRule[];
