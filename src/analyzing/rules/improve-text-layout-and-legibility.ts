import {
  Node,
  type CallExpression,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type SourceFile,
} from 'ts-morph';
import {
  isLibraryReference,
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH = '8f7dfdad123c';

const TEXT_BALANCE_PACKAGES = [
  'react-wrap-balancer',
  'balance-text',
  'vue-wrap-balancer',
] as const;

const TEXT_WRAP_GUARD_TOKENS = [
  'text-wrap',
  'textWrap',
] as const;

function matchBalanceTextCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  if (isLibraryReference(callee, 'balanceText', ['balance-text'])) {
    return 'balanceText() JavaScript line-balancing call can be modernized with native CSS text-wrap: balance and text-wrap: pretty.';
  }

  if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'balanceText') {
    const receiver = unwrapExpression(callee.getExpression());
    if (Node.isCallExpression(receiver)) {
      const fn = unwrapExpression(receiver.getExpression());
      if (
        Node.isIdentifier(fn) &&
        (fn.getText() === '$' || fn.getText() === 'jQuery')
      ) {
        return 'jQuery .balanceText() plugin call can be modernized with native CSS text-wrap: balance and text-wrap: pretty.';
      }
    }
  }

  return null;
}

function matchBalancerJsx(
  jsxNode: JsxOpeningElement | JsxSelfClosingElement,
): string | null {
  const tagNameNode = jsxNode.getTagNameNode();
  if (
    Node.isIdentifier(tagNameNode) &&
    isLibraryReference(
      tagNameNode,
      'Balancer',
      ['react-wrap-balancer', 'vue-wrap-balancer'],
      { allowGlobal: false },
    )
  ) {
    return '<Balancer> JavaScript text-wrapping component can be modernized with native CSS text-wrap: balance.';
  }
  return null;
}

export const improveTextLayoutAndLegibilityPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    TEXT_BALANCE_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy JavaScript text-balancing package "${pkgName}" (${versionRange}) can be modernized with native CSS text-wrap: balance and text-wrap: pretty.`,
  );

export const improveTextLayoutAndLegibilityJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['balanceText', 'Balancer'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (
        !Node.isCallExpression(node) &&
        !Node.isJsxOpeningElement(node) &&
        !Node.isJsxSelfClosingElement(node)
      ) {
        return;
      }

      if (isProtectedByFeatureGuard(node, TEXT_WRAP_GUARD_TOKENS)) {
        return;
      }

      const msg = Node.isCallExpression(node)
        ? matchBalanceTextCall(node)
        : matchBalancerJsx(node);

      if (msg) {
        matches.push({
          line: node.getStartLineNumber(),
          message: msg,
        });
      }
    });

    return matches;
  },
};

export const improveTextLayoutAndLegibilityPackageRule: AnalyzerRule = {
  id: 'improve-text-layout-and-legibility/package-text-balance',
  guideId: 'improve-text-layout-and-legibility',
  guideHash: IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH,
  summary:
    'Client-side text-balancing packages (react-wrap-balancer, balance-text) should be modernized with CSS text-wrap: balance and text-wrap: pretty.',
  matcher: improveTextLayoutAndLegibilityPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares react-wrap-balancer, balance-text, or vue-wrap-balancer in package.json dependencies to balance heading or paragraph line lengths.',
    ],
    dropWhen: [
      'The project already uses native CSS text-wrap: balance or text-wrap: pretty.',
      'The code performs server-side typographic preprocessing rather than client-side DOM line balancing.',
    ],
  },
};

export const improveTextLayoutAndLegibilityJsRule: AnalyzerRule = {
  id: 'improve-text-layout-and-legibility/js-text-balance',
  guideId: 'improve-text-layout-and-legibility',
  guideHash: IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH,
  summary:
    'JavaScript balanceText() calls and <Balancer> components should be modernized with native CSS text-wrap: balance and text-wrap: pretty.',
  matcher: improveTextLayoutAndLegibilityJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls balanceText(...) or renders <Balancer> from react-wrap-balancer to balance heading or text line breaks in the browser.',
    ],
    dropWhen: [
      'The balanceText() call is guarded by a CSS.supports("text-wrap", "balance") fallback check.',
      'The code uses native CSS text-wrap: balance / pretty or performs server-side typographic preprocessing.',
    ],
  },
};

export default [
  improveTextLayoutAndLegibilityPackageRule,
  improveTextLayoutAndLegibilityJsRule,
] satisfies readonly AnalyzerRule[];
