export const VENDORED_DIR_SEGMENTS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '_generated',
  'vendor',
  'third_party',
  'external',
  '.git',
  '.cache',
  '.next',
  '.nuxt',
  '.output',
  'bower_components',
  'jspm_packages',
  'bundle',
  'coverage',
  'tmp',
  'temp',
  'libs',
  'non-npm',
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

export const SUPPORTED_SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([
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

/**
 * Well-known vendored third-party library filenames (unminified copies checked into repos, R42).
 */
export const VENDORED_LIBRARY_FILENAMES: ReadonlySet<string> = new Set([
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
]);

const VENDORED_MOMENT_FILENAME_RE =
  /^(?:moment(?:-with-[a-z0-9_-]+|-timezone(?:-with-data.*)?)?)\.js$/i;

const VENDORED_MODERNIZR_FILENAME_RE = /^modernizr(?:[.-].*)?\.js$/i;

const VENDORED_CHUI_STYLESHEET_RE = /^chui[.-].*\.css$/i;

/**
 * Vendored library directory segments that frequently appear in source trees (R42).
 */
export const VENDORED_DIRECTORY_SUBPATHS: readonly string[] = [
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
 * Framework-published hashed asset directories (e.g. Yii/Rails `/assets/a09b59a8/`, R42).
 */
const HASHED_ASSET_DIR_RE = /\/assets\/[0-9a-f]{7,16}\//i;

const MAX_UNMINIFIED_LINE_LENGTH = 5000;
const LICENSE_HEADER_SCAN_BYTES = 1500;
const THREE_PART_SEMVER_REGEX = /\bv?\d+\.\d+\.\d+\b/;
const VENDOR_LICENSE_REGEX =
  /(?:\/\*!|@license|@preserve|all rights reserved|licensed under the (?:mit|bsd|gpl|mpl))/i;

export interface FileFilterOptions {
  readonly ownNames?: readonly string[];
  readonly customIgnoredDirs?: ReadonlySet<string>;
  readonly maxLineLength?: number;
  readonly excludeCorpusNonAppDirs?: boolean;
}

function isStringSet(value: unknown): value is ReadonlySet<string> {
  return value instanceof Set;
}

/**
 * Returns `true` if `relPath` is a known vendored third-party library file,
 * vendored library directory subpath, or framework-published hashed asset bundle (R42).
 */
export function isExcludedCorpusNonAppPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const lastSlash = normalized.lastIndexOf('/');
  const base = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;

  if (
    VENDORED_LIBRARY_FILENAMES.has(base) ||
    VENDORED_MOMENT_FILENAME_RE.test(base) ||
    VENDORED_MODERNIZR_FILENAME_RE.test(base) ||
    VENDORED_CHUI_STYLESHEET_RE.test(base)
  ) {
    return true;
  }

  for (const subpath of VENDORED_DIRECTORY_SUBPATHS) {
    if (withLeadingSlash.includes(subpath)) {
      return true;
    }
  }

  if (HASHED_ASSET_DIR_RE.test(withLeadingSlash)) {
    return true;
  }

  return false;
}

/**
 * Checks whether a relative path represents a vendored, generated, or build-output location.
 * When options.excludeCorpusNonAppDirs is true, also excludes docs/, site/, website/, gh-pages/, gen/.
 */
export function isVendoredOrGeneratedPath(
  relPath: string,
  optionsOrCustomDirs?: FileFilterOptions | ReadonlySet<string>,
): boolean {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  const segments = normalized.split('/').filter(Boolean);

  let ignoredDirs: ReadonlySet<string>;
  let excludeCorpus = false;

  if (isStringSet(optionsOrCustomDirs)) {
    ignoredDirs = optionsOrCustomDirs;
  } else {
    ignoredDirs = optionsOrCustomDirs?.customIgnoredDirs ?? VENDORED_DIR_SEGMENTS;
    excludeCorpus = optionsOrCustomDirs?.excludeCorpusNonAppDirs === true;
  }

  if (isExcludedCorpusNonAppPath(normalized)) {
    return true;
  }

  for (const segment of segments.slice(0, -1)) {
    if (ignoredDirs.has(segment)) {
      return true;
    }
    if (excludeCorpus && CORPUS_NON_APP_DIR_SEGMENTS.has(segment)) {
      return true;
    }
  }

  // Filter corpus non-app / documentation paths (R24, O46)
  if (excludeCorpus) {
    if (
      /(?:^|\/)(?:docs|doc|site|website|gh-pages)\//i.test(normalized) ||
      /(?:^|\/)content\/.*\/docs\//i.test(normalized)
    ) {
      return true;
    }
  }

  for (const ext of DEFAULT_IGNORED_EXTENSIONS) {
    if (normalized.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Alias for `isVendoredOrGeneratedPath` (R42).
 */
export function isIgnoredPath(
  relPath: string,
  optionsOrCustomDirs?: FileFilterOptions | ReadonlySet<string>,
): boolean {
  return isVendoredOrGeneratedPath(relPath, optionsOrCustomDirs);
}

/**
 * Detects whether file content is minified based on maximum line length threshold.
 */
export function isMinifiedContent(
  content: string,
  maxLineLength: number = MAX_UNMINIFIED_LINE_LENGTH,
): boolean {
  const newline = content.indexOf('\n');
  if (newline === -1) {
    return content.length > maxLineLength;
  }

  let lineStart = 0;
  while (lineStart < content.length) {
    const nextNewline = content.indexOf('\n', lineStart);
    const lineEnd = nextNewline === -1 ? content.length : nextNewline;
    if (lineEnd - lineStart > maxLineLength) {
      return true;
    }
    lineStart = lineEnd + 1;
  }

  return false;
}

/**
 * Checks if the opening bytes contain a third-party versioned license banner.
 * First-party headers matching `ownNames` are protected and will not be treated as vendored.
 */
export function hasVendoredLicenseHeader(
  content: string,
  options?: { ownNames?: readonly string[] },
): boolean {
  const headerSlice = content.slice(0, LICENSE_HEADER_SCAN_BYTES);

  const hasLicenseIndicator =
    headerSlice.startsWith('/*!') || VENDOR_LICENSE_REGEX.test(headerSlice);
  if (!hasLicenseIndicator) {
    return false;
  }

  const hasThreePartSemver = THREE_PART_SEMVER_REGEX.test(headerSlice);
  if (!hasThreePartSemver) {
    return false;
  }

  if (options?.ownNames && options.ownNames.length > 0) {
    const headerLower = headerSlice.toLowerCase();
    for (const name of options.ownNames) {
      if (headerLower.includes(name.toLowerCase())) {
        return false;
      }
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
  if (isVendoredOrGeneratedPath(relPath, options)) {
    return false;
  }

  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  const isPackageJson = normalized.endsWith('package.json');
  if (!isPackageJson) {
    const dotIdx = normalized.lastIndexOf('.');
    if (dotIdx === -1 || !SUPPORTED_SOURCE_EXTENSIONS.has(normalized.slice(dotIdx))) {
      return false;
    }
  }

  if (content !== undefined) {
    // D-025, O26: Cap source files at < 1 MB (larger files are generated or bundled artifacts)
    if (Buffer.byteLength(content, 'utf8') > MAX_SOURCE_FILE_BYTES) {
      return false;
    }
    if (isMinifiedContent(content, options?.maxLineLength)) {
      return false;
    }
    if (hasVendoredLicenseHeader(content, options)) {
      return false;
    }
  }

  return true;
}
