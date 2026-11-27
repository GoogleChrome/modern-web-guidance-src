import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import type { Node, Project, SourceFile, SyntaxKind } from 'ts-morph';
import type {
  CssRuleMatcher,
  DependencyRuleMatcher,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
  RuleMatcher,
  ScanFinding,
  ScanMatch,
  ScanRule,
} from '../schema.ts';
import { sliceStructuredContext } from './context-slicer.ts';
import { scanCssRules } from './css-scanner.ts';
import {
  scanPackageJsonRules,
  scanVendoredLibraryRules,
} from './dependency-scanner.ts';
import { scanHtmlRules, scanJsxRules } from './dom-scanner.ts';
import {
  isCandidateVendoredFile,
  isDocsOrTestsPath,
  isEligibleSourceFile,
  isMinifiedContent,
  isPackageJsonPath,
  isVendoredOrGeneratedPath,
  type FileFilterOptions,
} from './file-filter.ts';
import {
  getEnginesForPath,
  getUnsupportedFormatExtension,
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

export interface RepoScanStats {
  skippedDocsAndTestsCount?: number;
  skippedUnsupportedFiles?: Readonly<Record<string, number>>;
  scannedFileCount?: number;
  eligibleFileCount?: number;
  truncatedByMaxFiles?: boolean;
  parseErrorCount?: number;
}

export interface ScanOptions extends FileFilterOptions {
  readonly repo?: string;
  readonly commit?: string;
  readonly fileFilterOptions?: FileFilterOptions;
  readonly project?: Project;
  readonly stats?: RepoScanStats;
}

type RuleWith<M extends RuleMatcher> = ScanRule & { readonly matcher: M };

interface FileRuleBundle {
  readonly dom: readonly RuleWith<DomRuleMatcher>[];
  readonly js: readonly RuleWith<JsRuleMatcher>[];
  readonly css: readonly RuleWith<CssRuleMatcher>[];
}

interface CompiledRuleBundle extends FileRuleBundle {
  readonly dep: readonly RuleWith<DependencyRuleMatcher>[];
}

interface FileContext {
  readonly relPath: string;
  readonly content: string;
  readonly repo: string;
  readonly commit: string;
}

interface JsProjectPool {
  project: Project | undefined;
  readonly isExternalProject: boolean;
  parsedCount: number;
}

export interface ScanSession {
  readonly repo: string;
  readonly commit: string;
  readonly rules: CompiledRuleBundle;
  readonly activeEngines: ReadonlySet<FormatEngine>;
  readonly filterOpts: FileFilterOptions | undefined;
  readonly pool: JsProjectPool;
}

export type FileDisposition = 'source' | 'vendored' | 'skip';

export interface ScanStatsAccumulator {
  recordSkippedDocsAndTests(): void;
  recordUnsupported(ext: string): void;
  recordScannedFile(hadParseError: boolean): void;
  finalize(stats: RepoScanStats | undefined, remainingCandidateCount?: number): void;
}

export function createStatsAccumulator(): ScanStatsAccumulator {
  let skippedDocsAndTestsCount = 0;
  let scannedFileCount = 0;
  let parseErrorCount = 0;
  const unsupportedCounts = new Map<string, number>();

  return {
    recordSkippedDocsAndTests() {
      skippedDocsAndTestsCount++;
    },
    recordUnsupported(ext: string) {
      unsupportedCounts.set(ext, (unsupportedCounts.get(ext) ?? 0) + 1);
    },
    recordScannedFile(hadParseError: boolean) {
      scannedFileCount++;
      if (hadParseError) {
        parseErrorCount++;
      }
    },
    finalize(stats: RepoScanStats | undefined, remainingCandidateCount = 0) {
      if (!stats) return;
      let skippedUnsupportedFiles: Record<string, number> | undefined;
      if (unsupportedCounts.size > 0) {
        skippedUnsupportedFiles = {};
        for (const [ext, count] of [...unsupportedCounts.entries()].sort(([a], [b]) =>
          a.localeCompare(b),
        )) {
          skippedUnsupportedFiles[ext] = count;
        }
      }
      stats.skippedDocsAndTestsCount = skippedDocsAndTestsCount;
      stats.skippedUnsupportedFiles = skippedUnsupportedFiles;
      stats.scannedFileCount = scannedFileCount;
      stats.eligibleFileCount = scannedFileCount + remainingCandidateCount;
      stats.truncatedByMaxFiles = remainingCandidateCount > 0;
      stats.parseErrorCount = parseErrorCount;
    },
  };
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

const EPHEMERAL_PROJECT_ROTATION_INTERVAL = 25;

function acquireProjectForFile(pool: JsProjectPool): Project {
  if (
    !pool.project ||
    (!pool.isExternalProject && pool.parsedCount >= EPHEMERAL_PROJECT_ROTATION_INTERVAL)
  ) {
    pool.project = createInMemoryProject();
    pool.parsedCount = 0;
  }
  pool.parsedCount++;
  return pool.project;
}

function runIsolated(
  findings: ScanFinding[],
  fn: () => readonly ScanFinding[],
): boolean {
  try {
    findings.push(...fn());
    return false;
  } catch {
    return true;
  }
}

function scanExtractedBlocks<TBlock>(
  findings: ScanFinding[],
  extract: () => readonly TBlock[],
  scanBlock: (block: TBlock) => boolean,
): boolean {
  let blocks: readonly TBlock[];
  try {
    blocks = extract();
  } catch {
    return true;
  }
  let hadError = false;
  for (const block of blocks) {
    if (scanBlock(block)) {
      hadError = true;
    }
  }
  return hadError;
}

function scanJsAst(
  ctx: FileContext,
  parsePath: string,
  parseContent: string,
  jsRules: readonly RuleWith<JsRuleMatcher>[],
  domRules: readonly RuleWith<DomRuleMatcher>[],
  pool: JsProjectPool,
  findings: ScanFinding[],
): boolean {
  const activeDomRules = domRules.filter((rule) =>
    matchesFastTokens(parseContent, rule.matcher.fastTokens),
  );
  const activeJsRules = jsRules.filter((rule) =>
    matchesFastTokens(parseContent, rule.matcher.fastTokens),
  );
  if (activeDomRules.length === 0 && activeJsRules.length === 0) {
    return false;
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

  let hadError = false;
  try {
    if (activeDomRules.length > 0) {
      hadError = runIsolated(findings, () => {
        const sf = getSourceFile();
        return materializeRuleMatches(ctx, scanJsxRules(ctx.relPath, sf, activeDomRules), sf);
      });
    }
    if (activeJsRules.length > 0) {
      const jsErr = runIsolated(findings, () => {
        const matches: ScanFinding[] = [];
        for (const rule of activeJsRules) {
          for (const match of rule.matcher.matchFile(lazySourceFile, matcherCtx)) {
            matches.push(materializeFinding(ctx, rule, match, getSourceFile()));
          }
        }
        return matches;
      });
      hadError = hadError || jsErr;
    }
  } finally {
    if (pool.isExternalProject && realSourceFile && activeProject) {
      activeProject.removeSourceFile(realSourceFile);
    }
  }
  return hadError;
}

function scanExtractedStyles(
  ctx: FileContext,
  rules: readonly RuleWith<CssRuleMatcher>[],
  findings: ScanFinding[],
): boolean {
  if (rules.length === 0) {
    return false;
  }
  return scanExtractedBlocks(
    findings,
    () => extractStyleBlocks(ctx.relPath, ctx.content),
    (strippedCss) =>
      isMinifiedContent(strippedCss)
        ? false
        : runIsolated(findings, () =>
            materializeRuleMatches(ctx, scanCssRules(ctx.relPath, strippedCss, rules, ctx.content)),
          ),
  );
}

function scanMultiBlockFile(
  ctx: FileContext,
  rules: FileRuleBundle,
  pool: JsProjectPool,
  findings: ScanFinding[],
): boolean {
  let hadError = false;

  if (rules.dom.length > 0) {
    hadError = runIsolated(findings, () => {
      const preparedHtml = prepareHtmlForDomScan(ctx.relPath, ctx.content);
      return materializeRuleMatches(
        ctx,
        scanHtmlRules(ctx.relPath, preparedHtml, rules.dom, ctx.content),
      );
    });
  }

  if (rules.js.length > 0) {
    const jsErr = scanExtractedBlocks(
      findings,
      () => extractScriptBlocks(ctx.relPath, ctx.content),
      (block) =>
        isMinifiedContent(block.strippedContent)
          ? false
          : scanJsAst(ctx, block.virtualPath, block.strippedContent, rules.js, [], pool, findings),
    );
    hadError = hadError || jsErr;
  }

  const styleErr = scanExtractedStyles(ctx, rules.css, findings);
  return hadError || styleErr;
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

export function createScanSession(rules: readonly ScanRule[], options?: ScanOptions): ScanSession {
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
      project: options?.project,
      isExternalProject: Boolean(options?.project),
      parsedCount: 0,
    },
  };
}

function pathMatchesActiveEngines(
  relPath: string,
  activeEngines: ReadonlySet<FormatEngine>,
): boolean {
  const engines = getEnginesForPath(relPath);
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
 * Classifies a file (with optional content) against active rule modalities and path/content filters,
 * tallying skipped docs/tests and unsupported format extensions into `acc` in a single pass.
 */
export function classifyAndTallyFile(
  relPath: string,
  content: string | undefined,
  session: ScanSession,
  acc?: ScanStatsAccumulator,
): FileDisposition {
  if (session.activeEngines.size === 0) {
    return 'skip';
  }

  const isSkippedDocsOrTests =
    !session.filterOpts?.includeDocsAndTests && isDocsOrTestsPath(relPath);

  if (isVendoredOrGeneratedPath(relPath, session.filterOpts)) {
    if (
      !isSkippedDocsOrTests &&
      session.activeEngines.has('dependency') &&
      isCandidateVendoredFile(relPath, content, session.filterOpts)
    ) {
      return 'vendored';
    }
    return 'skip';
  }

  if (isEligibleSourceFile(relPath, content, session.filterOpts)) {
    if (!pathMatchesActiveEngines(relPath, session.activeEngines)) {
      return 'skip';
    }
    if (isSkippedDocsOrTests) {
      acc?.recordSkippedDocsAndTests();
      return 'skip';
    }
    return 'source';
  }

  if (
    !isSkippedDocsOrTests &&
    session.activeEngines.has('dependency') &&
    isCandidateVendoredFile(relPath, content, session.filterOpts)
  ) {
    return 'vendored';
  }

  if (!isSkippedDocsOrTests) {
    const unsupportedExt = getUnsupportedFormatExtension(relPath);
    if (unsupportedExt) {
      acc?.recordUnsupported(unsupportedExt);
    }
  }

  return 'skip';
}

export function scanLoadedFile(
  session: ScanSession,
  relPath: string,
  content: string,
  kind: 'source' | 'vendored',
  findings: ScanFinding[],
): boolean {
  const ctx: FileContext = {
    relPath,
    content,
    repo: session.repo,
    commit: session.commit,
  };

  if (kind === 'vendored') {
    return runIsolated(findings, () =>
      session.rules.dep.length > 0
        ? materializeRuleMatches(ctx, scanVendoredLibraryRules(relPath, content, session.rules.dep))
        : [],
    );
  }

  const lowerPath = relPath.replace(/\\/g, '/').toLowerCase();

  if (isPackageJsonPath(lowerPath)) {
    return runIsolated(findings, () =>
      session.rules.dep.length > 0
        ? materializeRuleMatches(ctx, scanPackageJsonRules(relPath, content, session.rules.dep))
        : [],
    );
  }

  const ext = posix.extname(lowerPath);

  if (STYLESHEET_EXTENSIONS.has(ext)) {
    if (session.rules.css.length === 0) {
      return false;
    }
    // Strip SCSS/Less `//` comments so cssomnom does not attach them to the next selector.
    const cssContent =
      ext === '.scss' || ext === '.less'
        ? stripPreprocessorLineComments(content)
        : content;
    return runIsolated(findings, () =>
      materializeRuleMatches(ctx, scanCssRules(relPath, cssContent, session.rules.css, content)),
    );
  }

  if (isMarkupPath(lowerPath)) {
    return scanMultiBlockFile(ctx, session.rules, session.pool, findings);
  }

  if (JS_EXTENSIONS.has(ext)) {
    const activeDom = JSX_EXTENSIONS.has(ext) ? session.rules.dom : [];
    const jsErr = scanJsAst(
      ctx,
      relPath,
      content,
      session.rules.js,
      activeDom,
      session.pool,
      findings,
    );
    const styleErr = scanExtractedStyles(ctx, session.rules.css, findings);
    return jsErr || styleErr;
  }

  return false;
}
