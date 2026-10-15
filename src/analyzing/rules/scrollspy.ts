import {
  Node,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
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

const scrollspyDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: '[data-spy="scroll"], [data-bs-spy="scroll"]',
  fastTokens: ['data-spy', 'data-bs-spy'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['data-spy', 'data-bs-spy'],
  matchElement: (element: DomElementView, _ctx: DomMatcherContext) => {
    const dataSpy = element.getAttribute('data-spy')?.toLowerCase().trim();
    const dataBsSpy = element.getAttribute('data-bs-spy')?.toLowerCase().trim();

    if (dataSpy !== 'scroll' && dataBsSpy !== 'scroll') {
      return null;
    }

    const attrName = dataBsSpy === 'scroll' ? 'data-bs-spy' : 'data-spy';
    return {
      message:
        `Legacy scrollspy attribute (${attrName}="scroll") tracks active sections imperatively; modernize with CSS scroll-target-group: auto and :target-current.`,
    };
  },
};

function isScrollSpyPluginInvocation(node: Node): boolean {
  if (Node.isCallExpression(node)) {
    const expr = unwrapExpression(node.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const name = expr.getName().toLowerCase();
      if (name === 'scrollspy') {
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
      if (
        Node.isStringLiteral(first) &&
        first.getLiteralText().toLowerCase().includes('scroll')
      ) {
        isScroll = true;
        handlerArg = args[args.length - 1];
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

  const handlerText = handlerArg.getText();
  const measuresPosition =
    handlerText.includes('offsetTop') ||
    handlerText.includes('getBoundingClientRect') ||
    handlerText.includes('scrollTop');
  const modifiesActiveNav =
    (handlerText.includes('active') || handlerText.includes('aria-current')) &&
    (handlerText.includes('nav') ||
      handlerText.includes('link') ||
      handlerText.includes('section') ||
      handlerText.includes('menu'));

  return measuresPosition && modifiesActiveNav;
}

const scrollspyJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['scrollspy', 'ScrollSpy', 'scroll'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (
        !Node.isCallExpression(node) &&
        !Node.isNewExpression(node)
      ) {
        return;
      }

      if (isProtectedByFeatureGuard(node, SCROLLSPY_FEATURE_TOKENS)) {
        return;
      }

      const line = node.getStartLineNumber();
      if (visitedLines.has(line)) {
        return;
      }

      if (isScrollSpyPluginInvocation(node)) {
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'Legacy scrollspy plugin invocation tracks active section imperatively; modernize with CSS scroll-target-group: auto and :target-current.',
        });
        return;
      }

      if (isScrollEventListenerMeasuringSections(node)) {
        visitedLines.add(line);
        matches.push({
          line,
          message:
            'Manual scroll listener calculates section positions to toggle active navigation state; modernize with CSS scroll-target-group: auto and :target-current.',
        });
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
  phase2Rubric: {
    keepWhen: [
      'DOM element specifies legacy Bootstrap data-spy="scroll" or data-bs-spy="scroll" attribute to highlight active navigation links based on scroll position.',
      'JavaScript initializes a scrollspy plugin via $(...).scrollspy(...) or new bootstrap.ScrollSpy(...).',
      'JavaScript scroll event listener measures section positions (offsetTop, getBoundingClientRect().top) to compute the active section and toggle "active" class or aria-current on navigation links.',
    ],
    dropWhen: [
      'The navigation container or stylesheet already implements CSS scroll-target-group: auto and :target-current.',
      'The scroll event listener handles unrelated scroll behaviors such as infinite scroll loading, scroll-to-top floating button visibility, parallax canvas animations, or reading progress bars.',
      'Complex multi-container scroll coordinators or custom interactive graph navigators with non-linear section hierarchies that cannot map to fragment links.',
    ],
  },
};

export const scrollspyJsRule: AnalyzerRule = {
  id: 'scrollspy/js',
  guideId: 'scrollspy',
  guideHash: SCROLLSPY_GUIDE_HASH,
  summary:
    'Imperative scrollspy plugin calls and manual section position scroll listeners should be modernized with CSS scroll-target-group: auto and :target-current.',
  matcher: scrollspyJsMatcher,
  phase2Rubric: scrollspyRule.phase2Rubric,
};

export const scrollspyRules: readonly AnalyzerRule[] = [
  scrollspyRule,
  scrollspyJsRule,
];
