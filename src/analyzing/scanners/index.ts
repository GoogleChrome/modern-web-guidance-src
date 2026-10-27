import { createHash } from 'node:crypto';
import { open, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { Node, Project, SourceFile, SyntaxKind } from 'ts-morph';
import type {
  AnalyzerFinding,
  AnalyzerMatch,
  AnalyzerRule,
  CssRuleMatcher,
  DependencyRuleMatcher,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CARD_ID_HEX_LENGTH = 12;

/**
 * Computes a card ID matching Spec §2.1:
 * First 12 hex characters of SHA-256 of `${repo}:${commit}:${guideId}:${file}:${line}`.
 */
export function computeCardId(
  repo: string,
  commit: string,
  guideId: string,
  file: string,
  line: number,
): string {
  const payload = `${repo}:${commit}:${guideId}:${file}:${line}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, CARD_ID_HEX_LENGTH);
}
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
  isDocsOrTestsPath,
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
  isMarkupPath,
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

const GUIDE_HASH_HEX_LENGTH = 12;

/**
 * Computes the 12-char SHA-256 hash of a guide.md content string.
 */
export function computeGuideHash(guideContent: string): string {
  return createHash('sha256')
    .update(guideContent)
    .digest('hex')
    .slice(0, GUIDE_HASH_HEX_LENGTH);
}

export interface ScanOptions
  extends Pick<FileFilterOptions, 'excludeCorpusNonAppDirs' | 'includeDocsAndTests'> {
  readonly repo?: string;
  readonly commit?: string;
  readonly fileFilterOptions?: FileFilterOptions;
  readonly project?: Project;
}

export interface RepoScanOptions extends ScanOptions {
  readonly maxFiles?: number;
  readonly stats?: { skippedDocsAndTestsCount?: number };
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
  readonly contextSlice: string;
  readonly isVendoredLibrary?: boolean;
  readonly subPattern?: string;
}

function createFinding(params: FindingParams): AnalyzerFinding {
  const { rule, ctx, line, message, codeSnippet, contextSlice, isVendoredLibrary, subPattern } = params;
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
    contextSlice,
    ...(isVendoredLibrary ? { isVendoredLibrary } : {}),
    ...(subPattern ? { subPattern } : {}),
  };
}

function materializeFindings(
  ctx: FileContext,
  rule: AnalyzerRule,
  matches: readonly AnalyzerMatch[],
  sourceFile?: SourceFile,
  isVendoredLibrary?: boolean,
): AnalyzerFinding[] {
  return matches.map((match) => {
    const { codeSnippet, contextSlice } = sliceStructuredContext(
      ctx.relPath,
      ctx.content,
      match.line,
      sourceFile,
    );
    return createFinding({
      rule,
      ctx,
      line: match.line,
      message: match.message,
      codeSnippet,
      contextSlice,
      isVendoredLibrary,
      subPattern: match.subPattern,
    });
  });
}

function processVendoredLibraryFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: DependencyRuleMatcher })[],
): AnalyzerFinding[] {
  return rules.flatMap((rule) =>
    materializeFindings(
      ctx,
      rule,
      scanVendoredLibraryFile(ctx.relPath, ctx.content, [rule.matcher]),
      undefined,
      true,
    ),
  );
}

function processPackageJsonFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: DependencyRuleMatcher })[],
): AnalyzerFinding[] {
  return rules.flatMap((rule) =>
    materializeFindings(ctx, rule, scanPackageJson(ctx.relPath, ctx.content, [rule.matcher])),
  );
}

function processCssFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: CssRuleMatcher })[],
): AnalyzerFinding[] {
  return scanCssRules(ctx.relPath, ctx.content, rules).flatMap(({ rule, match }) =>
    materializeFindings(ctx, rule, [match]),
  );
}

function processHtmlFile(
  ctx: FileContext,
  rules: readonly (AnalyzerRule & { matcher: DomRuleMatcher })[],
): AnalyzerFinding[] {
  const preparedHtml = prepareHtmlForDomScan(ctx.relPath, ctx.content);
  return rules.flatMap((rule) =>
    materializeFindings(ctx, rule, scanHtml(ctx.relPath, preparedHtml, [rule.matcher])),
  );
}

function processJsxFile(
  ctx: FileContext,
  sourceFile: SourceFile,
  rules: readonly (AnalyzerRule & { matcher: DomRuleMatcher })[],
): AnalyzerFinding[] {
  return rules.flatMap((rule) =>
    materializeFindings(
      ctx,
      rule,
      scanJsx(ctx.relPath, sourceFile, [rule.matcher]),
      sourceFile,
    ),
  );
}

/**
 * Memoizes AST descendant queries and full-text slices on a SourceFile instance
 * so that 40+ active JS rules scanning the same file do not re-walk the TypeScript AST
 * or re-slice full source strings on every rule invocation.
 */
function memoizeSourceFileQueries(sourceFile: SourceFile): void {
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
      findings.push(...materializeFindings(ctx, rule, matches, sourceFile));
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
      findings.push(...materializeFindings(ctx, rule, matches, sourceFile));
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
  return scanCssRules(ctx.relPath, blankedCss, rules).flatMap(({ rule, match }) =>
    materializeFindings(ctx, rule, [match]),
  );
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

function resolveFileFilterOptions(options?: ScanOptions): FileFilterOptions | undefined {
  if (
    !options?.fileFilterOptions &&
    options?.excludeCorpusNonAppDirs === undefined &&
    options?.includeDocsAndTests === undefined
  ) {
    return undefined;
  }
  return {
    ...options?.fileFilterOptions,
    ...(options?.excludeCorpusNonAppDirs !== undefined
      ? { excludeCorpusNonAppDirs: options.excludeCorpusNonAppDirs }
      : {}),
    ...(options?.includeDocsAndTests !== undefined
      ? { includeDocsAndTests: options.includeDocsAndTests }
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
    try {
      if (!filterOpts?.includeDocsAndTests && isDocsOrTestsPath(relPath)) {
        continue;
      }

      const ctx: FileContext = { relPath, content, repo, commit };

      if (!shouldScanFile(relPath, content, filterOpts)) {
        if (
          depRules.length > 0 &&
          !isBuildOrInstallPath(relPath) &&
          !(filterOpts?.excludeCorpusNonAppDirs && isCorpusNonAppPath(relPath))
        ) {
          findings.push(...processVendoredLibraryFile(ctx, depRules));
        }
        continue;
      }

      const lowerPath = relPath.toLowerCase();

      if (lowerPath.endsWith('package.json') && depRules.length > 0) {
        findings.push(...processPackageJsonFile(ctx, depRules));
        continue;
      }

      if (lowerPath.endsWith('.css') && cssRules.length > 0) {
        findings.push(...processCssFile(ctx, cssRules));
        continue;
      }

      if (isMarkupPath(relPath)) {
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
    } catch {
      // Per-file exception boundary: an unexpected parser/AST exception on one malformed
      // file must not abort the entire repository scan.
    }
  }

  return findings;
}

interface WalkDirState {
  readonly repoDirPath: string;
  readonly fileMap: Map<string, string>;
  readonly maxFiles: number;
  readonly fileFilterOptions?: FileFilterOptions;
  readonly includeDocsAndTests: boolean;
  skippedDocsAndTestsCount: number;
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
      if (!state.includeDocsAndTests && isDocsOrTestsPath(relPath)) {
        if (
          shouldScanFile(relPath, undefined, {
            ...state.fileFilterOptions,
            includeDocsAndTests: true,
          })
        ) {
          state.skippedDocsAndTestsCount++;
        }
        continue;
      }

      const isScannableSource = shouldScanFile(relPath, undefined, state.fileFilterOptions);
      const isVendoredCandidate = isCandidateVendoredFile(relPath);

      if (isScannableSource || isVendoredCandidate) {
        try {
          const handle = await open(fullPath, 'r');
          try {
            const fileStat = await handle.stat();
            if (fileStat.size > MAX_SOURCE_FILE_BYTES) {
              continue;
            }
            const content = await handle.readFile('utf8');
            if (Buffer.byteLength(content, 'utf8') <= MAX_SOURCE_FILE_BYTES) {
              if (
                shouldScanFile(relPath, content, state.fileFilterOptions) ||
                isCandidateVendoredFile(relPath, content)
              ) {
                state.fileMap.set(relPath, content);
              }
            }
          } finally {
            await handle.close();
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
): Promise<AnalyzerFinding[] & { readonly skippedDocsAndTestsCount?: number }> {
  const fileMap = new Map<string, string>();
  const maxFiles = options?.maxFiles ?? 5000;

  const fileFilterOptions = resolveFileFilterOptions(options);
  const includeDocsAndTests = Boolean(
    options?.includeDocsAndTests ?? fileFilterOptions?.includeDocsAndTests,
  );

  const state: WalkDirState = {
    repoDirPath,
    fileMap,
    maxFiles,
    fileFilterOptions,
    includeDocsAndTests,
    skippedDocsAndTestsCount: 0,
  };

  await walkDirectory(repoDirPath, state);

  if (options?.stats) {
    options.stats.skippedDocsAndTestsCount = state.skippedDocsAndTestsCount;
  }

  const findings = scanFiles(fileMap, rules, {
    ...options,
    fileFilterOptions,
  }) as AnalyzerFinding[] & { skippedDocsAndTestsCount?: number };

  findings.skippedDocsAndTestsCount = state.skippedDocsAndTestsCount;
  return findings;
}
