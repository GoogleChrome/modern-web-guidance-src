import {
  Node,
  SyntaxKind,
  type CallExpression,
} from 'ts-morph';
import {
  isLibraryReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';

export const INTERACTIONS_IN_COMPLEX_LAYOUTS_GUIDE_HASH = '4065b96e2365';

const FASTDOM_PACKAGES = ['fastdom'] as const;

const CONTAINMENT_GUARD_TOKENS = [
  'content-visibility',
  'contentVisibility',
  'contain-intrinsic-size',
  'containIntrinsicSize',
  'contain',
] as const;

const FASTDOM_METHODS: ReadonlySet<string> = new Set(['measure', 'mutate']);

function isGuardedByContainment(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, CONTAINMENT_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        CONTAINMENT_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
        current.getExpression().getDescendantsOfKind(SyntaxKind.ExclamationToken).length > 0 &&
        node.getStart() >= current.getThenStatement().getStart() &&
        node.getEnd() <= current.getThenStatement().getEnd()
      ) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function isFastdomReceiver(node: Node): boolean {
  if (
    isLibraryReference(node, 'fastdom', FASTDOM_PACKAGES) ||
    isLibraryReference(node, 'FastDom', FASTDOM_PACKAGES)
  ) {
    return true;
  }
  const resolved = resolveLocalExpression(node, 2);
  if (
    resolved !== unwrapExpression(node) &&
    (isLibraryReference(resolved, 'fastdom', FASTDOM_PACKAGES) ||
      isLibraryReference(resolved, 'FastDom', FASTDOM_PACKAGES))
  ) {
    return true;
  }
  if (Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (
      Node.isPropertyAccessExpression(callee) &&
      callee.getName() === 'extend' &&
      isLibraryReference(callee.getExpression(), 'fastdom', FASTDOM_PACKAGES)
    ) {
      return true;
    }
  }
  return false;
}

function matchFastdomCall(callExpr: CallExpression): string | null {
  if (callExpr.getArguments().length === 0) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());

  if (Node.isPropertyAccessExpression(callee)) {
    const methodName = callee.getName();
    if (FASTDOM_METHODS.has(methodName) && isFastdomReceiver(callee.getExpression())) {
      return `fastdom.${methodName}() layout read/write batching can be modernized with CSS content-visibility: auto and contain-intrinsic-size containment boundaries.`;
    }
  }

  if (Node.isIdentifier(callee)) {
    const methodName = callee.getText();
    if (
      FASTDOM_METHODS.has(methodName) &&
      isLibraryReference(callee, methodName, FASTDOM_PACKAGES, {
        allowDefaultImport: false,
        allowGlobal: false,
      })
    ) {
      return `fastdom.${methodName}() layout read/write batching can be modernized with CSS content-visibility: auto and contain-intrinsic-size containment boundaries.`;
    }
  }

  return null;
}

export const interactionsInComplexLayoutsPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    FASTDOM_PACKAGES,
    (pkgName, versionRange) =>
      `Layout read/write batching dependency "${pkgName}" (${versionRange}) can be modernized with CSS content-visibility: auto and contain-intrinsic-size containment boundaries.`,
  );

export const interactionsInComplexLayoutsJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['fastdom', 'FastDom', 'measure', 'mutate'],
  isGuarded: (node) => isGuardedByContainment(node),
  matchCall: (node) => matchFastdomCall(node),
});

export const interactionsInComplexLayoutsPackageRule: AnalyzerRule = {
  id: 'interactions-in-complex-layouts/package-fastdom',
  guideId: 'interactions-in-complex-layouts',
  guideHash: INTERACTIONS_IN_COMPLEX_LAYOUTS_GUIDE_HASH,
  summary:
    'FastDom dependency (fastdom) for read/write layout batching can be modernized with CSS content-visibility: auto and contain-intrinsic-size.',
  matcher: interactionsInComplexLayoutsPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares fastdom in package.json dependencies to batch DOM read/write operations and prevent whole-page layout thrashing.',
    ],
    dropWhen: [
      'Stylesheets already declare contain: layout, contain: content, content-visibility: auto, or contain-intrinsic-size.',
      'Virtual list scrolling or permanent element hiding for tabs or modals.',
    ],
  },
};

export const interactionsInComplexLayoutsJsRule: AnalyzerRule = {
  id: 'interactions-in-complex-layouts/js-fastdom',
  guideId: 'interactions-in-complex-layouts',
  guideHash: INTERACTIONS_IN_COMPLEX_LAYOUTS_GUIDE_HASH,
  summary:
    'JavaScript fastdom.measure() and fastdom.mutate() calls mitigating whole-page layout thrashing should be modernized with CSS content-visibility: auto.',
  matcher: interactionsInComplexLayoutsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls fastdom.measure(...) or fastdom.mutate(...) to queue DOM geometry reads and writes and avoid whole-page layout reflow.',
      'JavaScript detaches elements or toggles display: none during bulk DOM updates solely to prevent whole-page layout thrashing.',
    ],
    dropWhen: [
      'The call is guarded by CSS.supports("content-visibility", "auto") or CSS.supports("contain", "layout").',
      'Stylesheets already declare contain: layout / contain: content / contain-intrinsic-size.',
      'Permanent element hiding for tabs/modals or virtual list scrolling.',
    ],
  },
};

export default [
  interactionsInComplexLayoutsPackageRule,
  interactionsInComplexLayoutsJsRule,
] satisfies readonly AnalyzerRule[];
