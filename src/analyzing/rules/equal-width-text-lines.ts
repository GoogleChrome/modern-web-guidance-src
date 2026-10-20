import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
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

export const EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH = '1795916b979c';

const FITTEXT_PACKAGES = [
  'fitty',
  'fittext',
  'jquery-fittext',
  'react-fitty',
] as const;

function isFitTextCall(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (Node.isIdentifier(expr)) {
    const name = expr.getText();
    return name === 'fitty' || name === 'fitText' || name === 'fittext';
  }
  if (Node.isPropertyAccessExpression(expr)) {
    const name = expr.getName();
    return name === 'fitty' || name === 'fitText' || name === 'fittext';
  }
  return false;
}

export const equalWidthTextLinesPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: FITTEXT_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message:
        `Legacy text-fitting package "${pkgName}" (${versionRange}) can be modernized with native CSS text-fit: grow per-line-all.`,
    };
  },
};

export const equalWidthTextLinesJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['fitty', 'fitText', 'fittext'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (!isFitTextCall(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, ['text-fit'])) {
        return;
      }

      const callText = node.getExpression().getText();
      matches.push({
        line: node.getStartLineNumber(),
        message:
          `Imperative text-fitting script call "${callText}" can be modernized with native CSS text-fit: grow per-line-all.`,
      });
    });

    return matches;
  },
};

export const equalWidthTextLinesPackageRule: AnalyzerRule = {
  id: 'equal-width-text-lines/package-fittext',
  guideId: 'equal-width-text-lines',
  guideHash: EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH,
  summary:
    'Legacy text-fitting packages (fitty, fittext, jquery-fittext, react-fitty) in dependencies should be modernized with native CSS text-fit: grow per-line-all.',
  matcher: equalWidthTextLinesPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares fitty, fittext, jquery-fittext, or react-fitty in package.json dependencies to resize text lines to equal width.',
    ],
    dropWhen: [
      'The package is a dev-only tool or unrelated utility not used for heading line scaling.',
      'The text resizing is single-line container fitting covered by fit-text-to-container rather than multi-line equal-width headings.',
    ],
  },
};

export const equalWidthTextLinesJsRule: AnalyzerRule = {
  id: 'equal-width-text-lines/js-fittext',
  guideId: 'equal-width-text-lines',
  guideHash: EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH,
  summary:
    'Imperative text-fitting script calls (fitty, fitText, $.fitText) should be modernized with native CSS text-fit: grow per-line-all.',
  matcher: equalWidthTextLinesJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'Imperative JavaScript invokes fitty(), fitText(), or jQuery .fitText() to scale headline text lines to uniform container width without a CSS.supports("text-fit", ...) guard.',
      'A script dynamically computes font-size scaling factors across heading lines using clientWidth or offsetWidth measurements.',
    ],
    dropWhen: [
      'The call is guarded by CSS.supports("text-fit", ...) or a progressive enhancement fallback check.',
      'The script measures container aspect ratios or video dimensions rather than text typography lines.',
      'The sizing uses fluid viewport units (clamp, vw, cqi) without imperative line-scaling loops.',
    ],
  },
};

export const equalWidthTextLinesRules: readonly AnalyzerRule[] = [
  equalWidthTextLinesPackageRule,
  equalWidthTextLinesJsRule,
];
