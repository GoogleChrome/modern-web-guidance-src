import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { open, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
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
  RuleMatcher,
} from '../schema.ts';
import { sliceStructuredContext } from './context-slicer.ts';
import { scanCssRules } from './css-scanner.ts';
import {
  scanPackageJsonRules,
  scanVendoredLibraryRules,
} from './dependency-scanner.ts';
import { scanHtmlRules, scanJsxRules } from './dom-scanner.ts';
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
} from './sfc-extractor.ts';

export * from './ast-helpers.ts';
export * from './context-slicer.ts';
export * from './css-scanner.ts';
export * from './dependency-scanner.ts';
export * from './dom-scanner.ts';
export * from './file-filter.ts';
export * from './js-scanner.ts';
export * from './sfc-extractor.ts';

export const CARD_ID_HEX_LENGTH = 12;

function sha256Hex12(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, CARD_ID_HEX_LENGTH);
}

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
  return sha256Hex12(`${repo}:${commit}:${guideId}:${file}:${line}`);
}

/**
 * Computes the 12-char SHA-256 hash of a guide.md content string.
 */
export function computeGuideHash(guideContent: string): string {
  return sha256Hex12(guideContent);
}

export interface ScanOptions extends FileFilterOptions {
  readonly repo?: string;
  readonly commit?: string;
  readonly fileFilterOptions?: FileFilterOptions;
  readonly project?: Project;
}

export interface RepoScanOptions extends ScanOptions {
  readonly maxFiles?: number;
  readonly stats?: { skippedDocsAndTestsCount?: number };
}

type RuleWith<M extends RuleMatcher> = AnalyzerRule & { readonly matcher: M };

interface FileRuleBundle {
  readonly dom: readonly RuleWith<DomRuleMatcher>[];
  readonly js: readonly RuleWith<JsRuleMatcher>[];
  readonly css: readonly RuleWith<CssRuleMatcher>[];
}

interface FileContext {
  readonly relPath: string;
  readonly content: string;
  readonly repo: string;
  readonly commit: string;
}

function materializeFinding(
  ctx: FileContext,
  rule: AnalyzerRule,
  match: AnalyzerMatch,
  sourceFile?: SourceFile,
): AnalyzerFinding {
  const { codeSnippet, contextSlice, lineContent } = sliceStructuredContext(
    ctx.relPath,
    ctx.content,
    match.line,
    sourceFile,
  );
  return {
    cardId: computeCardId(ctx.repo, ctx.commit, rule.guideId, ctx.relPath, match.line),
    ruleId: rule.id,
    guideId: rule.guideId,
    guideHash: rule.guideHash,
    repo: ctx.repo,
    commit: ctx.commit,
    file: ctx.relPath,
    line: match.line,
    message: match.message,
    codeSnippet,
    contextSlice,
    lineContent,
    ...(match.isVendoredLibrary ? { isVendoredLibrary: true } : {}),
    ...(match.subPattern ? { subPattern: match.subPattern } : {}),
  };
}

function materializeRuleMatches(
  ctx: FileContext,
  hits: readonly { readonly rule: AnalyzerRule; readonly match: AnalyzerMatch }[],
  sourceFile?: SourceFile,
): AnalyzerFinding[] {
  return hits.map(({ rule, match }) => materializeFinding(ctx, rule, match, sourceFile));
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
    let cached = descendantsCache.get(kind);
    if (!cached) {
      cached = origGetDescendantsOfKind(kind);
      descendantsCache.set(kind, cached);
    }
    return cached.slice();
  }) as SourceFile['getDescendantsOfKind'];

  const origGetFullText = sourceFile.getFullText.bind(sourceFile);
  let cachedFullText: string | undefined;
  sourceFile.getFullText = (): string => (cachedFullText ??= origGetFullText());

  const origGetText = sourceFile.getText.bind(sourceFile);
  let cachedTextDefault: string | undefined;
  let cachedTextWithJsDoc: string | undefined;
  sourceFile.getText = ((
    arg?: boolean | { trimLeadingIndentation?: boolean; includeJsDocComments?: boolean },
  ): string => {
    if (typeof arg === 'object' && arg !== null) {
      return origGetText(arg);
    }
    return arg
      ? (cachedTextWithJsDoc ??= origGetText(true))
      : (cachedTextDefault ??= origGetText(false));
  }) as SourceFile['getText'];
}

function scanJsAst(
  ctx: FileContext,
  parsePath: string,
  parseContent: string,
  jsRules: readonly RuleWith<JsRuleMatcher>[],
  domRules: readonly RuleWith<DomRuleMatcher>[],
  project: Project,
): AnalyzerFinding[] {
  const activeDomRules = domRules.filter((rule) =>
    matchesFastTokens(parseContent, rule.matcher.fastTokens),
  );
  const activeJsRules = jsRules.filter((rule) =>
    matchesFastTokens(parseContent, rule.matcher.fastTokens),
  );
  if (activeDomRules.length === 0 && activeJsRules.length === 0) {
    return [];
  }

  const sourceFile = project.createSourceFile(parsePath, parseContent, {
    overwrite: true,
  });
  memoizeSourceFileQueries(sourceFile);

  const matcherCtx: JsMatcherContext = {
    filePath: parsePath,
    fileContent: parseContent,
  };

  const findings: AnalyzerFinding[] = [];
  try {
    if (activeDomRules.length > 0) {
      findings.push(
        ...materializeRuleMatches(
          ctx,
          scanJsxRules(ctx.relPath, sourceFile, activeDomRules),
          sourceFile,
        ),
      );
    }
    for (const rule of activeJsRules) {
      for (const match of rule.matcher.matchFile(sourceFile, matcherCtx)) {
        findings.push(materializeFinding(ctx, rule, match, sourceFile));
      }
    }
  } finally {
    project.removeSourceFile(sourceFile);
  }
  return findings;
}

function scanCssContent(
  ctx: FileContext,
  cssText: string,
  rules: readonly RuleWith<CssRuleMatcher>[],
): AnalyzerFinding[] {
  return materializeRuleMatches(ctx, scanCssRules(ctx.relPath, cssText, rules));
}

function scanExtractedStyles(
  ctx: FileContext,
  rules: readonly RuleWith<CssRuleMatcher>[],
): AnalyzerFinding[] {
  if (rules.length === 0) return [];
  const findings: AnalyzerFinding[] = [];
  for (const blankedCss of extractStyleBlocks(ctx.relPath, ctx.content)) {
    if (!isMinifiedContent(blankedCss)) {
      findings.push(...scanCssContent(ctx, blankedCss, rules));
    }
  }
  return findings;
}

function processMultiBlockFile(
  ctx: FileContext,
  rules: FileRuleBundle,
  project: Project,
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];

  if (rules.dom.length > 0) {
    const preparedHtml = prepareHtmlForDomScan(ctx.relPath, ctx.content);
    findings.push(
      ...materializeRuleMatches(ctx, scanHtmlRules(ctx.relPath, preparedHtml, rules.dom)),
    );
  }

  if (rules.js.length > 0) {
    for (const block of extractScriptBlocks(ctx.relPath, ctx.content)) {
      if (!isMinifiedContent(block.blankedContent)) {
        findings.push(
          ...scanJsAst(ctx, block.virtualPath, block.blankedContent, rules.js, [], project),
        );
      }
    }
  }

  findings.push(...scanExtractedStyles(ctx, rules.css));
  return findings;
}

const JSX_EXTENSIONS = new Set(['.jsx', '.tsx']);
const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx']);

function processJavaScriptFile(
  ctx: FileContext,
  ext: string,
  rules: FileRuleBundle,
  project: Project,
): AnalyzerFinding[] {
  const domRules = JSX_EXTENSIONS.has(ext) ? rules.dom : [];
  const findings = scanJsAst(ctx, ctx.relPath, ctx.content, rules.js, domRules, project);

  if (ctx.content.includes('css`')) {
    findings.push(...scanExtractedStyles(ctx, rules.css));
  }

  return findings;
}

function resolveFileFilterOptions(options?: ScanOptions): FileFilterOptions | undefined {
  if (
    !options?.fileFilterOptions &&
    options?.customIgnoredDirs === undefined &&
    options?.excludeCorpusNonAppDirs === undefined &&
    options?.includeDocsAndTests === undefined
  ) {
    return undefined;
  }
  return {
    ...options?.fileFilterOptions,
    ...(options?.customIgnoredDirs !== undefined
      ? { customIgnoredDirs: options.customIgnoredDirs }
      : {}),
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

  const jsRules = rules.filter((r): r is RuleWith<JsRuleMatcher> => r.matcher.kind === 'js');
  const domRules = rules.filter((r): r is RuleWith<DomRuleMatcher> => r.matcher.kind === 'dom');
  const cssRules = rules.filter((r): r is RuleWith<CssRuleMatcher> => r.matcher.kind === 'css');
  const depRules = rules.filter(
    (r): r is RuleWith<DependencyRuleMatcher> => r.matcher.kind === 'dependency',
  );

  const ruleBundle: FileRuleBundle = { dom: domRules, js: jsRules, css: cssRules };
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
          findings.push(
            ...materializeRuleMatches(ctx, scanVendoredLibraryRules(relPath, content, depRules)),
          );
        }
        continue;
      }

      const lowerPath = relPath.toLowerCase();

      if (lowerPath.endsWith('package.json')) {
        if (depRules.length > 0) {
          findings.push(
            ...materializeRuleMatches(ctx, scanPackageJsonRules(relPath, content, depRules)),
          );
        }
        continue;
      }

      const ext = extname(lowerPath);

      if (ext === '.css') {
        if (cssRules.length > 0) {
          findings.push(...scanCssContent(ctx, content, cssRules));
        }
        continue;
      }

      if (isMarkupPath(lowerPath)) {
        findings.push(...processMultiBlockFile(ctx, ruleBundle, project));
        continue;
      }

      if (JS_EXTENSIONS.has(ext)) {
        findings.push(...processJavaScriptFile(ctx, ext, ruleBundle, project));
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
  skippedDocsAndTestsCount: number;
}

async function walkDirectory(currentDir: string, state: WalkDirState): Promise<void> {
  if (state.fileMap.size >= state.maxFiles) {
    return;
  }

  let entries: Dirent[];
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
    const relPath = relative(state.repoDirPath, fullPath).replace(/\\/g, '/');

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
      if (!state.fileFilterOptions?.includeDocsAndTests && isDocsOrTestsPath(relPath)) {
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

      if (
        shouldScanFile(relPath, undefined, state.fileFilterOptions) ||
        isCandidateVendoredFile(relPath)
      ) {
        try {
          const handle = await open(fullPath, 'r');
          try {
            const fileStat = await handle.stat();
            if (fileStat.size <= MAX_SOURCE_FILE_BYTES) {
              const content = await handle.readFile('utf8');
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
): Promise<AnalyzerFinding[]> {
  const fileMap = new Map<string, string>();
  const maxFiles = options?.maxFiles ?? 5000;
  const fileFilterOptions = resolveFileFilterOptions(options);

  const state: WalkDirState = {
    repoDirPath,
    fileMap,
    maxFiles,
    fileFilterOptions,
    skippedDocsAndTestsCount: 0,
  };

  await walkDirectory(repoDirPath, state);

  if (options?.stats) {
    options.stats.skippedDocsAndTestsCount = state.skippedDocsAndTestsCount;
  }

  return scanFiles(fileMap, rules, {
    ...options,
    fileFilterOptions,
  });
}
