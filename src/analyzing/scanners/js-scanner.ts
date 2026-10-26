import { Project, type SourceFile } from 'ts-morph';
import ts from 'typescript';
import type { AnalyzerMatch, JsMatcherContext, JsRuleMatcher } from '../schema.ts';

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

  // 2. Parse AST using in-memory Project (creates a fresh project if none provided)
  const proj = project ?? createInMemoryProject();
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
