import { posix } from 'node:path';

export const BUILD_OR_INSTALL_DIR_SEGMENTS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '_generated',
  '.git',
  '.cache',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '.worktrees',
  '.worktree',
  '.venv',
  'venv',
  '.nyc_output',
  'test-results',
  'playwright-report',
  'tmp',
  'temp',
  '.tmp',
  '.temp',
  'gen',
  'generated',
  'snapshots',
  'extracted_snapshots',
]);

const CHECKED_IN_VENDOR_DIR_SEGMENTS: ReadonlySet<string> = new Set([
  'vendor',
  'third_party',
  'third-party',
  'external',
  'bower_components',
  'jspm_packages',
  'bundle',
  'libs',
  'non-npm',
]);

const VENDORED_DIR_SEGMENTS: ReadonlySet<string> = new Set([
  ...BUILD_OR_INSTALL_DIR_SEGMENTS,
  ...CHECKED_IN_VENDOR_DIR_SEGMENTS,
]);

export const CORPUS_NON_APP_DIR_SEGMENTS: ReadonlySet<string> = new Set([
  'docs',
  'doc',
  'site',
  'website',
  'gh-pages',
  'gen',
  'generated',
]);

export const DOCS_AND_TESTS_DIR_SEGMENTS: ReadonlySet<string> = new Set([
  'docs',
  'doc',
  'examples',
  'example',
  'demo',
  'demos',
  'test',
  'tests',
  '__tests__',
  'spec',
  'specs',
  'fixtures',
  '__fixtures__',
]);

const TEST_OR_SPEC_FILE_RE = /(?:^|\.)(?:test|spec)\./i;

function normalizePath(relPath: string): string {
  return relPath.replace(/\\/g, '/').toLowerCase();
}

/**
 * Returns `true` if `relPath` (relative to the target directory) represents a documentation,
 * example, demo, test, spec, or fixtures path or is a `*.test.*` / `*.spec.*` file.
 */
export function isDocsOrTestsPath(relPath: string): boolean {
  const segments = normalizePath(relPath)
    .split('/')
    .filter((s) => s && s !== '.');
  if (segments.length === 0) {
    return false;
  }
  return (
    segments.slice(0, -1).some((seg) => DOCS_AND_TESTS_DIR_SEGMENTS.has(seg)) ||
    TEST_OR_SPEC_FILE_RE.test(segments.at(-1) ?? '')
  );
}

const DEFAULT_IGNORED_EXTENSIONS: readonly string[] = [
  '.min.js',
  '.min.css',
  '.bundle.js',
  '.bundle.css',
  '.pack.js',
  '-opt.js',
  '.opt.js',
  '.map',
  '.d.ts',
];

export const JS_RULE_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
  '.vue',
  '.svelte',
  '.astro',
  '.html',
  '.htm',
] as const;

export const CSS_RULE_EXTENSIONS = [
  '.css',
  '.vue',
  '.svelte',
  '.astro',
  '.html',
  '.htm',
] as const;

export const DOM_RULE_EXTENSIONS = [
  '.html',
  '.htm',
  '.vue',
  '.svelte',
  '.astro',
  '.jsx',
  '.tsx',
] as const;

export const DEPENDENCY_RULE_FILENAMES = ['package.json'] as const;

const SUPPORTED_SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
  '.html',
  '.htm',
  '.php',
  '.vue',
  '.svelte',
  '.astro',
  '.css',
]);

const CANDIDATE_VENDORED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
]);

/**
 * Well-known vendored third-party library filenames (unminified copies checked into repos).
 */
const VENDORED_LIBRARY_FILENAMES: ReadonlySet<string> = new Set([
  'bundle.js',
  'bootstrap.js',
  'bootstrap.bundle.js',
  'bootstrap-sprockets.js',
  'jquery.js',
  'jquery-ui.js',
  'moment.js',
  'moment-with-locales.js',
  'moment-with-cn.js',
  'dayjs.js',
  'codemirror.js',
  'popper.js',
  'zepto.js',
  'underscore.js',
  'lodash.js',
  'modernizr.js',
  'prism.js',
  'highlight.js',
  'chosen.jquery.js',
  'select2.js',
  'select2.full.js',
  'tablesaw.js',
  'tablesaw.jquery.js',
  'humanize-duration.js',
]);

const VENDORED_MOMENT_FILENAME_RE =
  /^(?:moment(?:-with-[a-z0-9_-]+|-timezone(?:-with-data.*)?)?)\.js$/i;
const VENDORED_MODERNIZR_FILENAME_RE = /^modernizr(?:[.-].*)?\.js$/i;
const VENDORED_CHUI_STYLESHEET_RE = /^chui[.-].*\.css$/i;

/**
 * Vendored library directory segments that frequently appear in source trees.
 */
const VENDORED_DIRECTORY_SUBPATHS: readonly string[] = [
  '/dayjs/esm/',
  '/dayjs/plugin/',
  '/codemirror/',
  '/jquery-ui/',
  '/tinymce/',
  '/ckeditor/',
  '/mathjax/',
  '/dokka/',
];

/**
 * Framework-published hashed asset directories (e.g. Yii/Rails `/assets/a09b59a8/`).
 */
const HASHED_ASSET_DIR_RE = /\/assets\/[0-9a-f]{7,16}\//i;

const MAX_UNMINIFIED_LINE_LENGTH = 1200;
const STRING_LITERAL_REGEX =
  /"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`/g;
const LEADING_COMMENT_BLOCK_RE =
  /^\s*(?:\/\*[\s\S]*?\*\/|(?:\/\/[^\n]*\n\s*)+|<!--[\s\S]*?-->)/;
const VENDOR_VERSION_REGEX =
  /(?:\bv\d+\.\d+(?:\.\d+)?\b|@version\s*:?\s*v?\d+\.\d+|\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b)/i;
const LICENSE_URL_REGEX = /https?:\/\/[^\s*>)]+/gi;
const LICENSE_NAME_VERSION_REGEX =
  /(?:apache|mpl|gpl|lgpl|agpl|bsd|mit|isc|epl|cddl|cc(?:-by(?:-[a-z]+)*)?)(?:\s+license,?\s*(?:version)?)?[\s-]*v?\d+\.\d+(?:\.\d+)?/gi;
const SPDX_LICENSE_REGEX = /spdx-license-identifier:[^\n]*/gi;
const INLINE_ASSET_LINE_REGEX = /data:(?:image|application|font)\/|<svg\b/i;
const VENDOR_LICENSE_REGEX =
  /(?:\/\*!|@license|@preserve|@copyright|all rights reserved|licensed under (?:the )?(?:mit|bsd|apache|gpl|mpl|isc))/i;

export interface FileFilterOptions {
  readonly ownNames?: readonly string[];
  readonly customIgnoredDirs?: ReadonlySet<string>;
  readonly maxLineLength?: number;
  readonly excludeCorpusNonAppDirs?: boolean;
  readonly includeDocsAndTests?: boolean;
}

function hasPathSegment(
  normalizedPath: string,
  segmentsSet: ReadonlySet<string>,
): boolean {
  const segments = normalizedPath.split('/').filter(Boolean);
  return (
    segments.slice(0, -1).some((seg) => segmentsSet.has(seg)) ||
    (segments.length === 1 && segmentsSet.has(segments[0] ?? ''))
  );
}

/**
 * Returns `true` if `relPath` is a known vendored third-party library file,
 * vendored library directory subpath, or framework-published hashed asset bundle.
 */
export function isExcludedCorpusNonAppPath(relPath: string): boolean {
  const normalized = normalizePath(relPath);
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const base = posix.basename(normalized);

  return (
    VENDORED_LIBRARY_FILENAMES.has(base) ||
    VENDORED_MOMENT_FILENAME_RE.test(base) ||
    VENDORED_MODERNIZR_FILENAME_RE.test(base) ||
    VENDORED_CHUI_STYLESHEET_RE.test(base) ||
    VENDORED_DIRECTORY_SUBPATHS.some((subpath) => withLeadingSlash.includes(subpath)) ||
    HASHED_ASSET_DIR_RE.test(withLeadingSlash)
  );
}

/**
 * Returns true if the path represents non-app documentation or corpus content.
 */
export function isCorpusNonAppPath(relPath: string): boolean {
  const normalized = normalizePath(relPath);
  return (
    hasPathSegment(normalized, CORPUS_NON_APP_DIR_SEGMENTS) ||
    /(?:^|\/)(?:docs|doc|site|website|gh-pages)\//i.test(normalized) ||
    /(?:^|\/)content\/.*\/docs\//i.test(normalized)
  );
}

/**
 * Checks whether a relative path represents a vendored, generated, or build-output location.
 * When options.excludeCorpusNonAppDirs is true, also excludes docs/, site/, website/, gh-pages/, gen/.
 */
export function isVendoredOrGeneratedPath(
  relPath: string,
  options?: FileFilterOptions,
): boolean {
  const normalized = normalizePath(relPath);
  const segments = normalized.split('/').filter(Boolean);
  const ignoredDirs = options?.customIgnoredDirs ?? VENDORED_DIR_SEGMENTS;
  const dirSegments = segments.slice(0, -1);

  return (
    isExcludedCorpusNonAppPath(normalized) ||
    dirSegments.some((seg) => ignoredDirs.has(seg)) ||
    (options?.excludeCorpusNonAppDirs === true && isCorpusNonAppPath(normalized)) ||
    DEFAULT_IGNORED_EXTENSIONS.some((ext) => normalized.endsWith(ext))
  );
}

function isLongCodeLine(
  line: string,
  trimmed: string,
  maxLineLength: number,
  isSingleLine: boolean,
): boolean {
  if (line.length <= maxLineLength) {
    return false;
  }
  const hasInlineAsset = INLINE_ASSET_LINE_REGEX.test(line);
  if (hasInlineAsset && (trimmed.startsWith('<svg') || trimmed.startsWith('data:'))) {
    return false;
  }
  if (!isSingleLine || hasInlineAsset) {
    return line.replace(STRING_LITERAL_REGEX, '').length > maxLineLength;
  }
  return true;
}

/**
 * Detects whether file content is minified based on maximum line length threshold.
 * Ignores isolated data URI or SVG template lines, and verifies line-count/length heuristics.
 */
export function isMinifiedContent(
  content: string,
  maxLineLength: number = MAX_UNMINIFIED_LINE_LENGTH,
): boolean {
  const lines = content.split('\n');
  const isSingleLine = lines.length <= 1;
  const nonEmptyLengths: number[] = [];
  let longLineCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    nonEmptyLengths.push(line.length);
    if (isLongCodeLine(line, trimmed, maxLineLength, isSingleLine)) {
      longLineCount++;
    }
  }

  if (longLineCount === 0) {
    return false;
  }

  // Multi-line file heuristic:
  // If the file has >= 20 lines, and long lines are < 5% of non-empty lines,
  // and the 90th percentile line length is < 160, this is normal authored code with an isolated long line.
  if (nonEmptyLengths.length >= 20) {
    const longLineFraction = longLineCount / nonEmptyLengths.length;
    nonEmptyLengths.sort((a, b) => a - b);
    const p90Index = Math.floor(nonEmptyLengths.length * 0.9);
    const p90 = nonEmptyLengths[Math.min(p90Index, nonEmptyLengths.length - 1)] ?? 0;
    if (longLineFraction < 0.05 && p90 < 160) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if the opening bytes contain a third-party versioned license banner.
 * First-party headers matching `ownNames` are protected and will not be treated as vendored.
 * Strips URLs, SPDX identifiers, and license-name version identifiers (e.g. Apache-2.0, MPL-2.0)
 * before testing version regex.
 */
export function hasVendoredLicenseHeader(
  content: string,
  options?: { ownNames?: readonly string[] },
): boolean {
  const match = content.slice(0, 2000).match(LEADING_COMMENT_BLOCK_RE);
  if (!match) {
    return false;
  }
  const headerSlice = match[0];

  if (!headerSlice.includes('/*!') && !VENDOR_LICENSE_REGEX.test(headerSlice)) {
    return false;
  }

  const sanitizedForVersion = headerSlice
    .replace(LICENSE_URL_REGEX, '')
    .replace(SPDX_LICENSE_REGEX, '')
    .replace(LICENSE_NAME_VERSION_REGEX, '');
  if (!VENDOR_VERSION_REGEX.test(sanitizedForVersion)) {
    return false;
  }

  if (options?.ownNames && options.ownNames.length > 0) {
    const headerLower = headerSlice.toLowerCase();
    if (options.ownNames.some((name) => headerLower.includes(name.toLowerCase()))) {
      return false;
    }
  }

  return true;
}

export const MAX_SOURCE_FILE_BYTES = 1_000_000;

/**
 * Master predicate determining whether a file should be scanned by analyzer rules.
 */
export function shouldScanFile(
  relPath: string,
  content?: string,
  options?: FileFilterOptions,
): boolean {
  if (
    isVendoredOrGeneratedPath(relPath, options) ||
    (!options?.includeDocsAndTests && isDocsOrTestsPath(relPath))
  ) {
    return false;
  }

  const normalized = normalizePath(relPath);
  if (!normalized.endsWith('package.json')) {
    const dotIdx = normalized.lastIndexOf('.');
    if (dotIdx === -1 || !SUPPORTED_SOURCE_EXTENSIONS.has(normalized.slice(dotIdx))) {
      return false;
    }
  }

  if (content !== undefined) {
    if (
      Buffer.byteLength(content, 'utf8') > MAX_SOURCE_FILE_BYTES ||
      isMinifiedContent(content, options?.maxLineLength) ||
      hasVendoredLicenseHeader(content, options)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Returns true if the path is inside a build or package manager install directory
 * (e.g. node_modules, dist, build, out, .cache) that should never be scanned.
 */
export function isBuildOrInstallPath(relPath: string): boolean {
  return hasPathSegment(normalizePath(relPath), BUILD_OR_INSTALL_DIR_SEGMENTS);
}

/**
 * Returns true if the path is inside a checked-in vendor directory (e.g. vendor, third_party, libs).
 */
export function isCheckedInVendorPath(relPath: string): boolean {
  return hasPathSegment(normalizePath(relPath), CHECKED_IN_VENDOR_DIR_SEGMENTS);
}

/**
 * Returns true if the given relative path and optional content represent a candidate vendored
 * or minified library file that may be checked for whole-file library detection.
 */
export function isCandidateVendoredFile(
  relPath: string,
  content?: string,
): boolean {
  const normalized = normalizePath(relPath);
  const dotIndex = normalized.lastIndexOf('.');
  if (
    dotIndex === -1 ||
    !CANDIDATE_VENDORED_EXTENSIONS.has(normalized.slice(dotIndex)) ||
    isBuildOrInstallPath(normalized)
  ) {
    return false;
  }
  return (
    isCheckedInVendorPath(normalized) ||
    DEFAULT_IGNORED_EXTENSIONS.some((ext) => normalized.endsWith(ext)) ||
    isExcludedCorpusNonAppPath(normalized) ||
    (content !== undefined && (isMinifiedContent(content) || hasVendoredLicenseHeader(content)))
  );
}
