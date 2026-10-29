import {
  Node,
  type CallExpression,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type SourceFile,
} from 'ts-morph';
import {
  isLibraryReference,
  isProtectedByFeatureGuard,
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

function isBalanceTextModuleSpecifier(spec: string): boolean {
  return (
    spec === 'balance-text' ||
    /(?:^|\/)balance-?text(?:\.[cm]?[jt]sx?)?$/i.test(spec)
  );
}

function collectImportedBalanceTextIdentifiers(sourceFile: SourceFile): {
  localNames: Set<string>;
  importLines: number[];
} {
  const localNames = new Set<string>();
  const importLines: number[] = [];

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const spec = importDecl.getModuleSpecifierValue();
    if (!isBalanceTextModuleSpecifier(spec)) {
      continue;
    }
    if (isProtectedByFeatureGuard(importDecl, TEXT_WRAP_GUARD_TOKENS)) {
      continue;
    }

    let matchedImport = false;
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport && /^balanceText$/i.test(defaultImport.getText())) {
      localNames.add(defaultImport.getText());
      matchedImport = true;
    }

    for (const namedImport of importDecl.getNamedImports()) {
      if (namedImport.getName() === 'balanceText') {
        localNames.add(namedImport.getAliasNode()?.getText() ?? namedImport.getName());
        matchedImport = true;
      }
    }

    if (matchedImport) {
      importLines.push(importDecl.getStartLineNumber());
    }
  }

  return { localNames, importLines };
}

function matchBalanceTextCall(
  callExpr: CallExpression,
  importedBalanceTextNames: ReadonlySet<string>,
): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  if (
    isLibraryReference(callee, 'balanceText', ['balance-text']) ||
    (Node.isIdentifier(callee) && importedBalanceTextNames.has(callee.getText()))
  ) {
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
      { allowGlobal: false },
    )
  ) {
    return '<Balancer> JavaScript text-wrapping component can be modernized with native CSS text-wrap: balance.';
  }
  return null;
}

export const improveTextLayoutAndLegibilityPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    TEXT_BALANCE_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy JavaScript text-balancing package "${pkgName}" (${versionRange}) can be modernized with native CSS text-wrap: balance and text-wrap: pretty.`,
  );

export const improveTextLayoutAndLegibilityJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['balanceText', 'Balancer'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const { localNames: importedBalanceTextNames, importLines } =
      collectImportedBalanceTextIdentifiers(sourceFile);
    let matchedBalanceTextCall = false;

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

      if (Node.isCallExpression(node)) {
        const msg = matchBalanceTextCall(node, importedBalanceTextNames);
        if (msg) {
          matchedBalanceTextCall = true;
          matches.push({
            line: node.getStartLineNumber(),
            message: msg,
          });
        }
        return;
      }

      const jsxMsg = matchBalancerJsx(node);
      if (jsxMsg) {
        matches.push({
          line: node.getStartLineNumber(),
          message: jsxMsg,
        });
      }
    });

    if (!matchedBalanceTextCall && importLines.length > 0) {
      for (const line of importLines) {
        matches.push({
          line,
          message:
            'balanceText() JavaScript line-balancing import/call can be modernized with native CSS text-wrap: balance and text-wrap: pretty.',
        });
      }
    }

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
  verifierRubric: {
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
  verifierRubric: {
    keepWhen: [
      'JavaScript imports or calls balanceText(...) (from balance-text or a balanceText utility module that splits text across lines by container width) or renders <Balancer> from react-wrap-balancer to balance heading or title line breaks in the browser.',
    ],
    dropWhen: [
      'The balanceText() call is guarded by a CSS.supports("text-wrap", "balance") fallback check.',
      'The code uses native CSS text-wrap: balance / pretty or performs server-side typographic preprocessing or non-DOM string formatting.',
    ],
  },
};

export default [
  improveTextLayoutAndLegibilityPackageRule,
  improveTextLayoutAndLegibilityJsRule,
] satisfies readonly AnalyzerRule[];
