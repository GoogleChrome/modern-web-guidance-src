import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { Project, SourceFile } from 'ts-morph';
import type {
  AnalyzerFinding,
  AnalyzerRule,
  CssRuleMatcher,
  DependencyRuleMatcher,
  DomRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';
import { computeCardId } from '../stats.ts';
import { sliceStructuredContext } from './context-slicer.ts';
import { scanCss } from './css-scanner.ts';
import { scanPackageJson } from './dependency-scanner.ts';
import { scanHtml, scanJsx } from './dom-scanner.ts';
import {
  isVendoredOrGeneratedPath,
  shouldScanFile,
  type FileFilterOptions,
} from './file-filter.ts';
import { createInMemoryProject, scanJsSource } from './js-scanner.ts';

export * from './ast-helpers.ts';
export * from './context-slicer.ts';
export * from './css-scanner.ts';
export * from './dependency-scanner.ts';
export * from './dom-scanner.ts';
export * from './file-filter.ts';
export * from './js-scanner.ts';

export const GUIDE_HASH_HEX_LENGTH = 12;

/**
 * Computes the 12-char SHA-256 hash of a guide.md content string per D-016.
 */
export function computeGuideHash(guideContent: string): string {
  return createHash('sha256')
    .update(guideContent)
    .digest('hex')
    .slice(0, GUIDE_HASH_HEX_LENGTH);
}

export interface ScanOptions {
  readonly repo?: string;
  readonly commit?: string;
  readonly fileFilterOptions?: FileFilterOptions;
}

export interface RepoScanOptions extends ScanOptions {
  readonly maxFiles?: number;
}

interface FileContext {
  readonly relPath: string;
  readonly content: string;
  readonly repo: string;
  readonly commit: string;
}

interface FindingParams {
  readonly rule: AnalyzerRule;
  readonly ctx: FileContext;
  readonly line: number;
  readonly message: string;
  readonly codeSnippet: string;
  readonly astSlice: string;
}

function createFinding(params: FindingParams): AnalyzerFinding {
  const { rule, ctx, line, message, codeSnippet, astSlice } = params;
  const cardId = computeCardId(ctx.repo, ctx.commit, rule.guideId, ctx.relPath, line);
  return {
    cardId,
    ruleId: rule.id,
    guideId: rule.guideId,
    guideHash: rule.guideHash,
    repo: ctx.repo,
    commit: ctx.commit,
    file: ctx.relPath,
    line,
    message,
    codeSnippet,
    astSlice,
  };
}

function processPackageJsonFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: DependencyRuleMatcher })[],
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  for (const rule of rules) {
    const matches = scanPackageJson(ctx.relPath, ctx.content, [rule.matcher]);
    for (const match of matches) {
      const { codeSnippet, astSlice } = sliceStructuredContext(
        ctx.relPath,
        ctx.content,
        match.line,
      );
      findings.push(
        createFinding({
          rule,
          ctx,
          line: match.line,
          message: match.message,
          codeSnippet,
          astSlice,
        }),
      );
    }
  }
  return findings;
}

function processCssFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: CssRuleMatcher })[],
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  for (const rule of rules) {
    const matches = scanCss(ctx.relPath, ctx.content, [rule.matcher]);
    for (const match of matches) {
      const { codeSnippet, astSlice } = sliceStructuredContext(
        ctx.relPath,
        ctx.content,
        match.line,
      );
      findings.push(
        createFinding({
          rule,
          ctx,
          line: match.line,
          message: match.message,
          codeSnippet,
          astSlice,
        }),
      );
    }
  }
  return findings;
}

function processHtmlFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: DomRuleMatcher })[],
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  for (const rule of rules) {
    const matches = scanHtml(ctx.relPath, ctx.content, [rule.matcher]);
    for (const match of matches) {
      const { codeSnippet, astSlice } = sliceStructuredContext(
        ctx.relPath,
        ctx.content,
        match.line,
      );
      findings.push(
        createFinding({
          rule,
          ctx,
          line: match.line,
          message: match.message,
          codeSnippet,
          astSlice,
        }),
      );
    }
  }
  return findings;
}

function processJsxFile(
  ctx: FileContext,
  sourceFile: SourceFile,
  rules: readonly (AnalyzerRule & { matcher: DomRuleMatcher })[],
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  for (const rule of rules) {
    const matches = scanJsx(ctx.relPath, sourceFile, [rule.matcher]);
    for (const match of matches) {
      const { codeSnippet, astSlice } = sliceStructuredContext(
        ctx.relPath,
        ctx.content,
        match.line,
        sourceFile,
      );
      findings.push(
        createFinding({
          rule,
          ctx,
          line: match.line,
          message: match.message,
          codeSnippet,
          astSlice,
        }),
      );
    }
  }
  return findings;
}

function processJsFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: JsRuleMatcher })[],
  project: Project,
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  for (const rule of rules) {
    const { matches, sourceFile } = scanJsSource(
      ctx.relPath,
      ctx.content,
      [rule.matcher],
      project,
    );
    try {
      for (const match of matches) {
        const { codeSnippet, astSlice } = sliceStructuredContext(
          ctx.relPath,
          ctx.content,
          match.line,
          sourceFile,
        );
        findings.push(
          createFinding({
            rule,
            ctx,
            line: match.line,
            message: match.message,
            codeSnippet,
            astSlice,
          }),
        );
      }
    } finally {
      if (sourceFile) {
        project.removeSourceFile(sourceFile);
      }
    }
  }
  return findings;
}

/**
 * Scans an in-memory map of files (relPath -> content) against a suite of AnalyzerRules.
 */
export function scanFiles(
  files: ReadonlyMap<string, string>,
  rules: readonly AnalyzerRule[],
  options?: ScanOptions,
): AnalyzerFinding[] {
  const repo = options?.repo ?? 'unknown';
  const commit = options?.commit ?? 'unknown';

  const jsRules = rules.filter(
    (r): r is AnalyzerRule & { matcher: JsRuleMatcher } =>
      r.matcher.kind === 'js',
  );
  const domRules = rules.filter(
    (r): r is AnalyzerRule & { matcher: DomRuleMatcher } =>
      r.matcher.kind === 'dom',
  );
  const cssRules = rules.filter(
    (r): r is AnalyzerRule & { matcher: CssRuleMatcher } =>
      r.matcher.kind === 'css',
  );
  const depRules = rules.filter(
    (r): r is AnalyzerRule & { matcher: DependencyRuleMatcher } =>
      r.matcher.kind === 'dependency',
  );

  const findings: AnalyzerFinding[] = [];
  const project = createInMemoryProject();

  for (const [relPath, content] of files) {
    if (!shouldScanFile(relPath, content, options?.fileFilterOptions)) {
      continue;
    }

    const ctx: FileContext = { relPath, content, repo, commit };
    const lowerPath = relPath.toLowerCase();

    if (lowerPath.endsWith('package.json') && depRules.length > 0) {
      findings.push(...processPackageJsonFile(ctx, depRules));
      continue;
    }

    if (lowerPath.endsWith('.css') && cssRules.length > 0) {
      findings.push(...processCssFile(ctx, cssRules));
      continue;
    }

    const isHtml =
      lowerPath.endsWith('.html') ||
      lowerPath.endsWith('.htm') ||
      lowerPath.endsWith('.php') ||
      lowerPath.endsWith('.vue') ||
      lowerPath.endsWith('.svelte');
    if (isHtml && domRules.length > 0) {
      findings.push(...processHtmlFile(ctx, domRules));
      continue;
    }

    const isJsxLike = lowerPath.endsWith('.jsx') || lowerPath.endsWith('.tsx');
    if (isJsxLike && domRules.length > 0) {
      const sourceFile = project.createSourceFile(relPath, content, { overwrite: true });
      try {
        findings.push(...processJsxFile(ctx, sourceFile, domRules));
      } finally {
        project.removeSourceFile(sourceFile);
      }
    }

    const isJsLike =
      lowerPath.endsWith('.js') ||
      lowerPath.endsWith('.mjs') ||
      lowerPath.endsWith('.cjs') ||
      lowerPath.endsWith('.ts') ||
      isJsxLike;
    if (isJsLike && jsRules.length > 0) {
      findings.push(...processJsFile(ctx, jsRules, project));
    }
  }

  return findings;
}

interface WalkDirState {
  readonly repoDirPath: string;
  readonly fileMap: Map<string, string>;
  readonly maxFiles: number;
  readonly fileFilterOptions?: FileFilterOptions;
}

async function walkDirectory(currentDir: string, state: WalkDirState): Promise<void> {
  if (state.fileMap.size >= state.maxFiles) {
    return;
  }

  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (state.fileMap.size >= state.maxFiles) {
      return;
    }

    const fullPath = join(currentDir, entry.name);
    const relPath = relative(state.repoDirPath, fullPath);

    if (entry.isDirectory()) {
      if (!isVendoredOrGeneratedPath(relPath)) {
        await walkDirectory(fullPath, state);
      }
      continue;
    }

    if (entry.isFile() && shouldScanFile(relPath, undefined, state.fileFilterOptions)) {
      try {
        const content = await readFile(fullPath, 'utf8');
        if (shouldScanFile(relPath, content, state.fileFilterOptions)) {
          state.fileMap.set(relPath, content);
        }
      } catch {
        // Unreadable or binary file
      }
    }
  }
}

/**
 * Traverses a repository directory on disk and scans all eligible files against AnalyzerRules.
 */
export async function scanRepoFiles(
  repoDirPath: string,
  rules: readonly AnalyzerRule[],
  options?: RepoScanOptions,
): Promise<AnalyzerFinding[]> {
  const fileMap = new Map<string, string>();
  const maxFiles = options?.maxFiles ?? 2000;

  await walkDirectory(repoDirPath, {
    repoDirPath,
    fileMap,
    maxFiles,
    fileFilterOptions: options?.fileFilterOptions,
  });

  return scanFiles(fileMap, rules, options);
}
