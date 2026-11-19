import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { open, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Node, Project, SourceFile, SyntaxKind } from 'ts-morph';
import type {
  ScanFinding,
  ScanMatch,
  ScanRule,
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
  isPackageJsonPath,
  MAX_SOURCE_FILE_BYTES,
  shouldScanFile,
  type FileFilterOptions,
} from './file-filter.ts';
import {
  getEnginesForSourceExtension,
  JS_EXTENSIONS,
  JSX_EXTENSIONS,
  STYLESHEET_EXTENSIONS,
  type FormatEngine,
} from './format-registry.ts';
import {
  createInMemoryProject,
  matchesFastTokens,
} from './js-scanner.ts';
import {
  extractScriptBlocks,
  extractStyleBlocks,
  isMarkupPath,
  prepareHtmlForDomScan,
  stripPreprocessorLineComments,
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

export const DEFAULT_MAX_FILES = 5000;

export interface RepoScanStats {
  skippedDocsAndTestsCount?: number;
  scannedFileCount?: number;
  eligibleFileCount?: number;
  truncatedByMaxFiles?: boolean;
}

export interface RepoScanOptions extends ScanOptions {
  readonly maxFiles?: number;
  readonly stats?: RepoScanStats;
}

/**
 * Resolves a programmatic `maxFiles` option (`undefined` -> `DEFAULT_MAX_FILES`,
 * `0` or `Infinity` -> unlimited / `Infinity`), throwing on invalid finite values.
 */
export function resolveMaxFiles(maxFiles?: number): number {
  if (maxFiles === undefined) {
    return DEFAULT_MAX_FILES;
  }
  if (maxFiles === 0 || maxFiles === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 0) {
    throw new RangeError(
      `Invalid maxFiles value (${String(maxFiles)}): expected a non-negative safe integer (0 or Infinity for unlimited).`,
    );
  }
  return maxFiles;
}

type RuleWith<M extends RuleMatcher> = ScanRule & { readonly matcher: M };

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
  rule: ScanRule,
  match: ScanMatch,
  sourceFile?: SourceFile,
): ScanFinding {
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
  hits: readonly { readonly rule: ScanRule; readonly match: ScanMatch }[],
  sourceFile?: SourceFile,
): ScanFinding[] {
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

interface JsProjectPool {
  project: Project;
  readonly isExternalProject: boolean;
  parsedCount: number;
}

const EPHEMERAL_PROJECT_ROTATION_INTERVAL = 25;

function acquireProjectForFile(pool: JsProjectPool): Project {
  if (!pool.isExternalProject && pool.parsedCount >= EPHEMERAL_PROJECT_ROTATION_INTERVAL) {
    pool.project = createInMemoryProject();
    pool.parsedCount = 0;
  }
  pool.parsedCount++;
  return pool.project;
}

function scanJsAst(
  ctx: FileContext,
  parsePath: string,
  parseContent: string,
  jsRules: readonly RuleWith<JsRuleMatcher>[],
  domRules: readonly RuleWith<DomRuleMatcher>[],
  pool: JsProjectPool,
): ScanFinding[] {
  const activeDomRules = domRules.filter((rule) =>
    matchesFastTokens(parseContent, rule.matcher.fastTokens),
  );
  const activeJsRules = jsRules.filter((rule) =>
    matchesFastTokens(parseContent, rule.matcher.fastTokens),
  );
  if (activeDomRules.length === 0 && activeJsRules.length === 0) {
    return [];
  }

  let realSourceFile: SourceFile | undefined;
  let activeProject: Project | undefined;
  const getSourceFile = (): SourceFile => {
    if (!realSourceFile) {
      activeProject = acquireProjectForFile(pool);
      realSourceFile = activeProject.createSourceFile(parsePath, parseContent, {
        overwrite: true,
      });
      memoizeSourceFileQueries(realSourceFile);
    }
    return realSourceFile;
  };

  const lazySourceFile = new Proxy({} as SourceFile, {
    get(_target, prop) {
      const sf = getSourceFile();
      const val = Reflect.get(sf, prop, sf);
      return typeof val === 'function' ? val.bind(sf) : val;
    },
    has(_target, prop) {
      return Reflect.has(getSourceFile(), prop);
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(getSourceFile());
    },
  });

  const matcherCtx: JsMatcherContext = {
    filePath: parsePath,
    fileContent: parseContent,
  };

  const findings: ScanFinding[] = [];
  try {
    if (activeDomRules.length > 0) {
      const sf = getSourceFile();
      findings.push(
        ...materializeRuleMatches(
          ctx,
          scanJsxRules(ctx.relPath, sf, activeDomRules),
          sf,
        ),
      );
    }
    for (const rule of activeJsRules) {
      for (const match of rule.matcher.matchFile(lazySourceFile, matcherCtx)) {
        findings.push(materializeFinding(ctx, rule, match, getSourceFile()));
      }
    }
  } finally {
    if (pool.isExternalProject && realSourceFile && activeProject) {
      activeProject.removeSourceFile(realSourceFile);
    }
  }
  return findings;
}

function scanExtractedStyles(
  ctx: FileContext,
  rules: readonly RuleWith<CssRuleMatcher>[],
): ScanFinding[] {
  if (rules.length === 0) {
    return [];
  }
  const findings: ScanFinding[] = [];
  for (const strippedCss of extractStyleBlocks(ctx.relPath, ctx.content)) {
    if (!isMinifiedContent(strippedCss)) {
      findings.push(
        ...materializeRuleMatches(ctx, scanCssRules(ctx.relPath, strippedCss, rules, ctx.content)),
      );
    }
  }
  return findings;
}

function processMultiBlockFile(
  ctx: FileContext,
  rules: FileRuleBundle,
  pool: JsProjectPool,
): ScanFinding[] {
  const findings: ScanFinding[] = [];

  if (rules.dom.length > 0) {
    const preparedHtml = prepareHtmlForDomScan(ctx.relPath, ctx.content);
    findings.push(
      ...materializeRuleMatches(
        ctx,
        scanHtmlRules(ctx.relPath, preparedHtml, rules.dom, ctx.content),
      ),
    );
  }

  if (rules.js.length > 0) {
    for (const block of extractScriptBlocks(ctx.relPath, ctx.content)) {
      if (!isMinifiedContent(block.strippedContent)) {
        findings.push(
          ...scanJsAst(ctx, block.virtualPath, block.strippedContent, rules.js, [], pool),
        );
      }
    }
  }

  findings.push(...scanExtractedStyles(ctx, rules.css));
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

interface CompiledRuleBundle extends FileRuleBundle {
  readonly dep: readonly RuleWith<DependencyRuleMatcher>[];
}

interface ScanSession {
  readonly repo: string;
  readonly commit: string;
  readonly rules: CompiledRuleBundle;
  readonly activeEngines: ReadonlySet<FormatEngine>;
  readonly filterOpts: FileFilterOptions | undefined;
  readonly pool: JsProjectPool;
}

function createScanSession(rules: readonly ScanRule[], options?: ScanOptions): ScanSession {
  const js = rules.filter((r): r is RuleWith<JsRuleMatcher> => r.matcher.kind === 'js');
  const dom = rules.filter((r): r is RuleWith<DomRuleMatcher> => r.matcher.kind === 'dom');
  const css = rules.filter((r): r is RuleWith<CssRuleMatcher> => r.matcher.kind === 'css');
  const dep = rules.filter(
    (r): r is RuleWith<DependencyRuleMatcher> => r.matcher.kind === 'dependency',
  );

  const activeEngines = new Set<FormatEngine>();
  if (dom.length > 0) activeEngines.add('dom');
  if (js.length > 0) activeEngines.add('js');
  if (css.length > 0) activeEngines.add('css');
  if (dep.length > 0) activeEngines.add('dependency');

  return {
    repo: options?.repo ?? 'unknown',
    commit: options?.commit ?? 'unknown',
    rules: { dom, js, css, dep },
    activeEngines,
    filterOpts: resolveFileFilterOptions(options),
    pool: {
      project: options?.project ?? createInMemoryProject(),
      isExternalProject: Boolean(options?.project),
      parsedCount: 0,
    },
  };
}

function scanLoadedFile(
  session: ScanSession,
  relPath: string,
  content: string,
  kind: 'source' | 'vendored',
  outFindings: ScanFinding[],
): void {
  try {
    const ctx: FileContext = {
      relPath,
      content,
      repo: session.repo,
      commit: session.commit,
    };

    if (kind === 'vendored') {
      if (session.rules.dep.length > 0) {
        outFindings.push(
          ...materializeRuleMatches(
            ctx,
            scanVendoredLibraryRules(relPath, content, session.rules.dep),
          ),
        );
      }
      return;
    }

    const lowerPath = relPath.toLowerCase();

    if (isPackageJsonPath(lowerPath)) {
      if (session.rules.dep.length > 0) {
        outFindings.push(
          ...materializeRuleMatches(ctx, scanPackageJsonRules(relPath, content, session.rules.dep)),
        );
      }
      return;
    }

    const ext = extname(lowerPath);

    if (STYLESHEET_EXTENSIONS.has(ext)) {
      if (session.rules.css.length > 0) {
        // Strip SCSS/Less `//` comments so cssomnom does not attach them to the next selector.
        const cssContent =
          ext === '.scss' || ext === '.less'
            ? stripPreprocessorLineComments(content)
            : content;
        outFindings.push(
          ...materializeRuleMatches(
            ctx,
            scanCssRules(relPath, cssContent, session.rules.css, content),
          ),
        );
      }
      return;
    }

    if (isMarkupPath(lowerPath)) {
      outFindings.push(...processMultiBlockFile(ctx, session.rules, session.pool));
      return;
    }

    if (JS_EXTENSIONS.has(ext)) {
      const activeDom = JSX_EXTENSIONS.has(ext) ? session.rules.dom : [];
      outFindings.push(
        ...scanJsAst(ctx, relPath, content, session.rules.js, activeDom, session.pool),
      );
      outFindings.push(...scanExtractedStyles(ctx, session.rules.css));
    }
  } catch {
    // Per-file exception boundary: an unexpected parser/AST exception on one malformed
    // file must not abort the entire repository scan.
  }
}

/**
 * Scans an in-memory map of files (relPath -> content) against a suite of ScanRules.
 */
export function scanFiles(
  files: ReadonlyMap<string, string>,
  rules: readonly ScanRule[],
  options?: ScanOptions,
): ScanFinding[] {
  const session = createScanSession(rules, options);
  const findings: ScanFinding[] = [];

  for (const [relPath, content] of files) {
    try {
      if (!session.filterOpts?.includeDocsAndTests && isDocsOrTestsPath(relPath)) {
        continue;
      }

      if (!shouldScanFile(relPath, content, session.filterOpts)) {
        if (
          session.rules.dep.length > 0 &&
          !isBuildOrInstallPath(relPath) &&
          !(session.filterOpts?.excludeCorpusNonAppDirs && isCorpusNonAppPath(relPath))
        ) {
          scanLoadedFile(session, relPath, content, 'vendored', findings);
        }
        continue;
      }

      scanLoadedFile(session, relPath, content, 'source', findings);
    } catch {
      // Per-file exception boundary: an unexpected parser/AST exception on one malformed
      // file must not abort the entire repository scan.
    }
  }

  return findings;
}

const execFileAsync = promisify(execFile);

function pathMatchesActiveEngines(
  relPath: string,
  activeEngines: ReadonlySet<FormatEngine>,
): boolean {
  if (isPackageJsonPath(relPath)) {
    return activeEngines.has('dependency');
  }
  const engines = getEnginesForSourceExtension(extname(relPath));
  if (!engines) {
    return false;
  }
  for (const engine of activeEngines) {
    if (engines.has(engine)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns `true` if a file with known content is eligible to be scanned by at least
 * one rule in `rules`. Used to report accurate `scannedFileCount` for single-file CLI targets.
 */
export function canScanFileForRules(
  relPath: string,
  content: string,
  rules: readonly ScanRule[],
  options?: FileFilterOptions,
): boolean {
  if (rules.length === 0) {
    return false;
  }
  const activeEngines = new Set<FormatEngine>(rules.map((r) => r.matcher.kind));
  if (!options?.includeDocsAndTests && isDocsOrTestsPath(relPath)) {
    return false;
  }
  if (shouldScanFile(relPath, content, options)) {
    return pathMatchesActiveEngines(relPath, activeEngines);
  }
  return (
    activeEngines.has('dependency') &&
    isCandidateVendoredFile(relPath, content) &&
    !(options?.excludeCorpusNonAppDirs && isCorpusNonAppPath(relPath))
  );
}

/**
 * Classifies a candidate path synchronously without disk I/O.
 * Returns 'candidate' if the file can match an active rule modality and should be read,
 * or 'skip' otherwise. Accurately increments skippedDocsAndTestsCount for matching test/doc files.
 */
function classifyCandidatePath(
  relPath: string,
  session: ScanSession,
  stats: { skippedDocsAndTestsCount: number },
): 'candidate' | 'skip' {
  if (session.activeEngines.size === 0) {
    return 'skip';
  }

  if (!session.filterOpts?.includeDocsAndTests && isDocsOrTestsPath(relPath)) {
    if (
      shouldScanFile(relPath, undefined, {
        ...session.filterOpts,
        includeDocsAndTests: true,
      }) &&
      pathMatchesActiveEngines(relPath, session.activeEngines)
    ) {
      stats.skippedDocsAndTestsCount++;
    }
    return 'skip';
  }

  if (shouldScanFile(relPath, undefined, session.filterOpts)) {
    return pathMatchesActiveEngines(relPath, session.activeEngines) ? 'candidate' : 'skip';
  }

  if (
    session.activeEngines.has('dependency') &&
    isCandidateVendoredFile(relPath) &&
    !(session.filterOpts?.excludeCorpusNonAppDirs && isCorpusNonAppPath(relPath))
  ) {
    return 'candidate';
  }

  return 'skip';
}

interface ReadCandidateResult {
  readonly kind: 'source' | 'vendored';
  readonly content: string;
}

/**
 * Reads a single candidate file from disk atomically, validating file type, size cap, and content filters.
 */
async function tryReadFileContent(
  fullPath: string,
  relPath: string,
  session: ScanSession,
): Promise<ReadCandidateResult | undefined> {
  try {
    const handle = await open(fullPath, 'r');
    try {
      const fileStat = await handle.stat();
      if (!fileStat.isFile() || fileStat.size > MAX_SOURCE_FILE_BYTES) {
        return undefined;
      }
      const content = await handle.readFile('utf8');
      if (shouldScanFile(relPath, content, session.filterOpts)) {
        return { kind: 'source', content };
      }
      if (
        session.activeEngines.has('dependency') &&
        isCandidateVendoredFile(relPath, content) &&
        !(session.filterOpts?.excludeCorpusNonAppDirs && isCorpusNonAppPath(relPath))
      ) {
        return { kind: 'vendored', content };
      }
      return undefined;
    } finally {
      await handle.close();
    }
  } catch {
    // Missing/deleted file (ENOENT), unreadable, or binary file
    return undefined;
  }
}

const FILE_READ_CONCURRENCY = 64;

/**
 * Stably partitions enumerated paths so `package.json` manifests precede source files
 * while preserving deterministic ordering within each group.
 */
function prioritizePackageJsonPaths(rawPaths: readonly string[]): string[] {
  const packageJsonPaths: string[] = [];
  const otherPaths: string[] = [];
  for (const rawPath of rawPaths) {
    if (!rawPath) continue;
    const normalized = rawPath.replace(/\\/g, '/');
    if (isPackageJsonPath(normalized)) {
      packageJsonPaths.push(normalized);
    } else {
      otherPaths.push(normalized);
    }
  }
  return [...packageJsonPaths, ...otherPaths];
}

/**
 * Streams candidate paths in bounded concurrent read+scan batches (discarding file contents
 * between batches while sharing `session.pool` for ephemeral AST project rotation), then
 * classifies any remaining paths synchronously when `maxFiles` stops reads early.
 */
async function streamScanCandidatePaths(
  repoRoot: string,
  orderedPaths: readonly string[],
  session: ScanSession,
  maxFiles: number,
): Promise<{ readonly findings: ScanFinding[]; readonly stats: Required<RepoScanStats> }> {
  const findings: ScanFinding[] = [];
  const docsStats = { skippedDocsAndTestsCount: 0 };
  let scannedFileCount = 0;
  let idx = 0;

  while (idx < orderedPaths.length && scannedFileCount < maxFiles) {
    const batchLimit = Math.min(FILE_READ_CONCURRENCY, maxFiles - scannedFileCount);
    const batch: string[] = [];
    while (idx < orderedPaths.length && batch.length < batchLimit) {
      const relPath = orderedPaths[idx++];
      if (relPath && classifyCandidatePath(relPath, session, docsStats) === 'candidate') {
        batch.push(relPath);
      }
    }
    if (batch.length === 0) {
      break;
    }

    const reads = await Promise.all(
      batch.map((relPath) =>
        tryReadFileContent(join(repoRoot, relPath), relPath, session),
      ),
    );
    for (let i = 0; i < batch.length; i++) {
      const relPath = batch[i];
      const read = reads[i];
      if (relPath !== undefined && read !== undefined) {
        scannedFileCount++;
        scanLoadedFile(session, relPath, read.content, read.kind, findings);
      }
    }
  }

  let remainingCandidateCount = 0;
  while (idx < orderedPaths.length) {
    const relPath = orderedPaths[idx++];
    if (relPath && classifyCandidatePath(relPath, session, docsStats) === 'candidate') {
      remainingCandidateCount++;
    }
  }

  return {
    findings,
    stats: {
      skippedDocsAndTestsCount: docsStats.skippedDocsAndTestsCount,
      scannedFileCount,
      eligibleFileCount: scannedFileCount + remainingCandidateCount,
      truncatedByMaxFiles: remainingCandidateCount > 0,
    },
  };
}

async function collectDirectoryPaths(
  resolvedRoot: string,
  currentDir: string,
  filterOpts: FileFilterOptions | undefined,
  outPaths: string[],
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((entryA, entryB) => entryA.name.localeCompare(entryB.name));

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    const relPath = relative(resolvedRoot, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      const dirLower = entry.name.toLowerCase();
      if (
        (dirLower !== '.' && dirLower !== '..' && dirLower.startsWith('.')) ||
        BUILD_OR_INSTALL_DIR_SEGMENTS.has(dirLower) ||
        filterOpts?.customIgnoredDirs?.has(dirLower) ||
        (filterOpts?.excludeCorpusNonAppDirs &&
          CORPUS_NON_APP_DIR_SEGMENTS.has(dirLower))
      ) {
        continue;
      }
      await collectDirectoryPaths(resolvedRoot, fullPath, filterOpts, outPaths);
      continue;
    }

    if (entry.isFile()) {
      outPaths.push(relPath);
    }
  }
}

async function walkDirectoryPaths(
  resolvedRepoDir: string,
  filterOpts: FileFilterOptions | undefined,
): Promise<string[]> {
  const relPaths: string[] = [];
  await collectDirectoryPaths(resolvedRepoDir, resolvedRepoDir, filterOpts, relPaths);
  return relPaths;
}

async function tryEnumerateGitFiles(resolvedRepoDir: string): Promise<string[] | null> {
  let stdout: string;
  try {
    const res = await execFileAsync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      {
        cwd: resolvedRepoDir,
        maxBuffer: 50 * 1024 * 1024,
        timeout: 10_000,
      },
    );
    stdout = res.stdout;
  } catch {
    return null;
  }

  const rawPaths = stdout.split('\0').filter(Boolean);
  return rawPaths.length > 0 ? rawPaths : null;
}

/**
 * Traverses a repository directory on disk and scans all eligible files against ScanRules.
 */
export async function scanRepoFiles(
  repoDirPath: string,
  rules: readonly ScanRule[],
  options?: RepoScanOptions,
): Promise<ScanFinding[]> {
  const maxFiles = resolveMaxFiles(options?.maxFiles);
  const session = createScanSession(rules, options);

  if (session.activeEngines.size === 0) {
    if (options?.stats) {
      options.stats.skippedDocsAndTestsCount = 0;
      options.stats.scannedFileCount = 0;
      options.stats.eligibleFileCount = 0;
      options.stats.truncatedByMaxFiles = false;
    }
    return [];
  }

  const resolvedRepoDir = resolve(repoDirPath);
  const rawPaths =
    (await tryEnumerateGitFiles(resolvedRepoDir)) ??
    (await walkDirectoryPaths(resolvedRepoDir, session.filterOpts));

  const orderedPaths = prioritizePackageJsonPaths(rawPaths);
  const { findings, stats } = await streamScanCandidatePaths(
    resolvedRepoDir,
    orderedPaths,
    session,
    maxFiles,
  );

  if (options?.stats) {
    options.stats.skippedDocsAndTestsCount = stats.skippedDocsAndTestsCount;
    options.stats.scannedFileCount = stats.scannedFileCount;
    options.stats.eligibleFileCount = stats.eligibleFileCount;
    options.stats.truncatedByMaxFiles = stats.truncatedByMaxFiles;
  }

  return findings;
}
