import type {
  AnalyzerMatch,
  DependencyMatcherContext,
  DependencyRuleMatcher,
} from '../schema.ts';
import {
  hasVendoredLicenseHeader,
  isBuildOrInstallPath,
  isCandidateVendoredFile,
  isCheckedInVendorPath,
  isExcludedCorpusNonAppPath,
  isMinifiedContent,
} from './file-filter.ts';

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

function extractBasename(relPath: string): string {
  const normalized = relPath.replace(/\\/g, '/');
  const lastSlashIndex = normalized.lastIndexOf('/');
  return lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized;
}

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
  const unscoped =
    raw.startsWith('@') && raw.includes('/')
      ? raw.slice(raw.indexOf('/') + 1)
      : raw;
  let base = unscoped;
  if (base.endsWith('.js')) {
    base = base.slice(0, -3);
  } else if (base.endsWith('-js')) {
    base = base.slice(0, -3);
  }
  let core = base;
  if (core.startsWith('jquery-') || core.startsWith('jquery.')) {
    core = core.slice(7);
  } else if (core.startsWith('vanilla-') || core.startsWith('vanilla.')) {
    core = core.slice(8);
  }
  return { raw, unscoped, base, core };
}

function buildFilenameCandidates(baseName: string): ReadonlySet<string> {
  const candidates = new Set<string>();
  const stem = stripKnownExtension(baseName);
  const stemNoVersion = stem.replace(VERSION_SUFFIX_REGEX, '');

  const rawLower = stemNoVersion.toLowerCase();
  candidates.add(rawLower);

  const kebabStem = stemNoVersion
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  candidates.add(kebabStem);

  let withoutJquerySuffix = rawLower;
  if (withoutJquerySuffix.endsWith('.jquery')) {
    withoutJquerySuffix = withoutJquerySuffix.slice(0, -'.jquery'.length);
    candidates.add(withoutJquerySuffix);
  } else if (withoutJquerySuffix.endsWith('-jquery')) {
    withoutJquerySuffix = withoutJquerySuffix.slice(0, -'-jquery'.length);
    candidates.add(withoutJquerySuffix);
  }

  let withoutJqueryPrefix = withoutJquerySuffix;
  if (withoutJqueryPrefix.startsWith('jquery.')) {
    withoutJqueryPrefix = withoutJqueryPrefix.slice('jquery.'.length);
    candidates.add(withoutJqueryPrefix);
  } else if (withoutJqueryPrefix.startsWith('jquery-')) {
    withoutJqueryPrefix = withoutJqueryPrefix.slice('jquery-'.length);
    candidates.add(withoutJqueryPrefix);
  }

  const dotToHyphen = rawLower.replace(/\./g, '-');
  candidates.add(dotToHyphen);

  return candidates;
}

const STRICT_SINGLE_WORD_PACKAGES: ReadonlySet<string> = new Set([
  'chosen',
  'aos',
  'countries',
  'country',
  'mark',
  'sal',
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
      if (
        lower.includes('copyright') ||
        lower.includes('@author') ||
        /\bauthors?\b\s*[:-]/i.test(line) ||
        /\(c\)\s*\d{4}/i.test(line)
      ) {
        return false;
      }
      return true;
    })
    .join('\n');
}

function bannerIdentifiesPackage(bannerSlice: string, pkgName: string): boolean {
  if (bannerSlice.length === 0) {
    return false;
  }

  const commentBlock = extractLeadingComment(bannerSlice);
  if (!commentBlock) {
    return false;
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
    return false;
  }

  const cleanedComment = stripAuthorAndCopyrightLines(commentBlock);
  const pkgNorm = normalizePackageName(pkgName);

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
    // If full package name is hyphenated/scoped (like 'chosen-js' or 'i18n-iso-countries'), allow exact full name
    if (pkgNorm.raw.includes('-') || pkgNorm.raw.includes('.')) {
      const fullPkgPattern = new RegExp(`\\b${escapeRegExp(pkgNorm.raw)}\\b`, 'i');
      if (fullPkgPattern.test(cleanedComment)) {
        return true;
      }
    }

    const coreEsc = escapeRegExp(pkgNorm.core);
    const strictPattern = new RegExp(
      `\\b(?:(?:jquery|vanilla)[.-])?${coreEsc}(?:\\.[a-z0-9]+)?\\.js\\b|` +
      `\\b${coreEsc}\\.jquery(?:\\.js)?\\b|` +
      `\\b${coreEsc}[-_]js\\b|` +
      `\\b${coreEsc}\\s+v?\\d+(?:\\.\\d+)*\\b|` +
      `\\b${coreEsc}\\s*\\(\\s*v?\\d+|` +
      `\\b${coreEsc}\\s*[,:—–\\-]\\s+`,
      'i',
    );
    return strictPattern.test(cleanedComment);
  }

  // Check if the full package name appears directly in the banner (e.g. 'scrollreveal', 'tablesaw')
  const fullPkgPattern = new RegExp(`\\b${escapeRegExp(pkgNorm.raw)}\\b`, 'i');
  if (fullPkgPattern.test(cleanedComment)) {
    return true;
  }

  if (pkgNorm.unscoped !== pkgNorm.raw) {
    const unscopedPattern = new RegExp(`\\b${escapeRegExp(pkgNorm.unscoped)}\\b`, 'i');
    if (unscopedPattern.test(cleanedComment)) {
      return true;
    }
  }

  const wordsToMatch = new Set<string>([
    pkgNorm.raw,
    pkgNorm.unscoped,
    pkgNorm.base,
    pkgNorm.core,
  ]);

  if (pkgNorm.base.includes('-')) {
    wordsToTryAddNoHyphen(wordsToMatch, pkgNorm.base);
  }

  for (const word of wordsToMatch) {
    if (word.length < 3) {
      const shortPattern = new RegExp(`\\b${escapeRegExp(word)}\\.js\\b`, 'i');
      if (shortPattern.test(cleanedComment)) {
        return true;
      }
      continue;
    }

    const wordPattern = new RegExp(`\\b${escapeRegExp(word)}(?:\\.js)?\\b`, 'i');
    if (wordPattern.test(cleanedComment)) {
      return true;
    }
  }

  return false;
}

function wordsToTryAddNoHyphen(targetSet: Set<string>, hyphenatedWord: string): void {
  targetSet.add(hyphenatedWord.replace(/-/g, ''));
}

function matchesVendoredPackage(
  baseName: string,
  content: string,
  pkgName: string,
): boolean {
  const candidates = buildFilenameCandidates(baseName);
  const pkgNorm = normalizePackageName(pkgName);

  if (
    candidates.has(pkgNorm.raw) ||
    candidates.has(pkgNorm.unscoped) ||
    candidates.has(pkgNorm.base) ||
    candidates.has(pkgNorm.core)
  ) {
    return true;
  }

  const lowerBase = baseName.toLowerCase();
  if (pkgNorm.core === 'moment') {
    if (
      lowerBase.startsWith('moment-with-') ||
      lowerBase.startsWith('moment.') ||
      lowerBase.startsWith('moment-timezone')
    ) {
      return true;
    }
  }

  if (pkgNorm.raw === 'dompurify' && candidates.has('purify')) {
    return true;
  }

  const bannerSlice = content.slice(0, 1500);
  return bannerIdentifiesPackage(bannerSlice, pkgName);
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
  if (matchers.length === 0) {
    return [];
  }

  if (isBuildOrInstallPath(relPath)) {
    return [];
  }

  const lowerPath = relPath.toLowerCase();
  const dotIndex = lowerPath.lastIndexOf('.');
  if (dotIndex === -1) {
    return [];
  }
  const extension = lowerPath.slice(dotIndex);
  if (
    extension !== '.js' &&
    extension !== '.mjs' &&
    extension !== '.cjs' &&
    extension !== '.css'
  ) {
    return [];
  }

  const isVendoredOrMinified =
    isCheckedInVendorPath(relPath) ||
    isCandidateVendoredFile(relPath) ||
    isExcludedCorpusNonAppPath(relPath) ||
    isMinifiedContent(content) ||
    hasVendoredLicenseHeader(content);

  if (!isVendoredOrMinified) {
    return [];
  }

  const baseName = extractBasename(relPath);
  const matches: AnalyzerMatch[] = [];

  for (const matcher of matchers) {
    let matchedPackageName: string | null = null;
    for (const targetPkg of matcher.packages) {
      if (matchesVendoredPackage(baseName, content, targetPkg)) {
        matchedPackageName = targetPkg;
        break;
      }
    }

    if (!matchedPackageName) {
      continue;
    }

    let messageText: string;
    if (matcher.matchPackage) {
      const dummyCtx: DependencyMatcherContext = {
        filePath: relPath,
        packageJson: {},
      };
      const pkgResult = matcher.matchPackage(matchedPackageName, '*', dummyCtx);
      messageText = pkgResult
        ? `Vendored legacy library "${baseName}" (${matchedPackageName}): ${pkgResult.message}`
        : `Vendored legacy library "${baseName}" (${matchedPackageName}) targeted for modernization.`;
    } else {
      messageText = `Vendored legacy library "${baseName}" (${matchedPackageName}) targeted for modernization.`;
    }

    matches.push({
      line: 1,
      message: messageText,
      isVendoredLibrary: true,
    });
  }

  return matches;
}

const RUNTIME_DEPENDENCY_FIELDS = [
  'dependencies',
  'peerDependencies',
] as const;

const ALL_DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

export const FRONTEND_FRAMEWORK_PACKAGES: ReadonlySet<string> = new Set([
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

export const BACKEND_SERVER_PACKAGES: ReadonlySet<string> = new Set([
  'express',
  'fastify',
  'koa',
  '@nestjs/core',
  '@hapi/hapi',
  'hapi',
  'restify',
]);

function getDependencyObject(
  pkgRecord: Readonly<Record<string, unknown>>,
  field: string,
): Readonly<Record<string, unknown>> | null {
  const section = pkgRecord[field];
  if (typeof section === 'object' && section !== null && !Array.isArray(section)) {
    return section as Readonly<Record<string, unknown>>;
  }
  return null;
}

function hasAnyPackage(
  deps: Readonly<Record<string, unknown>> | null,
  targetPackages: ReadonlySet<string>,
): boolean {
  if (!deps) {
    return false;
  }
  for (const pkgName of Object.keys(deps)) {
    if (targetPackages.has(pkgName)) {
      return true;
    }
  }
  return false;
}

function hasNonEmptyField(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.keys(value).length > 0;
  }
  return false;
}

/**
 * Returns true if the parsed package.json represents a pure Node.js backend server
 * or CLI tool where browser modernization rules do not apply (R46):
 * 1. `parsed.bin` is present without a `"browser"` field or frontend framework in
 *    `dependencies`/`devDependencies`/`peerDependencies`, OR
 * 2. `dependencies` contains a backend server framework (`express`, `fastify`, `koa`,
 *    `@nestjs/core`, `@hapi/hapi`, `hapi`, `restify`) without any frontend/DOM framework
 *    in `dependencies`/`devDependencies`/`peerDependencies`.
 */
export function isPureNodeBackendOrCliPackage(
  pkgRecord: Readonly<Record<string, unknown>>,
): boolean {
  const deps = getDependencyObject(pkgRecord, 'dependencies');
  const devDeps = getDependencyObject(pkgRecord, 'devDependencies');
  const peerDeps = getDependencyObject(pkgRecord, 'peerDependencies');

  const hasFrontendFramework =
    hasAnyPackage(deps, FRONTEND_FRAMEWORK_PACKAGES) ||
    hasAnyPackage(devDeps, FRONTEND_FRAMEWORK_PACKAGES) ||
    hasAnyPackage(peerDeps, FRONTEND_FRAMEWORK_PACKAGES);

  if (hasFrontendFramework) {
    return false;
  }

  const hasBin = hasNonEmptyField(pkgRecord.bin);
  const hasBrowser = hasNonEmptyField(pkgRecord.browser);
  if (hasBrowser) {
    return false;
  }

  if (hasBin) {
    return true;
  }

  if (hasAnyPackage(deps, BACKEND_SERVER_PACKAGES)) {
    return true;
  }

  return false;
}

function findPackageLineInFields(
  lines: readonly string[],
  targetKey: string,
  fields: readonly string[],
): number | null {
  let insideDepsSection = false;
  let sectionBraceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (!insideDepsSection) {
      for (const field of fields) {
        const fieldIdx = line.indexOf(`"${field}"`);
        if (fieldIdx !== -1) {
          const rest = line.slice(fieldIdx + field.length + 2).trimStart();
          if (!rest.startsWith(':')) {
            continue;
          }
          insideDepsSection = true;
          sectionBraceDepth = 0;
          for (const char of rest) {
            if (char === '{') sectionBraceDepth++;
            if (char === '}') sectionBraceDepth--;
          }
          if (sectionBraceDepth <= 0) {
            insideDepsSection = false;
          }
          break;
        }
      }
    } else {
      for (const char of line) {
        if (char === '{') sectionBraceDepth++;
        if (char === '}') sectionBraceDepth--;
      }

      const trimmed = line.trim();
      if (trimmed.startsWith(targetKey)) {
        const afterKey = trimmed.slice(targetKey.length).trim();
        if (afterKey.startsWith(':')) {
          return i + 1;
        }
      }

      if (sectionBraceDepth <= 0) {
        insideDepsSection = false;
      }
    }
  }

  return null;
}

/**
 * Finds the 1-based line number where a package name is defined in package.json text.
 * Strictly scopes the search inside dependency blocks to avoid false line matches in keywords,
 * descriptions, or script commands (O69).
 */
function findPackageLine(packageJsonContent: string, pkgName: string): number {
  const lines = packageJsonContent.split('\n');
  const targetKey = `"${pkgName}"`;

  const runtimeLine = findPackageLineInFields(
    lines,
    targetKey,
    RUNTIME_DEPENDENCY_FIELDS,
  );
  if (runtimeLine !== null) {
    return runtimeLine;
  }

  const anyDepLine = findPackageLineInFields(
    lines,
    targetKey,
    ALL_DEPENDENCY_FIELDS,
  );
  if (anyDepLine !== null) {
    return anyDepLine;
  }

  // Fallback: search anywhere if structure is non-standard
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l && l.includes(targetKey)) {
      return i + 1;
    }
  }
  return 1;
}

interface MatchPackageParams {
  readonly pkgName: string;
  readonly versionRange: string;
  readonly packageJsonContent: string;
  readonly rules: readonly DependencyRuleMatcher[];
  readonly ctx: DependencyMatcherContext;
}

/**
 * Evaluates dependency rules against a single package entry.
 */
function matchPackageAgainstRules(params: MatchPackageParams): AnalyzerMatch[] {
  const matches: AnalyzerMatch[] = [];
  const { pkgName, versionRange, packageJsonContent, rules, ctx } = params;

  for (const rule of rules) {
    if (!rule.packages.includes(pkgName)) {
      continue;
    }

    const line = findPackageLine(packageJsonContent, pkgName);
    if (!rule.matchPackage) {
      matches.push({
        line,
        message: `Legacy package "${pkgName}" found (${versionRange}) targeted for modernization.`,
      });
      continue;
    }

    const result = rule.matchPackage(pkgName, versionRange, ctx);
    if (result) {
      matches.push({ line, message: result.message });
    }
  }
  return matches;
}

function ruleIncludesDevDependencies(rule: DependencyRuleMatcher): boolean {
  return (
    'includeDevDependencies' in rule &&
    (rule as { readonly includeDevDependencies?: unknown }).includeDevDependencies === true
  );
}

/**
 * Scans package.json content against a list of DependencyRuleMatchers (R46).
 * Scans only runtime `dependencies` and `peerDependencies` by default, and skips
 * pure Node.js backend server / CLI `package.json` files.
 */
export function scanPackageJson(
  filePath: string,
  packageJsonContent: string,
  rules: readonly DependencyRuleMatcher[],
): AnalyzerMatch[] {
  if (rules.length === 0) {
    return [];
  }

  let pkgData: unknown;
  try {
    pkgData = JSON.parse(packageJsonContent);
  } catch {
    return [];
  }

  if (typeof pkgData !== 'object' || pkgData === null || Array.isArray(pkgData)) {
    return [];
  }

  const pkgRecord = pkgData as Record<string, unknown>;
  if (isPureNodeBackendOrCliPackage(pkgRecord)) {
    return [];
  }

  const ctx: DependencyMatcherContext = {
    filePath,
    packageJson: pkgRecord,
  };

  const matches: AnalyzerMatch[] = [];
  const optInDevRules = rules.filter(ruleIncludesDevDependencies);

  for (const field of RUNTIME_DEPENDENCY_FIELDS) {
    const deps = getDependencyObject(pkgRecord, field);
    if (!deps) {
      continue;
    }

    for (const [pkgName, versionVal] of Object.entries(deps)) {
      const versionRange = typeof versionVal === 'string' ? versionVal : '*';
      const pkgMatches = matchPackageAgainstRules({
        pkgName,
        versionRange,
        packageJsonContent,
        rules,
        ctx,
      });
      for (const m of pkgMatches) {
        matches.push(m);
      }
    }
  }

  if (optInDevRules.length > 0) {
    const devDeps = getDependencyObject(pkgRecord, 'devDependencies');
    if (devDeps) {
      for (const [pkgName, versionVal] of Object.entries(devDeps)) {
        const versionRange = typeof versionVal === 'string' ? versionVal : '*';
        const pkgMatches = matchPackageAgainstRules({
          pkgName,
          versionRange,
          packageJsonContent,
          rules: optInDevRules,
          ctx,
        });
        for (const m of pkgMatches) {
          matches.push(m);
        }
      }
    }
  }

  return matches;
}
