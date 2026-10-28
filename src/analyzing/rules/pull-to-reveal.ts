import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isLibraryReference,
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

export const PULL_TO_REVEAL_GUIDE_HASH = 'f9c09a067f0a';

const PULL_TO_REVEAL_PACKAGES = [
  'pulltorefreshjs',
] as const;

const PULL_TO_REVEAL_FAST_TOKENS = [
  'PullToRefresh',
  'pulltorefreshjs',
  'pull-to-reveal',
  'pullToReveal',
] as const;

const PULL_TO_REVEAL_GUARD_TOKENS = [
  'scroll-initial-target',
  'scrollInitialTarget',
] as const;

export const pullToRevealPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    PULL_TO_REVEAL_PACKAGES,
    (packageName) =>
      `Pull-to-reveal / pull-to-refresh dependency "${packageName}" can be replaced with CSS scroll-initial-target: nearest and scroll-snap-type: y mandatory.`,
  );

function matchPullToRevealCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'init') {
    const receiver = unwrapExpression(callee.getExpression());
    if (isLibraryReference(receiver, 'PullToRefresh', ['pulltorefreshjs'])) {
      return 'PullToRefresh.init() can be replaced with CSS scroll-initial-target: nearest and scroll-snap-type: y mandatory to hide top controls above the scrollport on load.';
    }
  }

  return null;
}

export const pullToRevealJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: PULL_TO_REVEAL_FAST_TOKENS,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    for (const guard of PULL_TO_REVEAL_GUARD_TOKENS) {
      if (ctx.fileContent.includes(guard)) {
        return [];
      }
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const message = matchPullToRevealCall(callExpr);
      if (message !== null) {
        const line = callExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    return matches;
  },
};

export const pullToRevealPackageRule: AnalyzerRule = {
  id: 'pull-to-reveal/package-pull-to-reveal',
  guideId: 'pull-to-reveal',
  guideHash: PULL_TO_REVEAL_GUIDE_HASH,
  summary:
    'Pull-to-reveal / pull-to-refresh dependency (pulltorefreshjs) can be replaced with CSS scroll-initial-target: nearest and scroll-snap.',
  matcher: pullToRevealPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A package.json dependency or vendored library includes pulltorefreshjs to reveal a hidden top control when pulling down at the top of a scroll container.',
    ],
    dropWhen: [
      'The project already uses CSS scroll-initial-target: nearest.',
    ],
  },
};

export const pullToRevealRule: AnalyzerRule = {
  id: 'pull-to-reveal',
  guideId: 'pull-to-reveal',
  guideHash: PULL_TO_REVEAL_GUIDE_HASH,
  summary:
    'JavaScript PullToRefresh.init() calls can be replaced with CSS scroll-initial-target: nearest and scroll-snap-type: y mandatory.',
  matcher: pullToRevealJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls PullToRefresh.init() to reveal a top region or action bar when pulling down from the top of a scroll container.',
    ],
    dropWhen: [
      'The code already uses CSS scroll-initial-target: nearest or is a CSS.supports("scroll-initial-target", "nearest") progressive enhancement fallback.',
    ],
  },
};

export default [
  pullToRevealPackageRule,
  pullToRevealRule,
] satisfies readonly AnalyzerRule[];
