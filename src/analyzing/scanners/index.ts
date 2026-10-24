import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { Node, Project, SourceFile, SyntaxKind } from 'ts-morph';
import type {
  AnalyzerFinding,
  AnalyzerRule,
  CssRuleMatcher,
  DependencyRuleMatcher,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';
import { computeCardId } from '../stats.ts';
import { sliceStructuredContext } from './context-slicer.ts';
import { scanCssRules } from './css-scanner.ts';
import {
  scanPackageJson,
  scanVendoredLibraryFile,
} from './dependency-scanner.ts';
import { scanHtml, scanJsx } from './dom-scanner.ts';
import {
  BUILD_OR_INSTALL_DIR_SEGMENTS,
  CORPUS_NON_APP_DIR_SEGMENTS,
  isBuildOrInstallPath,
  isCandidateVendoredFile,
  isCorpusNonAppPath,
  isMinifiedContent,
  MAX_SOURCE_FILE_BYTES,
  shouldScanFile,
  type FileFilterOptions,
} from './file-filter.ts';
import {
  createInMemoryProject,
  matchesFastTokens,
} from './js-scanner.ts';
import {
  extractScriptBlocks,
  extractStyleBlocks,
  prepareHtmlForDomScan,
  type ScriptBlock,
} from './sfc-extractor.ts';

export * from './ast-helpers.ts';
export * from './context-slicer.ts';
export * from './css-scanner.ts';
export * from './dependency-scanner.ts';
export * from './dom-scanner.ts';
export * from './file-filter.ts';
export * from './js-scanner.ts';
export * from './sfc-extractor.ts';

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
  readonly excludeCorpusNonAppDirs?: boolean;
  readonly project?: Project;
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
  readonly kind?: 'vendored-library';
}

function createFinding(params: FindingParams): AnalyzerFinding {
  const { rule, ctx, line, message, codeSnippet, astSlice, kind } = params;
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
    ...(kind ? { kind } : {}),
  };
}

function processVendoredLibraryFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: DependencyRuleMatcher })[],
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  for (const rule of rules) {
    const matches = scanVendoredLibraryFile(ctx.relPath, ctx.content, [rule.matcher]);
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
          kind: 'vendored-library',
        }),
      );
    }
  }
  return findings;
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
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(ctx.content, rule.matcher.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  const findings: AnalyzerFinding[] = [];
  const results = scanCssRules(ctx.relPath, ctx.content, activeRules);
  for (const { rule, match } of results) {
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
  return findings;
}

function processHtmlFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: DomRuleMatcher })[],
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  const preparedHtml = prepareHtmlForDomScan(ctx.relPath, ctx.content);

  for (const rule of rules) {
    const matches = scanHtml(ctx.relPath, preparedHtml, [rule.matcher]);
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

/**
 * Memoizes AST descendant queries and full-text slices on a SourceFile instance (O2)
 * so that 40+ active JS rules scanning the same file do not re-walk the TypeScript AST
 * or re-slice full source strings on every rule invocation.
 */
export function memoizeSourceFileQueries(sourceFile: SourceFile): void {
  const origGetDescendantsOfKind = sourceFile.getDescendantsOfKind.bind(sourceFile);
  const descendantsCache = new Map<SyntaxKind, Node[]>();

  sourceFile.getDescendantsOfKind = (<TKind extends SyntaxKind>(kind: TKind) => {
    const cached = descendantsCache.get(kind);
    if (cached !== undefined) {
      return cached.slice();
    }
    const nodes = origGetDescendantsOfKind(kind);
    descendantsCache.set(kind, nodes);
    return nodes.slice();
  }) as SourceFile['getDescendantsOfKind'];

  const origGetFullText = sourceFile.getFullText.bind(sourceFile);
  let cachedFullText: string | undefined;
  sourceFile.getFullText = (): string => {
    if (cachedFullText === undefined) {
      cachedFullText = origGetFullText();
    }
    return cachedFullText;
  };

  const origGetText = sourceFile.getText.bind(sourceFile);
  let cachedTextDefault: string | undefined;
  let cachedTextWithJsDoc: string | undefined;
  sourceFile.getText = ((
    arg?: boolean | { trimLeadingIndentation?: boolean; includeJsDocComments?: boolean },
  ): string => {
    if (typeof arg === 'object' && arg !== null) {
      return origGetText(arg);
    }
    if (arg) {
      if (cachedTextWithJsDoc === undefined) {
        cachedTextWithJsDoc = origGetText(true);
      }
      return cachedTextWithJsDoc;
    }
    if (cachedTextDefault === undefined) {
      cachedTextDefault = origGetText(false);
    }
    return cachedTextDefault;
  }) as SourceFile['getText'];
}

function processJsFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: JsRuleMatcher })[],
  project: Project,
  existingSourceFile?: SourceFile,
): AnalyzerFinding[] {
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(ctx.content, rule.matcher.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  const sourceFile =
    existingSourceFile ??
    project.createSourceFile(ctx.relPath, ctx.content, {
      overwrite: true,
    });
  if (!existingSourceFile) {
    memoizeSourceFileQueries(sourceFile);
  }

  const matcherCtx: JsMatcherContext = {
    filePath: ctx.relPath,
    fileContent: ctx.content,
  };

  const findings: AnalyzerFinding[] = [];
  try {
    for (const rule of activeRules) {
      const matches = rule.matcher.matchFile(sourceFile, matcherCtx);
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
  } finally {
    if (!existingSourceFile) {
      project.removeSourceFile(sourceFile);
    }
  }
  return findings;
}

function processScriptBlock(
  ctx: FileContext,
  block: ScriptBlock,
  rules: readonly (AnalyzerRule & { matcher: JsRuleMatcher })[],
  project: Project,
): AnalyzerFinding[] {
  if (isMinifiedContent(block.blankedContent)) {
    return [];
  }
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(block.blankedContent, rule.matcher.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  const sourceFile = project.createSourceFile(block.virtualPath, block.blankedContent, {
    overwrite: true,
  });
  memoizeSourceFileQueries(sourceFile);

  const matcherCtx: JsMatcherContext = {
    filePath: block.virtualPath,
    fileContent: block.blankedContent,
  };

  const findings: AnalyzerFinding[] = [];
  try {
    for (const rule of activeRules) {
      const matches = rule.matcher.matchFile(sourceFile, matcherCtx);
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
  } finally {
    project.removeSourceFile(sourceFile);
  }
  return findings;
}

function processStyleBlock(
  ctx: FileContext,
  blankedCss: string,
  rules: readonly (AnalyzerRule & { matcher: CssRuleMatcher })[],
): AnalyzerFinding[] {
  if (isMinifiedContent(blankedCss)) {
    return [];
  }
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(blankedCss, rule.matcher.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  const findings: AnalyzerFinding[] = [];
  const results = scanCssRules(ctx.relPath, blankedCss, activeRules);
  for (const { rule, match } of results) {
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
  return findings;
}

function processMultiBlockFile(
  ctx: FileContext,
  rules: {
    readonly dom: readonly (AnalyzerRule & { matcher: DomRuleMatcher })[];
    readonly js: readonly (AnalyzerRule & { matcher: JsRuleMatcher })[];
    readonly css: readonly (AnalyzerRule & { matcher: CssRuleMatcher })[];
  },
  project: Project,
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];

  if (rules.dom.length > 0) {
    findings.push(...processHtmlFile(ctx, rules.dom));
  }

  if (rules.js.length > 0) {
    const scriptBlocks = extractScriptBlocks(ctx.relPath, ctx.content);
    for (const block of scriptBlocks) {
      findings.push(...processScriptBlock(ctx, block, rules.js, project));
    }
  }

  if (rules.css.length > 0) {
    const styleBlocks = extractStyleBlocks(ctx.relPath, ctx.content);
    for (const blankedCss of styleBlocks) {
      findings.push(...processStyleBlock(ctx, blankedCss, rules.css));
    }
  }

  return findings;
}

function processJavaScriptFile(
  ctx: FileContext,
  rules: {
    readonly dom: readonly (AnalyzerRule & { matcher: DomRuleMatcher })[];
    readonly js: readonly (AnalyzerRule & { matcher: JsRuleMatcher })[];
    readonly css: readonly (AnalyzerRule & { matcher: CssRuleMatcher })[];
  },
  project: Project,
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  const lowerPath = ctx.relPath.toLowerCase();
  const isJsxLike = lowerPath.endsWith('.jsx') || lowerPath.endsWith('.tsx');

  if (isJsxLike) {
    const activeJsRules = rules.js.filter((rule) =>
      matchesFastTokens(ctx.content, rule.matcher.fastTokens),
    );
    const needsSourceFile = rules.dom.length > 0 || activeJsRules.length > 0;
    if (needsSourceFile) {
      const sourceFile = project.createSourceFile(ctx.relPath, ctx.content, { overwrite: true });
      memoizeSourceFileQueries(sourceFile);
      try {
        if (rules.dom.length > 0) {
          findings.push(...processJsxFile(ctx, sourceFile, rules.dom));
        }
        if (activeJsRules.length > 0) {
          findings.push(...processJsFile(ctx, activeJsRules, project, sourceFile));
        }
      } finally {
        project.removeSourceFile(sourceFile);
      }
    }
  } else {
    if (rules.js.length > 0) {
      findings.push(...processJsFile(ctx, rules.js, project));
    }
  }

  if (rules.css.length > 0 && ctx.content.includes('css`')) {
    const litStyleBlocks = extractStyleBlocks(ctx.relPath, ctx.content);
    for (const blankedCss of litStyleBlocks) {
      findings.push(...processStyleBlock(ctx, blankedCss, rules.css));
    }
  }

  return findings;
}

function ctxForVendored(
  relPath: string,
  content: string,
  repo: string,
  commit: string,
): FileContext {
  return { relPath, content, repo, commit };
}

function resolveFileFilterOptions(options?: ScanOptions): FileFilterOptions | undefined {
  if (!options?.fileFilterOptions && options?.excludeCorpusNonAppDirs === undefined) {
    return undefined;
  }
  return {
    ...options.fileFilterOptions,
    ...(options.excludeCorpusNonAppDirs !== undefined
      ? { excludeCorpusNonAppDirs: options.excludeCorpusNonAppDirs }
      : {}),
  };
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

  const ruleBundle = { dom: domRules, js: jsRules, css: cssRules };
  const findings: AnalyzerFinding[] = [];
  const project = options?.project ?? createInMemoryProject();

  const filterOpts = resolveFileFilterOptions(options);

  for (const [relPath, content] of files) {
    if (!shouldScanFile(relPath, content, filterOpts)) {
      if (
        depRules.length > 0 &&
        !isBuildOrInstallPath(relPath) &&
        !(filterOpts?.excludeCorpusNonAppDirs && isCorpusNonAppPath(relPath))
      ) {
        findings.push(...processVendoredLibraryFile(ctxForVendored(relPath, content, repo, commit), depRules));
      }
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

    const isMultiBlock =
      lowerPath.endsWith('.html') ||
      lowerPath.endsWith('.htm') ||
      lowerPath.endsWith('.php') ||
      lowerPath.endsWith('.vue') ||
      lowerPath.endsWith('.svelte') ||
      lowerPath.endsWith('.astro');

    if (isMultiBlock) {
      findings.push(...processMultiBlockFile(ctx, ruleBundle, project));
      continue;
    }

    const isJsLike =
      lowerPath.endsWith('.js') ||
      lowerPath.endsWith('.mjs') ||
      lowerPath.endsWith('.cjs') ||
      lowerPath.endsWith('.ts') ||
      lowerPath.endsWith('.mts') ||
      lowerPath.endsWith('.cts') ||
      lowerPath.endsWith('.jsx') ||
      lowerPath.endsWith('.tsx');

    if (isJsLike) {
      findings.push(...processJavaScriptFile(ctx, ruleBundle, project));
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

  // Sort entries alphabetically for deterministic traversal across environments (S5)
  entries.sort((entryA, entryB) => entryA.name.localeCompare(entryB.name));

  for (const entry of entries) {
    if (state.fileMap.size >= state.maxFiles) {
      return;
    }

    const fullPath = join(currentDir, entry.name);
    const relPath = relative(state.repoDirPath, fullPath);

    if (entry.isDirectory()) {
      const dirLower = entry.name.toLowerCase();
      if (
        BUILD_OR_INSTALL_DIR_SEGMENTS.has(dirLower) ||
        state.fileFilterOptions?.customIgnoredDirs?.has(dirLower) ||
        (state.fileFilterOptions?.excludeCorpusNonAppDirs &&
          CORPUS_NON_APP_DIR_SEGMENTS.has(dirLower))
      ) {
        continue;
      }
      await walkDirectory(fullPath, state);
      continue;
    }

    if (entry.isFile()) {
      const isScannableSource = shouldScanFile(relPath, undefined, state.fileFilterOptions);
      const isVendoredCandidate = isCandidateVendoredFile(relPath);

      if (isScannableSource || isVendoredCandidate) {
        try {
          const content = await readFile(fullPath, 'utf8');
          if (Buffer.byteLength(content, 'utf8') <= MAX_SOURCE_FILE_BYTES) {
            if (
              shouldScanFile(relPath, content, state.fileFilterOptions) ||
              isCandidateVendoredFile(relPath, content)
            ) {
              state.fileMap.set(relPath, content);
            }
          }
        } catch {
          // Unreadable or binary file
        }
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
  const maxFiles = options?.maxFiles ?? 5000;

  const fileFilterOptions = resolveFileFilterOptions(options);

  await walkDirectory(repoDirPath, {
    repoDirPath,
    fileMap,
    maxFiles,
    fileFilterOptions,
  });

  return scanFiles(fileMap, rules, {
    ...options,
    fileFilterOptions,
  });
}
