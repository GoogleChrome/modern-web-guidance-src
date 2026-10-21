import {
  Node,
  SyntaxKind,
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

export const EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH = '1795916b979c';

const FITTEXT_PACKAGES = [
  'fitty',
  'fittext',
  'jquery-fittext',
  'react-fitty',
] as const;

function isSingleLineOption(call: CallExpression): boolean {
  const optionsArg = call.getArguments()[1];
  if (!optionsArg) {
    return false;
  }
  const resolved = resolveLocalExpression(optionsArg, 2);
  if (!Node.isObjectLiteralExpression(resolved)) {
    return false;
  }
  const multiLineProp = resolved.getProperty('multiLine');
  if (multiLineProp && Node.isPropertyAssignment(multiLineProp)) {
    const init = multiLineProp.getInitializer();
    if (init && unwrapExpression(init).getKind() === SyntaxKind.FalseKeyword) {
      return true;
    }
  }
  return false;
}

function isFitTextCall(call: CallExpression, sourceFile: SourceFile): boolean {
  if (isSingleLineOption(call)) {
    return false;
  }
  const expr = unwrapExpression(call.getExpression());
  if (Node.isIdentifier(expr)) {
    const name = expr.getText();
    if (name !== 'fitty' && name !== 'fitText' && name !== 'fittext') {
      return false;
    }
    if (call.getArguments().length === 0) {
      return false;
    }
    if (!isGlobalReference(expr, name)) {
      const hasPkgImport = sourceFile.getImportDeclarations().some((imp) => {
        const spec = imp.getModuleSpecifierValue();
        return FITTEXT_PACKAGES.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`));
      });
      if (!hasPkgImport) {
        return false;
      }
    }
    return true;
  }
  if (Node.isPropertyAccessExpression(expr)) {
    const name = expr.getName();
    if (name !== 'fitty' && name !== 'fitText' && name !== 'fittext') {
      return false;
    }
    const target = unwrapExpression(expr.getExpression());
    // Skip zero-arg wrapper calls like `customScripts.fitText()` when the file defines its own `fitText` method wrapping `$(...).fitText(...)`
    if (
      call.getArguments().length === 0 &&
      Node.isIdentifier(target) &&
      target.getText() !== '$' &&
      target.getText() !== 'jQuery' &&
      /\bfitText\s*[:(]/.test(sourceFile.getFullText())
    ) {
      const propAssignments = sourceFile.getFullText().match(/\bfitText\s*:\s*function\b|\bfunction\s+fitText\b/);
      if (propAssignments) {
        return false;
      }
    }
    return true;
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

      if (!isFitTextCall(node, sourceFile)) {
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
