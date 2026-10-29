import {
  Node,
  type CallExpression,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
  isGlobalReference,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';

export const HIGHLIGHT_TEXT_RANGES_GUIDE_HASH = '40fbfee1f408';

const MARKJS_PACKAGES = ['mark.js', 'markjs'] as const;

const HIGHLIGHT_GUARD_TOKENS = [
  'highlights',
  'Highlight',
  'HighlightRegistry',
] as const;

const MARK_METHODS = new Set(['mark', 'markRegExp', 'markRanges']);

function isMarkConstructorReference(node: Node): boolean {
  if (isGlobalReference(node, 'Mark')) {
    return true;
  }
  const unwrapped = unwrapExpression(node);
  if (!Node.isIdentifier(unwrapped) || unwrapped.getText() !== 'Mark') {
    return false;
  }
  const sourceFile = unwrapped.getSourceFile();
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = getSafeModuleSpecifier(imp);
    if (
      !spec ||
      !MARKJS_PACKAGES.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))
    ) {
      continue;
    }
    if (
      imp.getDefaultImport()?.getText() === 'Mark' ||
      imp.getNamespaceImport()?.getText() === 'Mark'
    ) {
      return true;
    }
    for (const named of imp.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getName();
      if (local === 'Mark') {
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
      return MARKJS_PACKAGES.some(
        (pkg) => spec === pkg || spec.startsWith(`${pkg}/`),
      );
    }
  }
  return false;
}

function isMarkInstance(node: Node): boolean {
  const resolved = resolveLocalExpression(node, 2);
  if (Node.isNewExpression(resolved)) {
    const callee = unwrapExpression(resolved.getExpression());
    if (isMarkConstructorReference(callee)) {
      return true;
    }
  }
  return false;
}

function matchMarkJsCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  if (!MARK_METHODS.has(methodName)) {
    return null;
  }

  if (!isMarkInstance(callee.getExpression())) {
    return null;
  }

  const scope =
    callExpr.getFirstAncestor(
      (a) => Node.isFunctionLikeDeclaration(a) || Node.isBlock(a),
    ) ?? callExpr.getSourceFile();
  if (
    /(?:querySelectorAll|getElementsByTagName)\s*\(\s*['"]mark['"]\s*\)/i.test(
      scope.getText(),
    )
  ) {
    return null;
  }

  return `new Mark().${methodName}() mutates DOM nodes to highlight text; modernize with the CSS Custom Highlight API (new Highlight(), CSS.highlights.set(), and ::highlight()).`;
}

export const highlightTextRangesPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    MARKJS_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy DOM text-highlighting package "${pkgName}" (${versionRange}) can be modernized with the native CSS Custom Highlight API (CSS.highlights and ::highlight()).`,
  );

export const highlightTextRangesJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['new Mark', '.mark(', '.markRegExp(', '.unmark(', 'Mark('],
  featureGuardTokens: HIGHLIGHT_GUARD_TOKENS,
  matchCall: (node) => matchMarkJsCall(node),
});

export const highlightTextRangesPackageRule: AnalyzerRule = {
  id: 'highlight-text-ranges/package-markjs',
  guideId: 'highlight-text-ranges',
  guideHash: HIGHLIGHT_TEXT_RANGES_GUIDE_HASH,
  summary:
    'Legacy mark.js / markjs packages in package.json dependencies can be modernized with the native CSS Custom Highlight API (CSS.highlights and ::highlight()).',
  matcher: highlightTextRangesPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares mark.js or markjs in package.json dependencies to highlight search results or text ranges in the DOM.',
    ],
    dropWhen: [
      'The library is used strictly as a fallback when "highlights" in CSS or CSS.highlights is unsupported.',
      'The highlighting represents permanent semantic document markup (<mark>) rather than transient visual range highlighting.',
    ],
  },
};

export const highlightTextRangesJsRule: AnalyzerRule = {
  id: 'highlight-text-ranges/js-markjs',
  guideId: 'highlight-text-ranges',
  guideHash: HIGHLIGHT_TEXT_RANGES_GUIDE_HASH,
  summary:
    'JavaScript calls to new Mark(...).mark(...) or new Mark(...).markRegExp(...) should be modernized with the CSS Custom Highlight API (CSS.highlights).',
  matcher: highlightTextRangesJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript instantiates new Mark(...) and invokes .mark(...) or .markRegExp(...) to highlight text ranges by wrapping DOM nodes without a "highlights" in CSS guard.',
    ],
    dropWhen: [
      'The Mark.js call is inside a fallback branch guarded by "highlights" in CSS or CSS.highlights.',
      'The call is performance.mark() for User Timing API instrumentation rather than DOM text highlighting.',
    ],
  },
};

export default [
  highlightTextRangesPackageRule,
  highlightTextRangesJsRule,
] satisfies readonly AnalyzerRule[];
