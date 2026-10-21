import {
  Node,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const PRECISE_TEXT_ALIGNMENT_GUIDE_HASH = 'caaec69c7865';

const CAPSIZE_PACKAGES = [
  '@capsizecss/core',
  '@capsizecss/vanilla-extract',
  'capsize',
] as const;

const TEXT_BOX_GUARD_TOKENS = [
  'text-box',
  'text-box-trim',
  'textBoxTrim',
] as const;

const CAPSIZE_FUNCTIONS = [
  'createStyleObject',
  'createStyleString',
  'precomputeValues',
  'capsize',
] as const;

const CAPSIZE_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'fontMetrics',
  'capHeight',
  'lineGap',
  'leading',
]);

function isLibraryReference(
  node: Node,
  identName: string,
  packages: readonly string[],
): boolean {
  if (isGlobalReference(node, identName)) {
    return true;
  }
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped) || unwrapped.getText() !== identName) {
    return false;
  }
  const sourceFile = unwrapped.getSourceFile();
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = getSafeModuleSpecifier(imp);
    if (!spec || !packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))) {
      continue;
    }
    if (
      imp.getDefaultImport()?.getText() === identName ||
      imp.getNamespaceImport()?.getText() === identName
    ) {
      return true;
    }
    for (const named of imp.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getName();
      if (local === identName) {
        return true;
      }
    }
  }
  const resolved = resolveLocalExpression(unwrapped, 2);
  if (Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    const firstArg = resolved.getArguments()[0];
    if (
      Node.isIdentifier(callee) &&
      callee.getText() === 'require' &&
      firstArg &&
      Node.isStringLiteral(firstArg)
    ) {
      const spec = firstArg.getLiteralText();
      return packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`));
    }
  }
  return false;
}

function hasCapsizeMetricsConfig(obj: ObjectLiteralExpression): boolean {
  for (const prop of obj.getProperties()) {
    if (
      (Node.isPropertyAssignment(prop) ||
        Node.isShorthandPropertyAssignment(prop)) &&
      CAPSIZE_CONFIG_KEYS.has(prop.getName())
    ) {
      return true;
    }
  }
  return false;
}

function matchCapsizeCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length === 0 || !args[0]) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  const matchedFn = CAPSIZE_FUNCTIONS.find((fnName) =>
    isLibraryReference(callee, fnName, CAPSIZE_PACKAGES),
  );
  if (!matchedFn) {
    return null;
  }

  const firstArg = resolveLocalExpression(args[0], 2);
  if (
    isGlobalReference(callee, matchedFn) &&
    (!Node.isObjectLiteralExpression(firstArg) || !hasCapsizeMetricsConfig(firstArg))
  ) {
    return null;
  }

  return `${matchedFn}() leading-trim compensation can be modernized with native CSS text-box-trim and text-box-edge (text-box: trim-both cap alphabetic).`;
}

export const preciseTextAlignmentPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: CAPSIZE_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy font leading-trim package "${pkgName}" (${versionRange}) can be modernized with native CSS text-box-trim and text-box-edge (text-box: trim-both cap alphabetic).`,
    };
  },
};

export const preciseTextAlignmentJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['createStyleObject', 'createStyleString', 'precomputeValues', 'capsize'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, TEXT_BOX_GUARD_TOKENS)) {
        return;
      }

      const msg = matchCapsizeCall(node);
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

export const preciseTextAlignmentCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['leading-trim', 'text-edge'],
  matchRule: (styleRule: CssRuleView, _ctx: CssMatcherContext) => {
    if (
      styleRule.hasProperty('text-box') ||
      styleRule.hasProperty('text-box-trim')
    ) {
      return null;
    }

    if (
      styleRule.hasProperty('leading-trim') ||
      styleRule.hasProperty('text-edge')
    ) {
      return {
        message:
          'CSS rule uses legacy draft leading-trim / text-edge properties; modernize with standard CSS text-box-trim and text-box-edge (or text-box: trim-both cap alphabetic).',
      };
    }

    return null;
  },
};

export const preciseTextAlignmentPackageRule: AnalyzerRule = {
  id: 'precise-text-alignment/package-capsize',
  guideId: 'precise-text-alignment',
  guideHash: PRECISE_TEXT_ALIGNMENT_GUIDE_HASH,
  summary:
    'Capsize leading-trim packages (@capsizecss/core, capsize) should be modernized with CSS text-box-trim and text-box-edge.',
  matcher: preciseTextAlignmentPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares @capsizecss/core, @capsizecss/vanilla-extract, or capsize in package.json dependencies to trim font leading above cap-height and below the alphabetic baseline.',
    ],
    dropWhen: [
      'The project already uses native CSS text-box, text-box-trim, and text-box-edge.',
      'The code only sets standard vertical-align: middle or line-height: 1.5 body text leading.',
    ],
  },
};

export const preciseTextAlignmentJsRule: AnalyzerRule = {
  id: 'precise-text-alignment/js-capsize',
  guideId: 'precise-text-alignment',
  guideHash: PRECISE_TEXT_ALIGNMENT_GUIDE_HASH,
  summary:
    'Capsize createStyleObject / capsize() calls generating negative-margin leading-trim workarounds should be modernized with CSS text-box-trim and text-box-edge.',
  matcher: preciseTextAlignmentJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls createStyleObject(), createStyleString(), precomputeValues(), or capsize() with fontMetrics / capHeight to generate negative-margin leading-trim styles.',
    ],
    dropWhen: [
      'The call is guarded by a CSS.supports("text-box-trim", "trim-both") fallback check.',
      'The code uses standard vertical-align: middle or standard line-height body text leading.',
    ],
  },
};

export const preciseTextAlignmentCssRule: AnalyzerRule = {
  id: 'precise-text-alignment/css-leading-trim',
  guideId: 'precise-text-alignment',
  guideHash: PRECISE_TEXT_ALIGNMENT_GUIDE_HASH,
  summary:
    'Legacy draft CSS leading-trim and text-edge declarations should be modernized with standard CSS text-box-trim and text-box-edge.',
  matcher: preciseTextAlignmentCssMatcher,
  phase2Rubric: {
    keepWhen: [
      'A CSS rule declares legacy draft leading-trim or text-edge without standard text-box or text-box-trim.',
    ],
    dropWhen: [
      'The CSS rule already declares standard text-box or text-box-trim and text-box-edge.',
      'The rule only uses standard vertical-align: middle or line-height declarations.',
    ],
  },
};

export const preciseTextAlignmentRules: readonly AnalyzerRule[] = [
  preciseTextAlignmentPackageRule,
  preciseTextAlignmentJsRule,
  preciseTextAlignmentCssRule,
];
