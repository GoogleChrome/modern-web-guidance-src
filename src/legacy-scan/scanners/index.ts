import { createHash } from 'node:crypto';
import { posix } from 'node:path';
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
import { scanCssRulesStrict } from './css-scanner.ts';
import {
  scanPackageJsonRulesStrict,
  scanVendoredLibraryRules,
} from './dependency-scanner.ts';
import { scanHtmlRules, scanJsxRules } from './dom-scanner.ts';
import {
  isCandidateVendoredFile,
  isDocsOrTestsPath,
  isMinifiedContent,
  isPackageJsonPath,
  isVendoredOrGeneratedPath,
  shouldScanFile,
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
import type { RepoScanStats } from './repo-scanner.ts';
import {
  extractScriptBlocks,
  extractStyleBlocks,
  isMarkupPath,
  prepareHtmlForDomScan,
  stripPreprocessorLineComments,
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
export {
  DEFAULT_MAX_FILES,
  resolveMaxFiles,
  scanRepoFiles,
  type RepoScanOptions,
  type RepoScanStats,
} from './repo-scanner.ts';

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
  readonly stats?: RepoScanStats;
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
  project: Project | undefined;
  readonly isExternalProject: boolean;
  parsedCount: number;
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

export interface FileScanResult {
  readonly findings: readonly ScanFinding[];
  readonly hadParseError: boolean;
}

function scanExtractedStyles(
  ctx: FileContext,
  rules: readonly RuleWith<CssRuleMatcher>[],
): FileScanResult {
  if (rules.length === 0) {
    return { findings: [], hadParseError: false };
  }
  const findings: ScanFinding[] = [];
  let hadParseError = false;
  let styleBlocks: readonly string[];
  try {
    styleBlocks = extractStyleBlocks(ctx.relPath, ctx.content);
  } catch {
    return { findings: [], hadParseError: true };
  }
  for (const strippedCss of styleBlocks) {
    if (isMinifiedContent(strippedCss)) {
      continue;
    }
    try {
      findings.push(
        ...materializeRuleMatches(
          ctx,
          scanCssRulesStrict(ctx.relPath, strippedCss, rules, ctx.content),
        ),
      );
    } catch {
      hadParseError = true;
    }
  }
  return { findings, hadParseError };
}

function processMultiBlockFile(
  ctx: FileContext,
  rules: FileRuleBundle,
  pool: JsProjectPool,
): FileScanResult {
  const findings: ScanFinding[] = [];
  let hadParseError = false;

  if (rules.dom.length > 0) {
    try {
      const preparedHtml = prepareHtmlForDomScan(ctx.relPath, ctx.content);
      findings.push(
        ...materializeRuleMatches(
          ctx,
          scanHtmlRules(ctx.relPath, preparedHtml, rules.dom, ctx.content),
        ),
      );
    } catch {
      hadParseError = true;
    }
  }

  if (rules.js.length > 0) {
    let scriptBlocks: readonly ScriptBlock[] = [];
    try {
      scriptBlocks = extractScriptBlocks(ctx.relPath, ctx.content);
    } catch {
      hadParseError = true;
    }
    for (const block of scriptBlocks) {
      if (isMinifiedContent(block.strippedContent)) {
        continue;
      }
      try {
        findings.push(
          ...scanJsAst(ctx, block.virtualPath, block.strippedContent, rules.js, [], pool),
        );
      } catch {
        hadParseError = true;
      }
    }
  }

  const styleResult = scanExtractedStyles(ctx, rules.css);
  findings.push(...styleResult.findings);
  hadParseError ||= styleResult.hadParseError;

  return { findings, hadParseError };
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

export interface ScanSession {
  readonly repo: string;
  readonly commit: string;
  readonly rules: CompiledRuleBundle;
  readonly activeEngines: ReadonlySet<FormatEngine>;
  readonly filterOpts: FileFilterOptions | undefined;
  readonly docsFilterOpts: FileFilterOptions;
  readonly pool: JsProjectPool;
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

  const filterOpts = resolveFileFilterOptions(options);
  const docsFilterOpts: FileFilterOptions = filterOpts
    ? { ...filterOpts, includeDocsAndTests: true }
    : { includeDocsAndTests: true };

  return {
    repo: options?.repo ?? 'unknown',
    commit: options?.commit ?? 'unknown',
    rules: { dom, js, css, dep },
    activeEngines,
    filterOpts,
    docsFilterOpts,
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

export type FileDisposition =
  | 'source'
  | 'vendored'
  | 'skipped-docs-tests'
  | 'skipped-unsupported'
  | 'skip';

/**
 * Classifies a file (with optional content) against active rule modalities and path/content filters.
 */
export function classifyFile(
  relPath: string,
  content: string | undefined,
  session: ScanSession,
): FileDisposition {
  if (session.activeEngines.size === 0) {
    return 'skip';
  }

  if (!session.filterOpts?.includeDocsAndTests && isDocsOrTestsPath(relPath)) {
    if (
      shouldScanFile(relPath, content, session.docsFilterOpts) &&
      pathMatchesActiveEngines(relPath, session.activeEngines)
    ) {
      return 'skipped-docs-tests';
    }
    return 'skip';
  }

  // Dependency-only scans match package.json and path-recognizable vendored files
  // (isCandidateVendoredFile) rather than reading arbitrary first-party .js/.css files.
  if (shouldScanFile(relPath, content, session.filterOpts)) {
    return pathMatchesActiveEngines(relPath, session.activeEngines) ? 'source' : 'skip';
  }

  if (
    session.activeEngines.has('dependency') &&
    isCandidateVendoredFile(relPath, content, session.filterOpts)
  ) {
    return 'vendored';
  }

  if (
    !isVendoredOrGeneratedPath(relPath, session.filterOpts) &&
    getUnsupportedFormatExtension(relPath) !== undefined
  ) {
    return 'skipped-unsupported';
  }

  return 'skip';
}

export function recordUnsupportedFile(counts: Map<string, number>, relPath: string): void {
  const ext = getUnsupportedFormatExtension(relPath);
  if (ext) {
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
}

export function buildSortedExtensionCounts(
  counts: ReadonlyMap<string, number>,
): Readonly<Record<string, number>> | undefined {
  if (counts.size === 0) {
    return undefined;
  }
  const sorted: Record<string, number> = {};
  for (const [ext, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    sorted[ext] = count;
  }
  return sorted;
}

export function scanLoadedFile(
  session: ScanSession,
  relPath: string,
  content: string,
  kind: 'source' | 'vendored',
): FileScanResult {
  try {
    const ctx: FileContext = {
      relPath,
      content,
      repo: session.repo,
      commit: session.commit,
    };

    if (kind === 'vendored') {
      return {
        findings:
          session.rules.dep.length > 0
            ? materializeRuleMatches(
                ctx,
                scanVendoredLibraryRules(relPath, content, session.rules.dep),
              )
            : [],
        hadParseError: false,
      };
    }

    const lowerPath = relPath.replace(/\\/g, '/').toLowerCase();

    if (isPackageJsonPath(lowerPath)) {
      return {
        findings:
          session.rules.dep.length > 0
            ? materializeRuleMatches(
                ctx,
                scanPackageJsonRulesStrict(relPath, content, session.rules.dep),
              )
            : [],
        hadParseError: false,
      };
    }

    const ext = posix.extname(lowerPath);

    if (STYLESHEET_EXTENSIONS.has(ext)) {
      if (session.rules.css.length === 0) {
        return { findings: [], hadParseError: false };
      }
      // Strip SCSS/Less `//` comments so cssomnom does not attach them to the next selector.
      const cssContent =
        ext === '.scss' || ext === '.less'
          ? stripPreprocessorLineComments(content)
          : content;
      return {
        findings: materializeRuleMatches(
          ctx,
          scanCssRulesStrict(relPath, cssContent, session.rules.css, content),
        ),
        hadParseError: false,
      };
    }

    if (isMarkupPath(lowerPath)) {
      return processMultiBlockFile(ctx, session.rules, session.pool);
    }

    if (JS_EXTENSIONS.has(ext)) {
      const activeDom = JSX_EXTENSIONS.has(ext) ? session.rules.dom : [];
      const findings: ScanFinding[] = [];
      let hadParseError = false;
      try {
        findings.push(
          ...scanJsAst(ctx, relPath, content, session.rules.js, activeDom, session.pool),
        );
      } catch {
        hadParseError = true;
      }
      const styleResult = scanExtractedStyles(ctx, session.rules.css);
      findings.push(...styleResult.findings);
      hadParseError ||= styleResult.hadParseError;
      return { findings, hadParseError };
    }

    return { findings: [], hadParseError: false };
  } catch {
    // Per-file exception boundary: an unexpected parser/AST exception on one malformed
    // file must not abort the entire repository scan.
    return { findings: [], hadParseError: true };
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
  let skippedDocsAndTestsCount = 0;
  let scannedFileCount = 0;
  let parseErrorCount = 0;
  const unsupportedCounts = new Map<string, number>();

  for (const [relPath, content] of files) {
    const disposition = classifyFile(relPath, content, session);
    if (disposition === 'skipped-docs-tests') {
      skippedDocsAndTestsCount++;
      continue;
    }
    if (disposition === 'skipped-unsupported') {
      recordUnsupportedFile(unsupportedCounts, relPath);
      continue;
    }
    if (disposition === 'skip') {
      continue;
    }
    scannedFileCount++;
    const result = scanLoadedFile(session, relPath, content, disposition);
    findings.push(...result.findings);
    if (result.hadParseError) {
      parseErrorCount++;
    }
  }

  if (options?.stats) {
    options.stats.skippedDocsAndTestsCount = skippedDocsAndTestsCount;
    options.stats.skippedUnsupportedFiles = buildSortedExtensionCounts(unsupportedCounts);
    options.stats.scannedFileCount = scannedFileCount;
    options.stats.eligibleFileCount = scannedFileCount;
    options.stats.truncatedByMaxFiles = false;
    options.stats.parseErrorCount = parseErrorCount;
  }

  return findings;
}
