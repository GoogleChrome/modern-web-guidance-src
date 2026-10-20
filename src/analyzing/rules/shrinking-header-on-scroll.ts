import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import {
  isDomClassOrAttrMutation,
  isProtectedByFeatureGuard,
  matchEventListenerCall,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SHRINKING_HEADER_ON_SCROLL_GUIDE_HASH = 'f8a8d28c8352';

const HEADROOM_PACKAGES = [
  'headroom.js',
  'react-headroom',
  'vue-headroom',
  'scroll-timeline-polyfill',
] as const;

const SCROLL_OFFSET_PROPERTIES = new Set([
  'scrollY',
  'pageYOffset',
  'scrollTop',
  'scrollHeight',
]);

const HEADER_NAME_REGEX = /\b(?:header|navbar|nav|menu)\b/i;
const HEADER_SELECTOR_REGEX = /(?:header|nav|\.navbar|\.header|\.main-nav|#header|#navbar)/i;

const SCROLL_HEADER_CLASSES = new Set([
  'shrink',
  'shrunk',
  'scrolled',
  'header-scrolled',
  'compact',
  'small',
  'sticky',
  'pinned',
  'unpinned',
  'is-sticky',
  'is-scrolled',
  'fixed-header',
]);

function handlerReadsScrollOffset(handlerNode: Node): boolean {
  let found = false;
  handlerNode.forEachDescendant((node) => {
    if (found) return;
    if (Node.isIdentifier(node) && SCROLL_OFFSET_PROPERTIES.has(node.getText())) {
      found = true;
      return;
    }
    if (
      Node.isPropertyAccessExpression(node) &&
      SCROLL_OFFSET_PROPERTIES.has(node.getName())
    ) {
      found = true;
      return;
    }
    if (Node.isCallExpression(node)) {
      const expr = unwrapExpression(node.getExpression());
      if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'scrollTop') {
        found = true;
      }
    }
  });
  return found;
}

function handlerTargetsHeader(handlerNode: Node, targetNode?: Node): boolean {
  if (targetNode && HEADER_NAME_REGEX.test(targetNode.getText())) {
    return true;
  }
  let found = false;
  handlerNode.forEachDescendant((node) => {
    if (found) return;
    if (Node.isIdentifier(node) && HEADER_NAME_REGEX.test(node.getText())) {
      found = true;
      return;
    }
    if (
      Node.isStringLiteral(node) &&
      HEADER_SELECTOR_REGEX.test(node.getLiteralText())
    ) {
      found = true;
      return;
    }
  });
  return found;
}

function handlerMutatesHeader(handlerNode: Node): boolean {
  let found = false;
  handlerNode.forEachDescendant((node) => {
    if (found) return;
    if (isDomClassOrAttrMutation(node)) {
      if (Node.isCallExpression(node)) {
        const args = node.getArguments();
        for (const arg of args) {
          const unwrapped = unwrapExpression(arg);
          if (Node.isStringLiteral(unwrapped)) {
            const cls = unwrapped.getLiteralText().toLowerCase();
            for (const targetCls of SCROLL_HEADER_CLASSES) {
              if (cls === targetCls || cls.includes(targetCls)) {
                found = true;
                return;
              }
            }
          }
        }
      }
      found = true;
      return;
    }

    if (
      Node.isBinaryExpression(node) &&
      node.getOperatorToken().getKind() === SyntaxKind.EqualsToken
    ) {
      const left = unwrapExpression(node.getLeft());
      if (Node.isPropertyAccessExpression(left)) {
        const prop = left.getName().toLowerCase();
        if (
          prop === 'height' ||
          prop === 'maxheight' ||
          prop === 'padding' ||
          prop === 'transform'
        ) {
          found = true;
          return;
        }
      }
    }
  });
  return found;
}

function isHeadroomInstantiation(node: Node): boolean {
  if (Node.isNewExpression(node) || Node.isCallExpression(node)) {
    const expr = unwrapExpression(node.getExpression());
    if (Node.isIdentifier(expr) && expr.getText() === 'Headroom') {
      return true;
    }
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'headroom') {
      return true;
    }
  }
  return false;
}

export const shrinkingHeaderPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: HEADROOM_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message:
        `Legacy scrolling header package or polyfill "${pkgName}" (${versionRange}) can be modernized with native CSS scroll-driven animations (animation-timeline: scroll()).`,
    };
  },
};

export const shrinkingHeaderJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['Headroom', 'headroom', 'scroll', 'onscroll'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      // 1. Headroom instantiations
      if (isHeadroomInstantiation(node)) {
        matches.push({
          line: node.getStartLineNumber(),
          message:
            'Headroom instance animates header on scroll; modernize with declarative CSS scroll-driven animations (animation-timeline: scroll()).',
        });
        return;
      }

      // 2. Scroll event listeners
      let handlerNode: Node | undefined;
      let targetNode: Node | undefined;

      if (Node.isCallExpression(node)) {
        const matched = matchEventListenerCall(node, ['scroll']);
        if (matched) {
          handlerNode = matched.handlerNode;
          targetNode = matched.targetNode;
        }
      } else if (
        Node.isBinaryExpression(node) &&
        node.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      ) {
        const left = unwrapExpression(node.getLeft());
        if (Node.isPropertyAccessExpression(left) && left.getName() === 'onscroll') {
          handlerNode = resolveCallableNode(node.getRight());
          targetNode = left.getExpression();
        }
      }

      if (!handlerNode) {
        return;
      }

      if (isProtectedByFeatureGuard(node, ['animation-timeline', 'scroll-timeline'])) {
        return;
      }

      if (
        handlerReadsScrollOffset(handlerNode) &&
        handlerTargetsHeader(handlerNode, targetNode) &&
        handlerMutatesHeader(handlerNode)
      ) {
        matches.push({
          line: node.getStartLineNumber(),
          message:
            'Imperative scroll listener animates header size on scroll; modernize with declarative CSS scroll-driven animations (animation-timeline: scroll()).',
        });
      }
    });

    return matches;
  },
};

export const shrinkingHeaderPackageRule: AnalyzerRule = {
  id: 'shrinking-header-on-scroll/package-scroll-timeline',
  guideId: 'shrinking-header-on-scroll',
  guideHash: SHRINKING_HEADER_ON_SCROLL_GUIDE_HASH,
  summary:
    'Legacy scrolling header libraries (headroom.js, react-headroom, scroll-timeline-polyfill) should be modernized with native CSS scroll-driven animations.',
  matcher: shrinkingHeaderPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares headroom.js, react-headroom, vue-headroom, or scroll-timeline-polyfill in package.json dependencies.',
    ],
    dropWhen: [
      'The package is a dev-only dependency not bundled into client-side navigation code.',
      'The header is a simple sticky element that does not animate height, padding, or transformation on scroll.',
    ],
  },
};

export const shrinkingHeaderJsRule: AnalyzerRule = {
  id: 'shrinking-header-on-scroll/js-header-scroll',
  guideId: 'shrinking-header-on-scroll',
  guideHash: SHRINKING_HEADER_ON_SCROLL_GUIDE_HASH,
  summary:
    'Imperative scroll listeners animating header/navbar dimensions on scroll should be modernized with declarative CSS animation-timeline: scroll().',
  matcher: shrinkingHeaderJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript instantiates new Headroom(...) or attaches a scroll listener that toggles shrink/scrolled classes or animates header dimensions based on scrollY/scrollTop.',
      'A script dynamically resizes a fixed or sticky navigation header as the user scrolls down the page without using CSS animation-timeline.',
    ],
    dropWhen: [
      'The scroll handler is protected by CSS.supports("(animation-timeline: scroll()) and (animation-range: 0% 100%)") as a progressive enhancement fallback.',
      'The scroll listener toggles a floating "back to top" button rather than animating a navigation header.',
      'The scroll listener implements infinite scrolling data fetching or scroll reading progress.',
      'The scroll listener highlights active table-of-contents navigation links (scrollspy).',
    ],
  },
};

export const shrinkingHeaderOnScrollRules: readonly AnalyzerRule[] = [
  shrinkingHeaderPackageRule,
  shrinkingHeaderJsRule,
];
