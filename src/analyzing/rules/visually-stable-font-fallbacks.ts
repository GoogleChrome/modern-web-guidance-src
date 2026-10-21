import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveCallableNode,
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

export const VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH = '223faadbfe12';

const FONT_LOADER_PACKAGES = [
  'fontfaceobserver',
  'webfontloader',
] as const;

const FONT_FALLBACK_GUARD_TOKENS = [
  'font-size-adjust',
  'fontSizeAdjust',
  'size-adjust',
  'ascent-override',
  'descent-override',
] as const;

const CANVAS_CONTEXT_REGEX =
  /\b(?:getContext\s*\(\s*['"]2d['"]\s*\)|fillText|strokeText|measureText)\b/;

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
        const paramNameNode = param.getNameNode();
        if (Node.isIdentifier(paramNameNode) && paramNameNode.getText() === localName) {
          return 'shadowed';
        }
        for (const el of paramNameNode.getDescendantsOfKind(SyntaxKind.Identifier)) {
          if (el.getText() === localName) {
            return 'shadowed';
          }
        }
      }
    }

    if (Node.isBlock(current) || Node.isSourceFile(current)) {
      for (const stmt of current.getStatements()) {
        if (
          (Node.isFunctionDeclaration(stmt) || Node.isClassDeclaration(stmt)) &&
          stmt.getName() === localName
        ) {
          return 'shadowed';
        }
        if (!Node.isVariableStatement(stmt)) {
          continue;
        }
        for (const decl of stmt.getDeclarationList().getDeclarations()) {
          const nameNode = decl.getNameNode();
          if (Node.isIdentifier(nameNode) && nameNode.getText() === localName) {
            const init = decl.getInitializer();
            if (init) {
              const resolvedInit = resolveLocalExpression(init, 2);
              if (
                allowDefaultImport &&
                isRequireOfPackage(resolvedInit, packages)
              ) {
                return 'matched';
              }
              if (Node.isPropertyAccessExpression(resolvedInit)) {
                const propName = resolvedInit.getName();
                if (
                  (propName === identName ||
                    (allowDefaultImport && propName === 'default')) &&
                  isRequireOfPackage(
                    resolveLocalExpression(resolvedInit.getExpression(), 2),
                    packages,
                  )
                ) {
                  return 'matched';
                }
              }
            }
            return 'shadowed';
          } else if (Node.isObjectBindingPattern(nameNode)) {
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
  }

  if (allowGlobal && isGlobalReference(unwrapped, identName)) {
    return true;
  }

  return false;
}

function isFontFaceObserverInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isNewExpression(resolved) || Node.isCallExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isLibraryReference(callee, 'FontFaceObserver', ['fontfaceobserver'])) {
      return true;
    }
  }
  return false;
}

function isGuardedByFontAdjust(node: Node, fileContent: string): boolean {
  if (
    /\b(?:font-size-adjust|size-adjust|ascent-override|descent-override)\s*:/i.test(
      fileContent,
    )
  ) {
    return true;
  }
  if (isProtectedByFeatureGuard(node, FONT_FALLBACK_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        FONT_FALLBACK_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function isCanvasFontLoadContext(node: Node): boolean {
  for (const arg of Node.isCallExpression(node) ? node.getArguments() : []) {
    const resolvedArg = resolveCallableNode(arg, 2);
    if (CANVAS_CONTEXT_REGEX.test(resolvedArg.getText())) {
      return true;
    }
  }

  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isCallExpression(current)) {
      for (const arg of current.getArguments()) {
        const resolvedArg = resolveCallableNode(arg, 2);
        if (CANVAS_CONTEXT_REGEX.test(resolvedArg.getText())) {
          return true;
        }
      }
    }
    if (
      Node.isCallExpression(current) ||
      Node.isBlock(current) ||
      Node.isExpressionStatement(current) ||
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      if (CANVAS_CONTEXT_REGEX.test(current.getText())) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

function matchFontLoaderCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'load') {
    const receiver = callee.getExpression();
    if (isFontFaceObserverInstance(receiver)) {
      if (isCanvasFontLoadContext(callExpr)) {
        return null;
      }
      return 'FontFaceObserver.load() fallback font swap script can be modernized with CSS font-size-adjust and @font-face size-adjust / ascent-override.';
    }

    if (
      callExpr.getArguments().length > 0 &&
      isLibraryReference(receiver, 'WebFont', ['webfontloader'])
    ) {
      if (isCanvasFontLoadContext(callExpr)) {
        return null;
      }
      return 'WebFont.load() fallback font class loader can be modernized with CSS font-size-adjust and @font-face size-adjust / ascent-override.';
    }
  }

  return null;
}

export const visuallyStableFontFallbacksPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: FONT_LOADER_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `JavaScript font-loading dependency "${pkgName}" (${versionRange}) can be modernized with CSS font-size-adjust and @font-face size-adjust / ascent-override descriptors.`,
    };
  },
};

export const visuallyStableFontFallbacksJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['FontFaceObserver', 'WebFont', 'fontfaceobserver', 'webfontloader'],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByFontAdjust(node, ctx.fileContent)) {
        return;
      }

      const message = matchFontLoaderCall(node);
      if (message) {
        const line = node.getStartLineNumber();
        if (!visitedLines.has(line)) {
          visitedLines.add(line);
          matches.push({
            line,
            message,
          });
        }
      }
    });

    return matches;
  },
};

export const visuallyStableFontFallbacksPackageRule: AnalyzerRule = {
  id: 'visually-stable-font-fallbacks/package-font-loader',
  guideId: 'visually-stable-font-fallbacks',
  guideHash: VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH,
  summary:
    'Font-loading observer dependencies (fontfaceobserver, webfontloader) used to mitigate fallback font layout shifts can be modernized with CSS font-size-adjust.',
  matcher: visuallyStableFontFallbacksPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares fontfaceobserver or webfontloader in package.json dependencies to toggle font-loaded classes and mitigate fallback font layout shifts.',
    ],
    dropWhen: [
      'Stylesheets already use @font-face size-adjust, ascent-override, descent-override, or CSS font-size-adjust.',
      'Font loading listeners are used strictly to trigger 2D <canvas> text drawing (ctx.fillText).',
    ],
  },
};

export const visuallyStableFontFallbacksJsRule: AnalyzerRule = {
  id: 'visually-stable-font-fallbacks/js-font-loader',
  guideId: 'visually-stable-font-fallbacks',
  guideHash: VISUALLY_STABLE_FONT_FALLBACKS_GUIDE_HASH,
  summary:
    'JavaScript FontFaceObserver(...).load() and WebFont.load() calls toggling font-loaded classes should be modernized with CSS font-size-adjust and @font-face metric overrides.',
  matcher: visuallyStableFontFallbacksJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls new FontFaceObserver(...).load() or WebFont.load(...) to toggle .fonts-loaded / .wf-active classes and swap fallback font styles.',
      'Manual line-height or letter-spacing adjustments are applied in JS font-loading callbacks to prevent layout shift.',
    ],
    dropWhen: [
      'The code is guarded by CSS.supports("font-size-adjust", ...) or already defines @font-face size-adjust / ascent-override / descent-override.',
      'Font loading callbacks are used exclusively to redraw <canvas> text (fillText / measureText).',
    ],
  },
};

export const visuallyStableFontFallbacksRules: readonly AnalyzerRule[] = [
  visuallyStableFontFallbacksPackageRule,
  visuallyStableFontFallbacksJsRule,
];
