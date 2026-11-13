import {
  Node,
  Project,
  SyntaxKind,
  ts,
  type CallExpression,
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import type {
  AnalyzerMatch,
  FastTokenSpec,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';
import {
  getSafeModuleSpecifier,
  isProtectedByFeatureGuard,
  isRequireOfPackage,
  matchesPackageSpec,
} from './ast-helpers.ts';

/**
 * Creates an ephemeral in-memory ts-morph Project optimized for AST scanning.
 */
export function createInMemoryProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    skipLoadingLibFiles: true,
    compilerOptions: {
      allowJs: true,
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
    },
  });
}

let sharedVirtualProject: Project | null = null;

function getSharedVirtualProject(): Project {
  sharedVirtualProject ??= createInMemoryProject();
  return sharedVirtualProject;
}

/**
 * Parses `fileContent` into a shared in-memory `ts-morph` `Project`, invokes `callback`,
 * and unconditionally removes the virtual `SourceFile` afterward so tests never leak files
 * or re-instantiate `Project` per test case.
 */
export function withVirtualSourceFile<T>(
  filePath: string,
  fileContent: string,
  callback: (sourceFile: SourceFile) => T,
): T {
  const project = getSharedVirtualProject();
  const sourceFile = project.createSourceFile(filePath, fileContent, {
    overwrite: true,
  });
  try {
    return callback(sourceFile);
  } finally {
    project.removeSourceFile(sourceFile);
  }
}

/**
 * Runs `matcher.matchFile` against `fileContent` using a shared reusable in-memory `Project`.
 */
export function matchJsRule(
  matcher: JsRuleMatcher,
  filePath: string,
  fileContent: string,
): AnalyzerMatch[] {
  return withVirtualSourceFile(filePath, fileContent, (sourceFile) =>
    matcher.matchFile(sourceFile, { filePath, fileContent }),
  );
}

/**
 * Runs `matchJsRule` and asserts that any matched source also satisfies `matcher.fastTokens`,
 * preventing tests from masking fast-token pre-filter misses that would skip the file in `scanFiles`.
 */
export function matchJsRuleWithFastTokens(
  matcher: JsRuleMatcher,
  filePath: string,
  fileContent: string,
): AnalyzerMatch[] {
  const matches = matchJsRule(matcher, filePath, fileContent);
  if (matches.length > 0 && !matchesFastTokens(fileContent, matcher.fastTokens)) {
    throw new Error(
      `Matcher matched ${matches.length} line(s) in ${filePath}, but matchesFastTokens returned false for ${JSON.stringify(matcher.fastTokens)}`,
    );
  }
  return matches;
}

/**
 * Configuration for `createJsCallMatcher`.
 * Note: `matchCall` and `matchNew` run prior to `visitedLines`, `featureGuardTokens`,
 * and `isGuarded` checks, so they must be side-effect-free predicates.
 */
export interface JsCallMatcherConfig {
  readonly fastTokens?: FastTokenSpec;
  readonly featureGuardTokens?: readonly string[];
  readonly dedupeLines?: boolean;
  readonly maxLineLength?: number;
  readonly excludePackages?: readonly string[];
  readonly excludePathRegex?: RegExp;
  readonly shouldSkipFile?: (sourceFile: SourceFile, ctx: JsMatcherContext) => boolean;
  readonly isGuarded?: (
    node: CallExpression | NewExpression,
    sourceFile: SourceFile,
    ctx: JsMatcherContext,
  ) => boolean;
  readonly matchCall?: (
    node: CallExpression,
    sourceFile: SourceFile,
    ctx: JsMatcherContext,
  ) => string | null;
  readonly matchNew?: (
    node: NewExpression,
    sourceFile: SourceFile,
    ctx: JsMatcherContext,
  ) => string | null;
}

/**
 * Configuration for `createJsAstMatcher`.
 * Note: `matchNode` runs prior to `visitedLines`, `featureGuardTokens`,
 * and `isGuarded` checks, so it must be a side-effect-free predicate.
 */
export interface JsAstMatcherConfig {
  readonly fastTokens?: FastTokenSpec;
  readonly featureGuardTokens?: readonly string[];
  readonly dedupeLines?: boolean;
  readonly maxLineLength?: number;
  readonly excludePackages?: readonly string[];
  readonly excludePathRegex?: RegExp;
  readonly shouldSkipFile?: (sourceFile: SourceFile, ctx: JsMatcherContext) => boolean;
  readonly isGuarded?: (node: Node, sourceFile: SourceFile, ctx: JsMatcherContext) => boolean;
  readonly kinds: readonly SyntaxKind[];
  readonly matchNode: (node: Node, sourceFile: SourceFile, ctx: JsMatcherContext) => string | null;
}

function isLineTooLong(fullText: string, pos: number, maxLineLength: number): boolean {
  const lineStart = fullText.lastIndexOf('\n', pos) + 1;
  const lineEnd = fullText.indexOf('\n', pos);
  return (lineEnd === -1 ? fullText.length : lineEnd) - lineStart > maxLineLength;
}

function fileImportsExcludedPackage(
  sourceFile: SourceFile,
  packages: readonly string[],
): boolean {
  if (
    sourceFile
      .getImportDeclarations()
      .some((decl) => matchesPackageSpec(getSafeModuleSpecifier(decl), packages))
  ) {
    return true;
  }
  const text = sourceFile.getFullText();
  if (!packages.some((pkg) => text.includes(pkg))) {
    return false;
  }
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => isRequireOfPackage(call, packages));
}

function collectOrderedDescendants(sourceFile: SourceFile, kinds: readonly SyntaxKind[]): Node[] {
  const [firstKind] = kinds;
  if (firstKind === undefined) return [];
  if (kinds.length === 1) {
    return sourceFile.getDescendantsOfKind(firstKind);
  }
  const nodes: Node[] = [];
  for (const kind of kinds) {
    for (const descendant of sourceFile.getDescendantsOfKind(kind)) {
      nodes.push(descendant);
    }
  }
  return nodes.sort((a, b) => a.getPos() - b.getPos());
}

/**
 * Builds a `JsRuleMatcher` that walks `CallExpression` and/or `NewExpression` descendants
 * in AST order, applying optional file-level skips, feature-guard checks, and per-line deduplication.
 */
export function createJsCallMatcher(config: JsCallMatcherConfig): JsRuleMatcher {
  const kinds: SyntaxKind[] = [];
  if (config.matchCall) kinds.push(SyntaxKind.CallExpression);
  if (config.matchNew) kinds.push(SyntaxKind.NewExpression);

  return createJsAstMatcher({
    fastTokens: config.fastTokens,
    featureGuardTokens: config.featureGuardTokens,
    dedupeLines: config.dedupeLines ?? false,
    maxLineLength: config.maxLineLength,
    excludePackages: config.excludePackages,
    excludePathRegex: config.excludePathRegex,
    shouldSkipFile: config.shouldSkipFile,
    isGuarded: config.isGuarded
      ? (node, sourceFile, ctx) =>
          (Node.isCallExpression(node) || Node.isNewExpression(node)) &&
          Boolean(config.isGuarded?.(node, sourceFile, ctx))
      : undefined,
    kinds,
    matchNode(node, sourceFile, ctx) {
      if (Node.isCallExpression(node)) return config.matchCall?.(node, sourceFile, ctx) ?? null;
      if (Node.isNewExpression(node)) return config.matchNew?.(node, sourceFile, ctx) ?? null;
      return null;
    },
  });
}

/**
 * Builds a general `JsRuleMatcher` using memoized `sourceFile.getDescendantsOfKind(kind)`
 * across one or more `SyntaxKind`s, with built-in path/package skips, long-line filtering,
 * feature-guard suppression, and per-line deduplication.
 */
export function createJsAstMatcher(config: JsAstMatcherConfig): JsRuleMatcher {
  const dedupeLines = config.dedupeLines ?? true;
  return {
    kind: 'js',
    fastTokens: config.fastTokens ?? [],
    matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
      if (config.excludePathRegex?.test(ctx.filePath)) return [];
      if (
        config.excludePackages?.length &&
        fileImportsExcludedPackage(sourceFile, config.excludePackages)
      ) {
        return [];
      }
      if (config.shouldSkipFile?.(sourceFile, ctx)) return [];

      const candidates = collectOrderedDescendants(sourceFile, config.kinds);
      if (candidates.length === 0) return [];

      const matches: AnalyzerMatch[] = [];
      const visitedLines = dedupeLines ? new Set<number>() : null;
      const fullText = config.maxLineLength !== undefined ? sourceFile.getFullText() : '';

      for (const node of candidates) {
        if (
          config.maxLineLength !== undefined &&
          isLineTooLong(fullText, node.getStart(), config.maxLineLength)
        ) {
          continue;
        }
        const message = config.matchNode(node, sourceFile, ctx);
        if (!message) continue;
        const line = node.getStartLineNumber();
        if (
          visitedLines?.has(line) ||
          (config.featureGuardTokens &&
            isProtectedByFeatureGuard(node, config.featureGuardTokens)) ||
          config.isGuarded?.(node, sourceFile, ctx)
        ) {
          continue;
        }
        visitedLines?.add(line);
        matches.push({ line, message });
      }

      return matches;
    },
  };
}

function isNestedTokenGroups(
  fastTokens: FastTokenSpec,
): fastTokens is readonly (readonly string[])[] {
  return fastTokens.length > 0 && Array.isArray(fastTokens[0]);
}

/**
 * Normalizes a `FastTokenSpec` into CNF (`readonly (readonly string[])[]`):
 * - empty -> `[]`
 * - flat `readonly string[]` -> `[fastTokens]`
 * - nested `readonly (readonly string[])[]` -> `fastTokens`
 */
export function normalizeFastTokenGroups(
  fastTokens?: FastTokenSpec,
): readonly (readonly string[])[] {
  if (!fastTokens || fastTokens.length === 0) {
    return [];
  }
  return isNestedTokenGroups(fastTokens) ? fastTokens : [fastTokens];
}

/**
 * Pre-checks whether file content satisfies all CNF token groups for a rule.
 */
export function matchesFastTokens(
  content: string,
  fastTokens?: FastTokenSpec,
): boolean {
  return normalizeFastTokenGroups(fastTokens).every((group) =>
    group.some((token) => content.includes(token)),
  );
}

export const fileContainsFastTokens = matchesFastTokens;

/**
 * Scans a JS/TS source string against a list of JsRuleMatchers using ts-morph.
 * Rules with `fastTokens` are screened before AST parsing.
 */
export function scanJsSource(
  filePath: string,
  fileContent: string,
  rules: readonly JsRuleMatcher[],
  project?: Project,
): { readonly matches: AnalyzerMatch[]; readonly sourceFile?: SourceFile } {
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(fileContent, rule.fastTokens),
  );
  if (activeRules.length === 0) {
    return { matches: [] };
  }

  const proj = project ?? getSharedVirtualProject();
  const existing = proj.getSourceFile(filePath);
  if (existing) {
    proj.removeSourceFile(existing);
  }
  const sourceFile = proj.createSourceFile(filePath, fileContent, {
    overwrite: true,
  });
  const ctx: JsMatcherContext = { filePath, fileContent };
  const matches: AnalyzerMatch[] = [];

  try {
    for (const rule of activeRules) {
      for (const match of rule.matchFile(sourceFile, ctx)) {
        matches.push(match);
      }
    }
  } finally {
    if (!project) {
      proj.removeSourceFile(sourceFile);
    }
  }

  return project ? { matches, sourceFile } : { matches };
}
