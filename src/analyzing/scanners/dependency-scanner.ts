import { posix } from 'node:path';
import type {
  AnalyzerMatch,
  DependencyMatcherContext,
  DependencyRuleMatcher,
} from '../schema.ts';
import { isCandidateVendoredFile } from './file-filter.ts';

const EXTENSIONS_TO_STRIP: readonly string[] = [
  '.min.js',
  '.bundle.js',
  '.pack.js',
  '-opt.js',
  '.opt.js',
  '.min.css',
  '.bundle.css',
  '.js',
  '.mjs',
  '.cjs',
  '.css',
];

const VERSION_SUFFIX_REGEX = /[-._]v?\d+(?:\.\d+)*(?:[-._][a-z0-9.]+)?$/i;

function stripKnownExtension(filename: string): string {
  const lower = filename.toLowerCase();
  for (const extension of EXTENSIONS_TO_STRIP) {
    if (lower.endsWith(extension)) {
      return filename.slice(0, filename.length - extension.length);
    }
  }
  return filename;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface NormalizedPackage {
  readonly raw: string;
  readonly unscoped: string;
  readonly base: string;
  readonly core: string;
}

function normalizePackageName(pkgName: string): NormalizedPackage {
  const raw = pkgName.toLowerCase();
  const unscoped = raw.replace(/^@[^/]+\//, '');
  const base = unscoped.replace(/[.-]js$/, '');
  const core = base.replace(/^(?:jquery|vanilla)[.-]/, '');
  return { raw, unscoped, base, core };
}

function buildFilenameCandidates(baseName: string): ReadonlySet<string> {
  const stemNoVersion = stripKnownExtension(baseName).replace(VERSION_SUFFIX_REGEX, '');
  const rawLower = stemNoVersion.toLowerCase();
  const kebabStem = stemNoVersion.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const withoutJquerySuffix = rawLower.replace(/[.-]jquery$/, '');
  const withoutJqueryAffixes = withoutJquerySuffix.replace(/^jquery[.-]/, '');

  return new Set([
    rawLower,
    kebabStem,
    withoutJquerySuffix,
    withoutJqueryAffixes,
    rawLower.replace(/\./g, '-'),
  ]);
}

const STRICT_SINGLE_WORD_PACKAGES: ReadonlySet<string> = new Set([
  'chosen',
  'aos',
  'countries',
  'country',
]);

function extractLeadingComment(content: string): string | null {
  const match = content.match(/^\s*(?:\/\*[\s\S]*?(?:\*\/|$)|(?:\/\/[^\n]*\n)+)/);
  return match ? match[0] : null;
}

function stripAuthorAndCopyrightLines(commentText: string): string {
  return commentText
    .split('\n')
    .filter((line) => {
      const lower = line.toLowerCase();
      return !(
        lower.includes('copyright') ||
        lower.includes('@author') ||
        /\bauthors?\b\s*[:-]/i.test(line) ||
        /\(c\)\s*\d{4}/i.test(line)
      );
    })
    .join('\n');
}

function extractCleanedBanner(content: string): string | null {
  const bannerSlice = content.slice(0, 1500);
  if (bannerSlice.length === 0) {
    return null;
  }

  const commentBlock = extractLeadingComment(bannerSlice);
  if (!commentBlock) {
    return null;
  }

  const lowerComment = commentBlock.toLowerCase();
  const hasBannerMarker =
    lowerComment.includes('/*!') ||
    lowerComment.includes('@license') ||
    lowerComment.includes('@preserve') ||
    lowerComment.includes('@author') ||
    lowerComment.includes('@version') ||
    lowerComment.includes('copyright') ||
    lowerComment.includes('license');

  if (!hasBannerMarker) {
    return null;
  }

  return stripAuthorAndCopyrightLines(commentBlock);
}

function bannerIdentifiesPackage(cleanedComment: string, pkgNorm: NormalizedPackage): boolean {
  // If the raw package name ends with '.js' (e.g. 'mark.js', 'sal.js'),
  // strictly require the '.js' suffix in banner matching (or 'markjs' / 'jquery.mark') - never bare '\bmark\b' or '\bsal\b'!
  if (pkgNorm.raw.endsWith('.js')) {
    const baseEsc = escapeRegExp(pkgNorm.base);
    const jsPattern = new RegExp(
      `\\b(?:(?:jquery|vanilla)[.-])?${baseEsc}(?:\\.[a-z0-9]+)?\\.js\\b|\\b${baseEsc}js\\b|\\bjquery\\.${baseEsc}\\b`,
      'i',
    );
    return jsPattern.test(cleanedComment);
  }

  // Check if core name is a single-word English name that requires strict qualification
  // (e.g. 'chosen-js' -> 'chosen', 'aos' -> 'aos', 'countries' -> 'countries')
  const isStrictSingleWord =
    STRICT_SINGLE_WORD_PACKAGES.has(pkgNorm.core) ||
    STRICT_SINGLE_WORD_PACKAGES.has(pkgNorm.base) ||
    STRICT_SINGLE_WORD_PACKAGES.has(pkgNorm.raw);

  if (isStrictSingleWord) {
    if (pkgNorm.raw.includes('-') || pkgNorm.raw.includes('.')) {
      const fullPkgPattern = new RegExp(`\\b${escapeRegExp(pkgNorm.raw)}\\b`, 'i');
      if (fullPkgPattern.test(cleanedComment)) {
        return true;
      }
    }

    const coreEsc = escapeRegExp(pkgNorm.core);
    const strictPattern = new RegExp(
      `\\b(?:(?:jquery|vanilla)[.-])?${coreEsc}(?:\\.[a-z0-9]+)?\\.js\\b|` +
        `\\b${coreEsc}\\.jquery\\b|` +
        `\\b${coreEsc}[-_]js\\b|` +
        `\\b${coreEsc}\\s+v?\\d+(?:\\.\\d+)*\\b|` +
        `\\b${coreEsc}\\s*\\(\\s*v?\\d+|` +
        `\\b${coreEsc}\\s*[,:—–\\-]\\s+`,
      'i',
    );
    return strictPattern.test(cleanedComment);
  }

  const wordsToMatch = new Set<string>([
    pkgNorm.raw,
    pkgNorm.unscoped,
    pkgNorm.base,
    pkgNorm.core,
    ...(pkgNorm.base.includes('-') ? [pkgNorm.base.replace(/-/g, '')] : []),
  ]);

  for (const word of wordsToMatch) {
    const pattern =
      word.length < 3
        ? new RegExp(`\\b${escapeRegExp(word)}\\.js\\b`, 'i')
        : new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
    if (pattern.test(cleanedComment)) {
      return true;
    }
  }

  return false;
}

function matchesVendoredPackage(
  lowerBase: string,
  candidates: ReadonlySet<string>,
  getCleanedBanner: () => string | null,
  pkgName: string,
): boolean {
  const pkgNorm = normalizePackageName(pkgName);

  if (
    candidates.has(pkgNorm.raw) ||
    candidates.has(pkgNorm.unscoped) ||
    candidates.has(pkgNorm.base) ||
    candidates.has(pkgNorm.core)
  ) {
    return true;
  }

  if (
    pkgNorm.core === 'moment' &&
    (lowerBase.startsWith('moment-with-') ||
      lowerBase.startsWith('moment.') ||
      lowerBase.startsWith('moment-timezone'))
  ) {
    return true;
  }

  if (pkgNorm.raw === 'dompurify' && candidates.has('purify')) {
    return true;
  }

  const cleanedBanner = getCleanedBanner();
  return cleanedBanner !== null && bannerIdentifiesPackage(cleanedBanner, pkgNorm);
}

/**
 * Scans a vendored or minified library file against rules with DependencyRuleMatchers in a single pass.
 */
export function scanVendoredLibraryRules<T extends { readonly matcher: DependencyRuleMatcher }>(
  relPath: string,
  content: string,
  rules: readonly T[],
): { rule: T; match: AnalyzerMatch }[] {
  if (rules.length === 0 || !isCandidateVendoredFile(relPath, content)) {
    return [];
  }

  const baseName = posix.basename(relPath.replace(/\\/g, '/'));
  const lowerBase = baseName.toLowerCase();
  const candidates = buildFilenameCandidates(baseName);
  let cleanedBanner: string | null | undefined;
  const getCleanedBanner = (): string | null => {
    if (cleanedBanner === undefined) {
      cleanedBanner = extractCleanedBanner(content);
    }
    return cleanedBanner;
  };

  const dummyCtx: DependencyMatcherContext = {
    filePath: relPath,
    packageJson: {},
  };
  const results: { rule: T; match: AnalyzerMatch }[] = [];

  for (const rule of rules) {
    const { matcher } = rule;
    const matchedPackageName = matcher.packages.find((pkg) =>
      matchesVendoredPackage(lowerBase, candidates, getCleanedBanner, pkg),
    );
    if (!matchedPackageName) {
      continue;
    }

    const pkgResult = matcher.matchPackage?.(matchedPackageName, '*', dummyCtx);
    const message = pkgResult
      ? `Vendored legacy library "${baseName}" (${matchedPackageName}): ${pkgResult.message}`
      : `Vendored legacy library "${baseName}" (${matchedPackageName}) targeted for modernization.`;

    results.push({
      rule,
      match: {
        line: 1,
        message,
        isVendoredLibrary: true,
      },
    });
  }

  return results;
}

/**
 * Scans a vendored or minified library file against dependency matchers (Slice C).
 * Emits at most 1 AnalyzerMatch at line 1 per matching rule when the file's name
 * or opening license header identifies one of the target packages.
 */
export function scanVendoredLibraryFile(
  relPath: string,
  content: string,
  matchers: readonly DependencyRuleMatcher[],
): AnalyzerMatch[] {
  return scanVendoredLibraryRules(
    relPath,
    content,
    matchers.map((matcher) => ({ matcher })),
  ).map(({ match }) => match);
}

const RUNTIME_DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies'] as const;

/**
 * Constructs a `DependencyRuleMatcher` for `packages` using a message formatter
 * that returns a message string (or `null` when a package entry should be skipped).
 */
export function createDependencyMatcher(
  packages: readonly string[],
  formatMessage: (
    pkgName: string,
    versionRange: string,
    ctx: DependencyMatcherContext,
  ) => string | null,
): DependencyRuleMatcher {
  return {
    kind: 'dependency',
    packages,
    matchPackage(pkgName, versionRange, ctx) {
      const message = formatMessage(pkgName, versionRange, ctx);
      return message !== null ? { message } : null;
    },
  };
}

const FRONTEND_FRAMEWORK_PACKAGES: ReadonlySet<string> = new Set([
  'react',
  'react-dom',
  'vue',
  'svelte',
  '@sveltejs/kit',
  'next',
  'nuxt',
  'astro',
  '@angular/core',
  'lit',
  'preact',
  'solid-js',
  '@remix-run/react',
  '@builder.io/qwik',
  'qwik',
  'alpinejs',
]);

const BACKEND_SERVER_PACKAGES: ReadonlySet<string> = new Set([
  'express',
  'fastify',
  'koa',
  '@nestjs/core',
  '@hapi/hapi',
  'hapi',
  'restify',
]);

function isRecord(val: unknown): val is Readonly<Record<string, unknown>> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function getDependencyObject(
  pkgRecord: Readonly<Record<string, unknown>>,
  field: string,
): Readonly<Record<string, unknown>> | null {
  const section = pkgRecord[field];
  return isRecord(section) ? section : null;
}

function hasAnyPackage(
  deps: Readonly<Record<string, unknown>> | null,
  targetPackages: ReadonlySet<string>,
): boolean {
  return deps !== null && Object.keys(deps).some((pkgName) => targetPackages.has(pkgName));
}

function hasNonEmptyField(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return isRecord(value) && Object.keys(value).length > 0;
}

/**
 * Returns true if the parsed package.json represents a pure Node.js backend server
 * or CLI tool where browser modernization rules do not apply:
 * 1. `parsed.bin` is present without a `"browser"` field or frontend framework in
 *    `dependencies`/`devDependencies`/`peerDependencies`, OR
 * 2. `dependencies` contains a backend server framework (`express`, `fastify`, `koa`,
 *    `@nestjs/core`, `@hapi/hapi`, `hapi`, `restify`) without any frontend/DOM framework
 *    in `dependencies`/`devDependencies`/`peerDependencies`.
 */
export function isPureNodeBackendOrCliPackage(
  pkgRecord: Readonly<Record<string, unknown>>,
): boolean {
  if (hasNonEmptyField(pkgRecord.browser)) {
    return false;
  }

  const depFields = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
  if (
    depFields.some((field) =>
      hasAnyPackage(getDependencyObject(pkgRecord, field), FRONTEND_FRAMEWORK_PACKAGES),
    )
  ) {
    return false;
  }

  return (
    hasNonEmptyField(pkgRecord.bin) ||
    hasAnyPackage(getDependencyObject(pkgRecord, 'dependencies'), BACKEND_SERVER_PACKAGES)
  );
}

const JSON_TOKEN_RE = /"(?:\\.|[^"\\\n])*"|[{[]|[}\]]|:|\n/g;

/**
 * Finds the 1-based line number where `pkgName` is defined inside the top-level `field`
 * object of `packageJsonContent`.
 */
function findPackageLine(
  packageJsonContent: string,
  field: string,
  pkgName: string,
): number {
  let depth = 0;
  let line = 1;
  let inTargetField = false;
  let pendingString: string | null = null;
  let pendingLine = 1;

  for (const [token] of packageJsonContent.matchAll(JSON_TOKEN_RE)) {
    if (token === '\n') {
      line++;
    } else if (token === '{' || token === '[') {
      depth++;
      pendingString = null;
    } else if (token === '}' || token === ']') {
      if (inTargetField && depth === 2) {
        return 1;
      }
      depth--;
      pendingString = null;
    } else if (token === ':') {
      if (depth === 1) {
        inTargetField = pendingString === field;
      } else if (inTargetField && depth === 2 && pendingString === pkgName) {
        return pendingLine;
      }
      pendingString = null;
    } else {
      pendingString = token.includes('\\') ? (JSON.parse(token) as string) : token.slice(1, -1);
      pendingLine = line;
    }
  }

  return 1;
}

/**
 * Scans `package.json` content against rules with DependencyRuleMatchers in a single parse pass.
 */
export function scanPackageJsonRules<T extends { readonly matcher: DependencyRuleMatcher }>(
  filePath: string,
  packageJsonContent: string,
  rules: readonly T[],
): { rule: T; match: AnalyzerMatch }[] {
  if (rules.length === 0) {
    return [];
  }

  let pkgData: unknown;
  try {
    pkgData = JSON.parse(packageJsonContent);
  } catch {
    return [];
  }

  if (!isRecord(pkgData) || isPureNodeBackendOrCliPackage(pkgData)) {
    return [];
  }

  const depEntries: Array<{
    readonly field: string;
    readonly pkgName: string;
    readonly versionRange: string;
    line?: number;
  }> = [];

  for (const field of RUNTIME_DEPENDENCY_FIELDS) {
    const deps = getDependencyObject(pkgData, field);
    if (!deps) {
      continue;
    }
    for (const [pkgName, versionVal] of Object.entries(deps)) {
      depEntries.push({
        field,
        pkgName,
        versionRange: typeof versionVal === 'string' ? versionVal : '*',
      });
    }
  }

  if (depEntries.length === 0) {
    return [];
  }

  const ctx: DependencyMatcherContext = {
    filePath,
    packageJson: pkgData,
  };
  const results: { rule: T; match: AnalyzerMatch }[] = [];

  for (const rule of rules) {
    const { matcher } = rule;
    for (const entry of depEntries) {
      if (!matcher.packages.includes(entry.pkgName)) {
        continue;
      }
      const message = matcher.matchPackage
        ? matcher.matchPackage(entry.pkgName, entry.versionRange, ctx)?.message
        : `Legacy package "${entry.pkgName}" found (${entry.versionRange}) targeted for modernization.`;
      if (message !== undefined) {
        entry.line ??= findPackageLine(packageJsonContent, entry.field, entry.pkgName);
        results.push({
          rule,
          match: { line: entry.line, message },
        });
      }
    }
  }

  return results;
}

/**
 * Scans package.json content against a list of DependencyRuleMatchers.
 * Scans only runtime `dependencies` and `peerDependencies` by default, and skips
 * pure Node.js backend server / CLI `package.json` files.
 */
export function scanPackageJson(
  filePath: string,
  packageJsonContent: string,
  rules: readonly DependencyRuleMatcher[],
): AnalyzerMatch[] {
  return scanPackageJsonRules(
    filePath,
    packageJsonContent,
    rules.map((matcher) => ({ matcher })),
  ).map(({ match }) => match);
}
