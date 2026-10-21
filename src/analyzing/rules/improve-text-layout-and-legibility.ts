import {
  Node,
  type CallExpression,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
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

export const IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH = '8f7dfdad123c';

const TEXT_BALANCE_PACKAGES = [
  'react-wrap-balancer',
  'balance-text',
  'vue-wrap-balancer',
] as const;

const TEXT_WRAP_GUARD_TOKENS = [
  'text-wrap',
  'textWrap',
] as const;

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

function matchBalanceTextCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  if (isLibraryReference(callee, 'balanceText', ['balance-text'])) {
    return 'balanceText() JavaScript line-balancing call can be modernized with native CSS text-wrap: balance and text-wrap: pretty.';
  }

  if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'balanceText') {
    const receiver = unwrapExpression(callee.getExpression());
    if (Node.isCallExpression(receiver)) {
      const fn = unwrapExpression(receiver.getExpression());
      if (
        Node.isIdentifier(fn) &&
        (fn.getText() === '$' || fn.getText() === 'jQuery')
      ) {
        return 'jQuery .balanceText() plugin call can be modernized with native CSS text-wrap: balance and text-wrap: pretty.';
      }
    }
  }

  return null;
}

function matchBalancerJsx(
  jsxNode: JsxOpeningElement | JsxSelfClosingElement,
): string | null {
  const tagNameNode = jsxNode.getTagNameNode();
  if (
    Node.isIdentifier(tagNameNode) &&
    isLibraryReference(
      tagNameNode,
      'Balancer',
      ['react-wrap-balancer', 'vue-wrap-balancer'],
      true,
      false,
    )
  ) {
    return '<Balancer> JavaScript text-wrapping component can be modernized with native CSS text-wrap: balance.';
  }
  return null;
}

export const improveTextLayoutAndLegibilityPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: TEXT_BALANCE_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy JavaScript text-balancing package "${pkgName}" (${versionRange}) can be modernized with native CSS text-wrap: balance and text-wrap: pretty.`,
    };
  },
};

export const improveTextLayoutAndLegibilityJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['balanceText', 'Balancer'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (
        !Node.isCallExpression(node) &&
        !Node.isJsxOpeningElement(node) &&
        !Node.isJsxSelfClosingElement(node)
      ) {
        return;
      }

      if (isProtectedByFeatureGuard(node, TEXT_WRAP_GUARD_TOKENS)) {
        return;
      }

      const msg = Node.isCallExpression(node)
        ? matchBalanceTextCall(node)
        : matchBalancerJsx(node);

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

export const improveTextLayoutAndLegibilityPackageRule: AnalyzerRule = {
  id: 'improve-text-layout-and-legibility/package-text-balance',
  guideId: 'improve-text-layout-and-legibility',
  guideHash: IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH,
  summary:
    'Client-side text-balancing packages (react-wrap-balancer, balance-text) should be modernized with CSS text-wrap: balance and text-wrap: pretty.',
  matcher: improveTextLayoutAndLegibilityPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares react-wrap-balancer, balance-text, or vue-wrap-balancer in package.json dependencies to balance heading or paragraph line lengths.',
    ],
    dropWhen: [
      'The project already uses native CSS text-wrap: balance or text-wrap: pretty.',
      'The code performs server-side typographic preprocessing rather than client-side DOM line balancing.',
    ],
  },
};

export const improveTextLayoutAndLegibilityJsRule: AnalyzerRule = {
  id: 'improve-text-layout-and-legibility/js-text-balance',
  guideId: 'improve-text-layout-and-legibility',
  guideHash: IMPROVE_TEXT_LAYOUT_AND_LEGIBILITY_GUIDE_HASH,
  summary:
    'JavaScript balanceText() calls and <Balancer> components should be modernized with native CSS text-wrap: balance and text-wrap: pretty.',
  matcher: improveTextLayoutAndLegibilityJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls balanceText(...) or renders <Balancer> from react-wrap-balancer to balance heading or text line breaks in the browser.',
    ],
    dropWhen: [
      'The balanceText() call is guarded by a CSS.supports("text-wrap", "balance") fallback check.',
      'The code uses native CSS text-wrap: balance / pretty or performs server-side typographic preprocessing.',
    ],
  },
};

export const improveTextLayoutAndLegibilityRules: readonly AnalyzerRule[] = [
  improveTextLayoutAndLegibilityPackageRule,
  improveTextLayoutAndLegibilityJsRule,
];
