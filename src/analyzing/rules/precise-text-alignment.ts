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

function matchesPackageSpec(
  spec: string | null,
  packages: readonly string[],
): boolean {
  return (
    spec !== null &&
    packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))
  );
}

function isRequireOfPackage(
  node: Node,
  packages: readonly string[],
): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isCallExpression(unwrapped)) {
    return false;
  }
  const callee = unwrapExpression(unwrapped.getExpression());
  const firstArg = unwrapped.getArguments()[0];
  if (
    Node.isIdentifier(callee) &&
    callee.getText() === 'require' &&
    firstArg &&
    Node.isStringLiteral(firstArg)
  ) {
    return matchesPackageSpec(firstArg.getLiteralText(), packages);
  }
  return false;
}

function checkEnclosingBindings(
  identNode: Node,
  localName: string,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean,
): 'matched' | 'shadowed' | 'none' {
  let current: Node | undefined = identNode.getParent();
  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      if (
        (Node.isFunctionDeclaration(current) || Node.isFunctionExpression(current)) &&
        current.getName() === localName
      ) {
        return 'shadowed';
      }
      for (const param of current.getParameters()) {
        for (const el of param.getDescendantsOfKind(identNode.getKind())) {
          if (el.getText() === localName && el.getParent() !== current) {
            return 'shadowed';
          }
        }
      }
    }

    if (Node.isBlock(current) || Node.isSourceFile(current)) {
      for (const stmt of current.getStatements()) {
        if (!Node.isVariableStatement(stmt)) {
          continue;
        }
        for (const decl of stmt.getDeclarationList().getDeclarations()) {
          const nameNode = decl.getNameNode();
          if (Node.isObjectBindingPattern(nameNode)) {
            for (const el of nameNode.getElements()) {
              if (el.getName() === localName) {
                const propName = el.getPropertyNameNode()?.getText() ?? el.getName();
                const init = decl.getInitializer();
                if (
                  init &&
                  (propName === identName || (allowDefaultImport && propName === 'default')) &&
                  isRequireOfPackage(resolveLocalExpression(init, 2), packages)
                ) {
                  return 'matched';
                }
                return 'shadowed';
              }
            }
          } else if (Node.isArrayBindingPattern(nameNode)) {
            for (const el of nameNode.getElements()) {
              if (Node.isBindingElement(el) && el.getName() === localName) {
                return 'shadowed';
              }
            }
          }
        }
      }
    }

    current = current.getParent();
  }
  return 'none';
}

function isLibraryReference(
  node: Node,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean = true,
  allowGlobal: boolean = true,
): boolean {
  const unwrapped = unwrapExpression(node);

  if (allowDefaultImport && isRequireOfPackage(unwrapped, packages)) {
    return true;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    const propName = unwrapped.getName();
    if (propName === identName || (allowDefaultImport && propName === 'default')) {
      const receiver = unwrapped.getExpression();
      if (isRequireOfPackage(resolveLocalExpression(receiver, 2), packages)) {
        return true;
      }
    }
  }

  if (Node.isIdentifier(unwrapped)) {
    const localName = unwrapped.getText();
    const sourceFile = unwrapped.getSourceFile();

    for (const imp of sourceFile.getImportDeclarations()) {
      const matchesPkg = matchesPackageSpec(getSafeModuleSpecifier(imp), packages);
      if (
        imp.getDefaultImport()?.getText() === localName ||
        imp.getNamespaceImport()?.getText() === localName
      ) {
        return allowDefaultImport && matchesPkg;
      }
      for (const named of imp.getNamedImports()) {
        const importedName = named.getName();
        const boundName = named.getAliasNode()?.getText() ?? importedName;
        if (boundName === localName) {
          return (
            matchesPkg &&
            (importedName === identName ||
              (allowDefaultImport && importedName === 'default'))
          );
        }
      }
    }

    const bindingStatus = checkEnclosingBindings(
      unwrapped,
      localName,
      identName,
      packages,
      allowDefaultImport,
    );
    if (bindingStatus === 'matched') {
      return true;
    }
    if (bindingStatus === 'shadowed') {
      return false;
    }

    const resolved = resolveLocalExpression(unwrapped, 2);
    if (resolved !== unwrapped) {
      if (allowDefaultImport && isRequireOfPackage(resolved, packages)) {
        return true;
      }
      if (Node.isPropertyAccessExpression(resolved)) {
        const propName = resolved.getName();
        if (
          (propName === identName || (allowDefaultImport && propName === 'default')) &&
          isRequireOfPackage(resolveLocalExpression(resolved.getExpression(), 2), packages)
        ) {
          return true;
        }
      }
      return false;
    }
  }

  if (allowGlobal && isGlobalReference(unwrapped, identName)) {
    return true;
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
  const matchedFn = CAPSIZE_FUNCTIONS.find((fnName) => {
    if (isLibraryReference(callee, fnName, CAPSIZE_PACKAGES, fnName === 'capsize')) {
      return true;
    }
    if (
      Node.isPropertyAccessExpression(callee) &&
      callee.getName() === fnName &&
      isLibraryReference(callee.getExpression(), 'capsize', CAPSIZE_PACKAGES, true)
    ) {
      return true;
    }
    return false;
  });
  if (!matchedFn) {
    return null;
  }

  const firstArg = resolveLocalExpression(args[0], 2);
  const isImportedFromPkg = CAPSIZE_FUNCTIONS.some((fnName) =>
    isLibraryReference(callee, fnName, CAPSIZE_PACKAGES, fnName === 'capsize', false),
  );
  if (
    !isImportedFromPkg &&
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
