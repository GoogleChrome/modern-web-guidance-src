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

export const IMPROVE_NEXT_PAGE_LOAD_PERFORMANCE_GUIDE_HASH = 'e1062cce8300';

const PREFETCH_PACKAGES = [
  'instant.page',
  'quicklink',
  'flying-pages',
] as const;

const SPECULATION_RULES_GUARD_TOKENS = [
  'speculationrules',
  'HTMLScriptElement',
] as const;

function conditionPolarityForSpeculationRules(
  conditionExpr: Node,
): 'positive' | 'negative' | null {
  const unwrapped = unwrapExpression(conditionExpr);
  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.ExclamationToken
  ) {
    const inner = conditionPolarityForSpeculationRules(unwrapped.getOperand());
    if (inner === 'positive') {
      return 'negative';
    }
    if (inner === 'negative') {
      return 'positive';
    }
    return null;
  }

  const text = unwrapped.getText();
  if (!text.includes('speculationrules')) {
    return null;
  }

  if (Node.isBinaryExpression(unwrapped)) {
    const op = unwrapped.getOperatorToken().getKind();
    const rightText = unwrapped.getRight().getText();
    if (
      (op === SyntaxKind.EqualsEqualsToken ||
        op === SyntaxKind.EqualsEqualsEqualsToken) &&
      rightText === 'false'
    ) {
      return 'negative';
    }
  }

  return 'positive';
}

function nodeContains(container: Node, target: Node): boolean {
  return (
    container === target ||
    (target.getStart() >= container.getStart() &&
      target.getEnd() <= container.getEnd())
  );
}

function statementAlwaysExits(stmt: Node): boolean {
  if (
    Node.isReturnStatement(stmt) ||
    Node.isThrowStatement(stmt) ||
    Node.isBreakStatement(stmt)
  ) {
    return true;
  }
  if (Node.isBlock(stmt)) {
    const statements = stmt.getStatements();
    const last = statements[statements.length - 1];
    return last ? statementAlwaysExits(last) : false;
  }
  return false;
}

function isGuardedBySpeculationRules(node: Node): boolean {
  if (isProtectedByFeatureGuard(node, SPECULATION_RULES_GUARD_TOKENS)) {
    return true;
  }

  let current: Node | undefined = node;
  while (current) {
    const parent: Node | undefined = current.getParent();
    if (!parent) {
      break;
    }

    if (Node.isIfStatement(parent)) {
      const polarity = conditionPolarityForSpeculationRules(parent.getExpression());
      const elseStmt = parent.getElseStatement();
      if (polarity === 'positive' && elseStmt && nodeContains(elseStmt, current)) {
        return true;
      }
      if (polarity === 'negative' && nodeContains(parent.getThenStatement(), current)) {
        return true;
      }
    }

    if (Node.isConditionalExpression(parent)) {
      const polarity = conditionPolarityForSpeculationRules(parent.getCondition());
      if (polarity === 'positive' && nodeContains(parent.getWhenFalse(), current)) {
        return true;
      }
      if (polarity === 'negative' && nodeContains(parent.getWhenTrue(), current)) {
        return true;
      }
    }

    if (Node.isBlock(parent) || Node.isSourceFile(parent)) {
      for (const stmt of parent.getStatements()) {
        if (stmt.getStart() >= current.getStart()) {
          break;
        }
        if (
          Node.isIfStatement(stmt) &&
          conditionPolarityForSpeculationRules(stmt.getExpression()) === 'positive' &&
          statementAlwaysExits(stmt.getThenStatement())
        ) {
          return true;
        }
      }
    }

    current = parent;
  }

  return false;
}

function hasQuicklinkNamedImport(sourceFile: SourceFile, name: string): boolean {
  for (const imp of sourceFile.getImportDeclarations()) {
    if (imp.getModuleSpecifierValue() !== 'quicklink') {
      continue;
    }
    for (const named of imp.getNamedImports()) {
      const localName = named.getAliasNode()?.getText() ?? named.getName();
      if (localName === name) {
        return true;
      }
    }
  }
  return false;
}

function isQuicklinkReference(node: Node, sourceFile: SourceFile): boolean {
  if (isGlobalReference(node, 'quicklink')) {
    return true;
  }
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped) || unwrapped.getText() !== 'quicklink') {
    return false;
  }
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (spec !== 'quicklink' && !spec.startsWith('quicklink/')) {
      continue;
    }
    if (
      imp.getDefaultImport()?.getText() === 'quicklink' ||
      imp.getNamespaceImport()?.getText() === 'quicklink'
    ) {
      return true;
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
      Node.isStringLiteral(firstArg) &&
      firstArg.getLiteralText() === 'quicklink'
    ) {
      return true;
    }
  }
  return false;
}

function matchQuicklinkCall(
  callExpr: CallExpression,
  sourceFile: SourceFile,
): string | null {
  const callee = unwrapExpression(callExpr.getExpression());

  if (Node.isPropertyAccessExpression(callee)) {
    const methodName = callee.getName();
    if (methodName !== 'listen' && methodName !== 'prefetch') {
      return null;
    }
    if (isQuicklinkReference(callee.getExpression(), sourceFile)) {
      return `quicklink.${methodName}() imperative link prefetching can be modernized with declarative Speculation Rules (<script type="speculationrules">).`;
    }
    return null;
  }

  if (Node.isIdentifier(callee)) {
    const fnName = callee.getText();
    if (
      (fnName === 'listen' || fnName === 'prefetch') &&
      hasQuicklinkNamedImport(sourceFile, fnName)
    ) {
      return `quicklink ${fnName}() imperative link prefetching can be modernized with declarative Speculation Rules (<script type="speculationrules">).`;
    }
  }

  return null;
}

export const improveNextPageLoadPerformancePackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: PREFETCH_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy link-prefetching package "${pkgName}" (${versionRange}) can be modernized with the declarative Speculation Rules API (<script type="speculationrules">).`,
    };
  },
};

export const improveNextPageLoadPerformanceJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['quicklink'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isGuardedBySpeculationRules(node)) {
        return;
      }

      const msg = matchQuicklinkCall(node, sourceFile);
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

export const improveNextPageLoadPerformancePackageRule: AnalyzerRule = {
  id: 'improve-next-page-load-performance/package-prefetch',
  guideId: 'improve-next-page-load-performance',
  guideHash: IMPROVE_NEXT_PAGE_LOAD_PERFORMANCE_GUIDE_HASH,
  summary:
    'Legacy link-prefetching packages (instant.page, quicklink, flying-pages) can be modernized with the declarative Speculation Rules API (<script type="speculationrules">).',
  matcher: improveNextPageLoadPerformancePackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A multi-page web application declares instant.page, quicklink, or flying-pages in package.json dependencies to prefetch next-page navigation links on hover or viewport entry.',
    ],
    dropWhen: [
      'The library is used only as a fallback when HTMLScriptElement.supports?.("speculationrules") returns false.',
      'The application is a client-side Single Page Application (SPA) router prefetching JSON/JS route chunks rather than full-document navigations.',
    ],
  },
};

export const improveNextPageLoadPerformanceJsRule: AnalyzerRule = {
  id: 'improve-next-page-load-performance/js-quicklink',
  guideId: 'improve-next-page-load-performance',
  guideHash: IMPROVE_NEXT_PAGE_LOAD_PERFORMANCE_GUIDE_HASH,
  summary:
    'JavaScript calls to quicklink.listen() or quicklink.prefetch() should be modernized with the declarative Speculation Rules API (<script type="speculationrules">).',
  matcher: improveNextPageLoadPerformanceJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls quicklink.listen() or quicklink.prefetch() to speculatively prefetch navigation URLs without an HTMLScriptElement.supports?.("speculationrules") guard.',
    ],
    dropWhen: [
      'The quicklink call is guarded by HTMLScriptElement.supports?.("speculationrules") as a fallback for browsers without Speculation Rules support.',
      'The prefetching targets non-navigation subresources (such as images, fonts, or JSON API payloads) rather than next-page HTML documents.',
    ],
  },
};

export const improveNextPageLoadPerformanceRules: readonly AnalyzerRule[] = [
  improveNextPageLoadPerformancePackageRule,
  improveNextPageLoadPerformanceJsRule,
];
