const DEFAULT_IGNORED_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'generated',
  '_generated',
  'gen',
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
  'docs',
  'site',
  'website',
  'gh-pages',
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

const MAX_UNMINIFIED_LINE_LENGTH = 5000;
const LICENSE_HEADER_SCAN_BYTES = 1500;
const THREE_PART_SEMVER_REGEX = /\bv?\d+\.\d+\.\d+\b/;
const VENDOR_LICENSE_REGEX =
  /(?:\/\*!|@license|@preserve|all rights reserved|licensed under the (?:mit|bsd|gpl|mpl))/i;

export interface FileFilterOptions {
  readonly ownNames?: readonly string[];
  readonly customIgnoredDirs?: ReadonlySet<string>;
  readonly maxLineLength?: number;
}

/**
 * Checks whether a relative path represents a vendored, generated, or build-output location.
 */
export function isVendoredOrGeneratedPath(
  relPath: string,
  customIgnoredDirs?: ReadonlySet<string>,
): boolean {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  const segments = normalized.split('/').filter(Boolean);

  const ignoredDirs = customIgnoredDirs ?? DEFAULT_IGNORED_DIRS;
  for (const segment of segments.slice(0, -1)) {
    if (ignoredDirs.has(segment)) {
      return true;
    }
  }

  // Filter generated documentation paths (R24)
  if (
    /(?:^|\/)(?:docs|site|website|gh-pages)\//i.test(normalized) ||
    /(?:^|\/)content\/.*\/docs\//i.test(normalized)
  ) {
    return true;
  }

  for (const ext of DEFAULT_IGNORED_EXTENSIONS) {
    if (normalized.endsWith(ext)) {
      return true;
    }
  }

  return false;
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
  if (isVendoredOrGeneratedPath(relPath, options?.customIgnoredDirs)) {
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
