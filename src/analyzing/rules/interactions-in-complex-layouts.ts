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
      isLibraryReference(callee, methodName, FASTDOM_PACKAGES, false, false)
    ) {
      return `fastdom.${methodName}() layout read/write batching can be modernized with CSS content-visibility: auto and contain-intrinsic-size containment boundaries.`;
    }
  }

  return null;
}

export const interactionsInComplexLayoutsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: FASTDOM_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Layout read/write batching dependency "${pkgName}" (${versionRange}) can be modernized with CSS content-visibility: auto and contain-intrinsic-size containment boundaries.`,
    };
  },
};

export const interactionsInComplexLayoutsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['fastdom', 'FastDom', 'measure', 'mutate'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByContainment(node)) {
        return;
      }

      const message = matchFastdomCall(node);
      if (message) {
        matches.push({
          line: node.getStartLineNumber(),
          message,
        });
      }
    });

    return matches;
  },
};

export const interactionsInComplexLayoutsPackageRule: AnalyzerRule = {
  id: 'interactions-in-complex-layouts/package-fastdom',
  guideId: 'interactions-in-complex-layouts',
  guideHash: INTERACTIONS_IN_COMPLEX_LAYOUTS_GUIDE_HASH,
  summary:
    'FastDom dependency (fastdom) for read/write layout batching can be modernized with CSS content-visibility: auto and contain-intrinsic-size.',
  matcher: interactionsInComplexLayoutsPackageMatcher,
  phase2Rubric: {
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
  phase2Rubric: {
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

export const interactionsInComplexLayoutsRules: readonly AnalyzerRule[] = [
  interactionsInComplexLayoutsPackageRule,
  interactionsInComplexLayoutsJsRule,
];
