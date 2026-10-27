import {
  Node,
  Project,
  type CallExpression,
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import ts from 'typescript';
import type { AnalyzerMatch, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { isProtectedByFeatureGuard } from './ast-helpers.ts';

/**
 * Creates an ephemeral in-memory ts-morph Project optimized for AST scanning.
 */
export function createInMemoryProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
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

export interface JsCallMatcherConfig {
  readonly fastTokens?: readonly string[];
  readonly featureGuardTokens?: readonly string[];
  readonly dedupeLines?: boolean;
  readonly shouldSkipFile?: (
    sourceFile: SourceFile,
    ctx: JsMatcherContext,
  ) => boolean;
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
 * Builds a `JsRuleMatcher` that walks `CallExpression` and/or `NewExpression` descendants
 * in AST order, applying optional file-level skips, feature-guard checks, and per-line deduplication.
 */
export function createJsCallMatcher(config: JsCallMatcherConfig): JsRuleMatcher {
  return {
    kind: 'js',
    ...(config.fastTokens ? { fastTokens: config.fastTokens } : {}),
    matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
      if (config.shouldSkipFile?.(sourceFile, ctx)) {
        return [];
      }

      const matches: AnalyzerMatch[] = [];
      const visitedLines = config.dedupeLines ? new Set<number>() : null;

      sourceFile.forEachDescendant((node) => {
        const matchCall = config.matchCall;
        const matchNew = config.matchNew;
        if (matchCall && Node.isCallExpression(node)) {
          const line = node.getStartLineNumber();
          if (visitedLines?.has(line)) {
            return;
          }
          if (
            config.featureGuardTokens &&
            isProtectedByFeatureGuard(node, config.featureGuardTokens)
          ) {
            return;
          }
          if (config.isGuarded?.(node, sourceFile, ctx)) {
            return;
          }
          const message = matchCall(node, sourceFile, ctx);
          if (message) {
            visitedLines?.add(line);
            matches.push({ line, message });
          }
          return;
        }

        if (matchNew && Node.isNewExpression(node)) {
          const line = node.getStartLineNumber();
          if (visitedLines?.has(line)) {
            return;
          }
          if (
            config.featureGuardTokens &&
            isProtectedByFeatureGuard(node, config.featureGuardTokens)
          ) {
            return;
          }
          if (config.isGuarded?.(node, sourceFile, ctx)) {
            return;
          }
          const message = matchNew(node, sourceFile, ctx);
          if (message) {
            visitedLines?.add(line);
            matches.push({ line, message });
          }
        }
      });

      return matches;
    },
  };
}

/**
 * Pre-checks whether file content contains any of the required fast tokens for a rule.
 */
export function matchesFastTokens(
  content: string,
  fastTokens?: readonly string[],
): boolean {
  if (!fastTokens || fastTokens.length === 0) {
    return true;
  }
  return fastTokens.some((token) => content.includes(token));
}

/**
 * Scans a JS/TS source string against a list of JsRuleMatchers using ts-morph.
 * Rules with `fastTokens` are screened before AST parsing.
 */
export function scanJsSource(
  filePath: string,
  fileContent: string,
  rules: readonly JsRuleMatcher[],
  project?: Project,
): { matches: AnalyzerMatch[]; sourceFile?: SourceFile } {
  // 1. Filter rules by fastTokens
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(fileContent, rule.fastTokens),
  );

  if (activeRules.length === 0) {
    return { matches: [] };
  }

  // 2. Parse AST using provided Project or shared virtual Project
  const proj = project ?? getSharedVirtualProject();
  const sourceFile = proj.createSourceFile(filePath, fileContent, {
    overwrite: true,
  });

  const ctx: JsMatcherContext = {
    filePath,
    fileContent,
  };

  const matches: AnalyzerMatch[] = [];

  try {
    for (const rule of activeRules) {
      const ruleMatches = rule.matchFile(sourceFile, ctx);
      for (const m of ruleMatches) {
        matches.push(m);
      }
    }
  } finally {
    if (!project) {
      proj.removeSourceFile(sourceFile);
    }
  }

  return { matches, sourceFile };
}
