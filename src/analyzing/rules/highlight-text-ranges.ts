import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
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

export const HIGHLIGHT_TEXT_RANGES_GUIDE_HASH = '40fbfee1f408';

const MARKJS_PACKAGES = ['mark.js', 'markjs'] as const;

const HIGHLIGHT_GUARD_TOKENS = [
  'highlights',
  'Highlight',
  'HighlightRegistry',
] as const;

const MARK_METHODS = new Set(['mark', 'markRegExp', 'markRanges']);

function isMarkInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isNewExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isGlobalReference(callee, 'Mark')) {
      return true;
    }
  }
  return false;
}

function matchMarkJsCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  if (!MARK_METHODS.has(methodName)) {
    return null;
  }

  if (!isMarkInstance(callee.getExpression())) {
    return null;
  }

  return `new Mark().${methodName}() mutates DOM nodes to highlight text; modernize with the CSS Custom Highlight API (new Highlight(), CSS.highlights.set(), and ::highlight()).`;
}

export const highlightTextRangesPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: MARKJS_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy DOM text-highlighting package "${pkgName}" (${versionRange}) can be modernized with the native CSS Custom Highlight API (CSS.highlights and ::highlight()).`,
    };
  },
};

export const highlightTextRangesJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['Mark', 'mark', 'markRegExp'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, HIGHLIGHT_GUARD_TOKENS)) {
        return;
      }

      const msg = matchMarkJsCall(node);
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

export const highlightTextRangesPackageRule: AnalyzerRule = {
  id: 'highlight-text-ranges/package-markjs',
  guideId: 'highlight-text-ranges',
  guideHash: HIGHLIGHT_TEXT_RANGES_GUIDE_HASH,
  summary:
    'Legacy mark.js / markjs packages in package.json dependencies can be modernized with the native CSS Custom Highlight API (CSS.highlights and ::highlight()).',
  matcher: highlightTextRangesPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares mark.js or markjs in package.json dependencies to highlight search results or text ranges in the DOM.',
    ],
    dropWhen: [
      'The library is used strictly as a fallback when "highlights" in CSS or CSS.highlights is unsupported.',
      'The highlighting represents permanent semantic document markup (<mark>) rather than transient visual range highlighting.',
    ],
  },
};

export const highlightTextRangesJsRule: AnalyzerRule = {
  id: 'highlight-text-ranges/js-markjs',
  guideId: 'highlight-text-ranges',
  guideHash: HIGHLIGHT_TEXT_RANGES_GUIDE_HASH,
  summary:
    'JavaScript calls to new Mark(...).mark(...) or new Mark(...).markRegExp(...) should be modernized with the CSS Custom Highlight API (CSS.highlights).',
  matcher: highlightTextRangesJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript instantiates new Mark(...) and invokes .mark(...) or .markRegExp(...) to highlight text ranges by wrapping DOM nodes without a "highlights" in CSS guard.',
    ],
    dropWhen: [
      'The Mark.js call is inside a fallback branch guarded by "highlights" in CSS or CSS.highlights.',
      'The call is performance.mark() for User Timing API instrumentation rather than DOM text highlighting.',
    ],
  },
};

export const highlightTextRangesRules: readonly AnalyzerRule[] = [
  highlightTextRangesPackageRule,
  highlightTextRangesJsRule,
];
