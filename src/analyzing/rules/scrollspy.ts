import {
  Node,
  SyntaxKind,
  type Identifier,
  type SourceFile,
} from 'ts-morph';
import {
  getAssignment,
  getMemberAccess,
  getStaticStringValue,
  isCallableScope,
  isProtectedByFeatureGuard,
  resolveCallableNode,
  resolveLexicalBinding,
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

export const SCROLLSPY_GUIDE_HASH = 'f7945559ec22';

const SCROLLSPY_FEATURE_TOKENS = [
  'scroll-target-group',
  'scrollTargetGroup',
  'target-current',
  ':target-current',
] as const;

const scrollspyDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector:
    '[data-spy="scroll"], [data-bs-spy="scroll"], [data-spy], [data-bs-spy], [class*="scrollspy"], [data-scrollspy]',
  fastTokens: ['data-spy', 'data-bs-spy', 'data-scrollspy', 'scrollspy', 'ScrollSpy', 'data-target', 'data-bs-target'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['data-spy', 'data-bs-spy'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    if (
      ctx.documentText.includes('scroll-target-group') ||
      ctx.documentText.includes(':target-current')
    ) {
      return null;
    }

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

function getEnclosingCallable(node: Node): Node | undefined {
  let curr = node.getParent();
  while (curr && !Node.isSourceFile(curr)) {
    if (isCallableScope(curr)) {
      return curr;
    }
    curr = curr.getParent();
  }
  return undefined;
}

function resolveScrollSpyDeclNode(idNode: Identifier): Node | undefined {
  const name = idNode.getText();
  const binding = resolveLexicalBinding(idNode, name);
  if (binding?.kind === 'function' || binding?.kind === 'variable') {
    return binding.node;
  }
  if (binding?.kind === 'other') {
    let curr: Node | undefined = idNode.getParent();
    while (curr) {
      if (Node.isBlock(curr) || Node.isSourceFile(curr)) {
        const cls = curr.getClass(name);
        if (cls) {
          return cls;
        }
      } else if (Node.isFunctionExpression(curr) && curr.getName() === name) {
        return curr;
      }
      curr = curr.getParent();
    }
  }
  return undefined;
}

function collectScrollSpyPluginDefScopes(sourceFile: SourceFile): Set<Node> {
  const scopes = new Set<Node>();

  for (const decl of sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
    if (
      decl.getName() === 'ScrollSpy' &&
      (decl.getMember('_jQueryInterface') ||
        decl.getMember('jQueryInterface') ||
        decl.getMember('DATA_KEY') ||
        decl.getMember('EVENT_KEY') ||
        decl.getMember('VERSION') ||
        (decl.getMember('refresh') && decl.getMember('activate')))
    ) {
      scopes.add(decl);
    }
  }

  for (const fn of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
    if (fn.getName() === 'ScrollSpy') {
      scopes.add(fn);
    }
  }

  for (const binExpr of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const assign = getAssignment(binExpr);
    if (!assign || assign.operator !== SyntaxKind.EqualsToken) {
      continue;
    }
    const outerMember = getMemberAccess(assign.left);
    if (!outerMember) {
      continue;
    }
    const outerName = outerMember.name;
    const lowerOuter = outerName.toLowerCase();
    const innerMember = getMemberAccess(outerMember.expression);
    const isJQueryPluginAssign =
      lowerOuter === 'scrollspy' && innerMember?.name === 'fn';
    const isJQueryInterfaceAssign =
      (outerName === '_jQueryInterface' || outerName === 'jQueryInterface') &&
      unwrapExpression(outerMember.expression).getText().endsWith('ScrollSpy');
    const isScrollSpyPrototypeAssign =
      innerMember?.name === 'prototype' &&
      unwrapExpression(innerMember.expression).getText().endsWith('ScrollSpy');
    const isScrollSpyConstructorAssign =
      (outerName === 'Constructor' || outerName === 'noConflict') &&
      innerMember?.name.toLowerCase() === 'scrollspy';

    if (
      isJQueryPluginAssign ||
      isJQueryInterfaceAssign ||
      isScrollSpyPrototypeAssign ||
      isScrollSpyConstructorAssign
    ) {
      const rhsCallable = resolveCallableNode(assign.right, 1);
      if (rhsCallable && isCallableScope(rhsCallable)) {
        scopes.add(rhsCallable);
      }

      if (
        isJQueryInterfaceAssign ||
        isScrollSpyPrototypeAssign ||
        isScrollSpyConstructorAssign
      ) {
        const targetExpr = unwrapExpression(
          isJQueryInterfaceAssign
            ? outerMember.expression
            : innerMember!.expression,
        );
        if (Node.isIdentifier(targetExpr)) {
          const declNode = resolveScrollSpyDeclNode(targetExpr);
          if (declNode) {
            scopes.add(declNode);
          }
        }
      }
    }
  }

  return scopes;
}

function isPluginDataApiAutoInit(
  callExpr: Node,
  pluginDefScopes: ReadonlySet<Node>,
): boolean {
  if (pluginDefScopes.size === 0 || !Node.isCallExpression(callExpr)) {
    return false;
  }
  const args = callExpr.getArguments();
  if (args.length !== 1) {
    return false;
  }
  const firstArg = unwrapExpression(args[0]);
  if (!Node.isCallExpression(firstArg)) {
    return false;
  }
  if (getMemberAccess(firstArg.getExpression())?.name !== 'data') {
    return false;
  }

  let curr: Node | undefined = callExpr.getParent();
  while (curr && !Node.isSourceFile(curr)) {
    if (Node.isCallExpression(curr)) {
      const expr = unwrapExpression(curr.getExpression());
      const receiver = Node.isPropertyAccessExpression(expr)
        ? unwrapExpression(expr.getExpression())
        : undefined;
      const selectorCall = receiver && Node.isCallExpression(receiver) ? receiver : curr;
      const selectorStr = getStaticStringValue(selectorCall.getArguments()[0]);
      if (selectorStr && /\[data-(?:bs-)?spy=['"]scroll['"]\]/.test(selectorStr)) {
        return true;
      }
    }
    curr = curr.getParent();
  }
  return false;
}

function isInsideAnyScope(node: Node, scopes: ReadonlySet<Node>): boolean {
  if (scopes.size === 0) {
    return false;
  }
  let curr: Node | undefined = node;
  while (curr) {
    if (scopes.has(curr)) {
      return true;
    }
    curr = curr.getParent();
  }
  return false;
}

function handlerPerformsImperativeScroll(handlerArg: Node): boolean {
  const resolved = resolveCallableNode(handlerArg, 3);
  let hasScrollEffect = false;

  resolved.forEachDescendant((desc, traversal) => {
    if (hasScrollEffect) {
      traversal.stop();
      return;
    }
    const assign = getAssignment(desc);
    if (assign) {
      const targetProp = getMemberAccess(assign.left)?.name;
      if (targetProp === 'scrollTop' || targetProp === 'scrollLeft') {
        hasScrollEffect = true;
        traversal.stop();
        return;
      }
    }
    if (Node.isCallExpression(desc)) {
      const expr = unwrapExpression(desc.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const name = expr.getName();
        if (
          name === 'scrollIntoView' ||
          name === 'scrollTo' ||
          name === 'scrollBy' ||
          ((name === 'scrollTop' || name === 'scrollLeft') && desc.getArguments().length >= 1)
        ) {
          hasScrollEffect = true;
          traversal.stop();
          return;
        }
        if (name === 'animate') {
          const firstArg = desc.getArguments()[0];
          if (firstArg && /\bscroll(?:Top|Left)\b/.test(firstArg.getText())) {
            hasScrollEffect = true;
            traversal.stop();
          }
        }
      }
    }
  });

  return hasScrollEffect;
}

function hasImperativeScrollSpyActivationSideEffects(node: Node): boolean {
  const scope = getEnclosingCallable(node);
  if (!scope) {
    return false;
  }

  let hasSideEffects = false;
  scope.forEachDescendant((desc, traversal) => {
    if (hasSideEffects) {
      traversal.stop();
      return;
    }
    if (!Node.isCallExpression(desc)) {
      return;
    }
    const expr = unwrapExpression(desc.getExpression());
    if (!Node.isPropertyAccessExpression(expr)) {
      return;
    }
    const methodName = expr.getName();
    if (methodName !== 'on' && methodName !== 'addEventListener') {
      return;
    }
    const args = desc.getArguments();
    if (args.length < 2) {
      return;
    }
    const evStr = getStaticStringValue(args[0]);
    if (!evStr || !evStr.toLowerCase().includes('activate.bs.scrollspy')) {
      return;
    }
    const handlerArg = methodName === 'on' ? args[args.length - 1] : args[1];
    if (handlerArg && handlerPerformsImperativeScroll(handlerArg)) {
      hasSideEffects = true;
      traversal.stop();
    }
  });

  return hasSideEffects;
}

function isScrollSpyPluginInvocation(node: Node, pluginDefScopes: ReadonlySet<Node>): boolean {
  if (isInsideAnyScope(node, pluginDefScopes)) {
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
        if (isPluginDataApiAutoInit(node, pluginDefScopes)) {
          return false;
        }
        return !hasImperativeScrollSpyActivationSideEffects(node);
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
      return !hasImperativeScrollSpyActivationSideEffects(node);
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
      const evStr = getStaticStringValue(args[0]);
      if (evStr !== null && evStr.toLowerCase() === 'scroll') {
        isScroll = true;
        handlerArg = args[1];
      }
    }
  } else if (methodName === 'on') {
    const args = node.getArguments();
    if (args.length >= 2) {
      const evStr = getStaticStringValue(args[0]);
      if (evStr !== null) {
        const eventTokens = evStr.toLowerCase().trim().split(/\s+/);
        const hasScrollToken = eventTokens.some(
          (tok) => tok === 'scroll' || tok.startsWith('scroll.'),
        );
        const hasResizeToken = eventTokens.some(
          (tok) => tok === 'resize' || tok.startsWith('resize.'),
        );
        if (hasScrollToken && !hasResizeToken) {
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
    ['scrollspy', 'ScrollSpy', 'IntersectionObserver', 'offsetTop', 'getBoundingClientRect'],
    ['scrollspy', 'ScrollSpy', 'active', 'aria-current', 'current', 'target-current'],
    ['scrollspy', 'ScrollSpy', 'nav', 'toc', 'menu', 'link', 'href', 'section'],
    ['scrollspy', 'ScrollSpy', 'classList', 'addClass', 'toggleClass', 'className', 'setAttribute', 'aria-current'],
  ],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
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
    const pluginDefScopes =
      ctx.fileContent.includes('scrollspy') || ctx.fileContent.includes('ScrollSpy')
        ? collectScrollSpyPluginDefScopes(sourceFile)
        : new Set<Node>();
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (
        !Node.isCallExpression(node) &&
        !Node.isNewExpression(node) &&
        !Node.isBinaryExpression(node)
      ) {
        return;
      }

      if (isScrollSpyPluginInvocation(node, pluginDefScopes)) {
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

export const scrollspyJsRule: AnalyzerRule = {
  id: 'scrollspy/js',
  guideId: 'scrollspy',
  guideHash: SCROLLSPY_GUIDE_HASH,
  summary:
    'Imperative scrollspy plugin calls, IntersectionObserver section watchers, and manual position scroll listeners should be modernized with CSS scroll-target-group: auto and :target-current.',
  matcher: scrollspyJsMatcher,
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
      'Third-party or bundled ScrollSpy plugin definitions (e.g. $.fn.scrollspy = ..., ScrollSpy.prototype, or ScrollSpy._jQueryInterface) rather than application usage.',
      'ScrollSpy setups that hook activate.bs.scrollspy or section-activation events to imperatively scroll a TOC container (e.g. setting scrollTop or calling scrollIntoView/scrollTo).',
      'Complex multi-container scroll coordinators or custom interactive graph navigators with non-linear section hierarchies that cannot map to fragment links.',
    ],
  },
};

export default [scrollspyRule, scrollspyJsRule] satisfies readonly AnalyzerRule[];
