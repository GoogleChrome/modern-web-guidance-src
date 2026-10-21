import type {
  AnalyzerMatch,
  DependencyMatcherContext,
  DependencyRuleMatcher,
} from '../schema.ts';

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
  'next',
  'nuxt',
  'astro',
  '@angular/core',
  'lit',
  'preact',
  'solid-js',
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
  if (hasBin && !hasBrowser) {
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
          insideDepsSection = true;
          sectionBraceDepth = 0;
          for (const char of line.slice(fieldIdx)) {
            if (char === '{') sectionBraceDepth++;
            if (char === '}') sectionBraceDepth--;
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
