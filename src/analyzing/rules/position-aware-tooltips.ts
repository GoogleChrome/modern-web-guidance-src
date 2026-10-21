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

export const POSITION_AWARE_TOOLTIPS_GUIDE_HASH = '4ba438faeb7a';

const POPPER_PACKAGES = [
  '@popperjs/core',
  'popper.js',
  '@floating-ui/dom',
] as const;

const ANCHOR_GUARD_TOKENS = [
  'anchor-name',
  'anchorName',
  'position-anchor',
  'positionAnchor',
  'position-try-fallbacks',
  'positionTryFallbacks',
  'container-type',
] as const;

const TOOLTIP_CONTEXT_REGEX = /tooltip|role\s*=\s*['"]tooltip['"]/i;

const NON_TOOLTIP_WIDGET_REGEX =
  /\b(?:dropdown|combobox|listbox|menu|menubar|menuitem|contextmenu|modal|dialog|select|datepicker|autocomplete)\b/i;

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
      if (allowGlobal && isGlobalReference(receiver, 'Popper')) {
        return true;
      }
      if (allowGlobal && isGlobalReference(receiver, 'FloatingUIDOM')) {
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

function hasTooltipContext(callExpr: CallExpression): boolean {
  let hasNonTooltipWidgetArg = false;
  for (const arg of callExpr.getArguments()) {
    const argText = arg.getText();
    const resolvedText = resolveLocalExpression(arg, 2).getText();
    if (
      TOOLTIP_CONTEXT_REGEX.test(argText) ||
      TOOLTIP_CONTEXT_REGEX.test(resolvedText)
    ) {
      return true;
    }
    if (
      NON_TOOLTIP_WIDGET_REGEX.test(argText) ||
      NON_TOOLTIP_WIDGET_REGEX.test(resolvedText)
    ) {
      hasNonTooltipWidgetArg = true;
    }
  }

  if (hasNonTooltipWidgetArg) {
    return false;
  }

  let current: Node | undefined = callExpr.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (
      Node.isVariableDeclaration(current) ||
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current)
    ) {
      const nameText = current.getName() ?? '';
      if (TOOLTIP_CONTEXT_REGEX.test(nameText)) {
        return true;
      }
      if (NON_TOOLTIP_WIDGET_REGEX.test(nameText)) {
        return false;
      }
    }
    if (Node.isBlock(current)) {
      if (TOOLTIP_CONTEXT_REGEX.test(current.getText())) {
        return true;
      }
    }
    current = current.getParent();
  }

  return false;
}

function isGuardedByAnchorSupport(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, ANCHOR_GUARD_TOKENS)) {
    return true;
  }
  let current: Node | undefined = node.getParent();
  while (current) {
    if (Node.isIfStatement(current)) {
      const condText = current.getExpression().getText();
      if (
        ANCHOR_GUARD_TOKENS.some((tok) => condText.includes(tok)) &&
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

function matchPopperTooltipCall(callExpr: CallExpression): string | null {
  const args = callExpr.getArguments();
  if (args.length < 2) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  const isPopper = isLibraryReference(callee, 'createPopper', [
    '@popperjs/core',
    'popper.js',
  ]);
  const isFloatingUi = isLibraryReference(callee, 'computePosition', [
    '@floating-ui/dom',
    '@floating-ui/core',
  ]);

  if (!isPopper && !isFloatingUi) {
    return null;
  }

  if (!hasTooltipContext(callExpr)) {
    return null;
  }

  const apiName = isPopper ? 'createPopper()' : 'computePosition()';
  return `JavaScript ${apiName} tooltip positioning can be modernized with CSS Anchor Positioning, position-try-fallbacks, and @container anchored(fallback: ...).`;
}

export const positionAwareTooltipsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: POPPER_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Tooltip positioning dependency "${pkgName}" (${versionRange}) can be modernized with CSS Anchor Positioning, position-try-fallbacks, and @container anchored(fallback: ...).`,
    };
  },
};

export const positionAwareTooltipsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['createPopper', 'computePosition'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedByAnchorSupport(node)) {
        return;
      }

      const message = matchPopperTooltipCall(node);
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

export const positionAwareTooltipsPackageRule: AnalyzerRule = {
  id: 'position-aware-tooltips/package-popper',
  guideId: 'position-aware-tooltips',
  guideHash: POSITION_AWARE_TOOLTIPS_GUIDE_HASH,
  summary:
    'Popper.js and Floating UI dependencies (@popperjs/core, popper.js, @floating-ui/dom) for tooltip flip positioning can be modernized with CSS Anchor Positioning and @container anchored(fallback: ...).',
  matcher: positionAwareTooltipsPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares @popperjs/core, popper.js, or @floating-ui/dom in package.json dependencies to position tooltips with viewport collision flipping.',
    ],
    dropWhen: [
      'Pure CSS static margin tooltips or fixed screen-center modal positioning.',
      'The dependency is used exclusively for complex interactive dropdown menus or comboboxes rather than position-aware tooltips.',
    ],
  },
};

export const positionAwareTooltipsJsRule: AnalyzerRule = {
  id: 'position-aware-tooltips/js-popper-tooltip',
  guideId: 'position-aware-tooltips',
  guideHash: POSITION_AWARE_TOOLTIPS_GUIDE_HASH,
  summary:
    'JavaScript createPopper() and computePosition() calls positioning tooltip elements should be modernized with CSS Anchor Positioning, position-try-fallbacks, and @container anchored(fallback: ...).',
  matcher: positionAwareTooltipsJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls createPopper() or computePosition() to position a tooltip element (with flip() middleware or viewport boundary adjustments).',
      'Custom JS viewport collision detection flips tooltip placement classes when overflowing the viewport.',
    ],
    dropWhen: [
      'The call is guarded by CSS.supports("anchor-name", "--a") or CSS.supports("position-anchor", "--a").',
      'Pure CSS static margin tooltips or fixed screen-center modal positioning.',
      'createPopper() or computePosition() is positioning a context menu or dropdown menu rather than a tooltip.',
    ],
  },
};

export const positionAwareTooltipsRules: readonly AnalyzerRule[] = [
  positionAwareTooltipsPackageRule,
  positionAwareTooltipsJsRule,
];
