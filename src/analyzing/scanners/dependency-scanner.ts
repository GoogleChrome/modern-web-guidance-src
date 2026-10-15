import type {
  AnalyzerMatch,
  DependencyMatcherContext,
  DependencyRuleMatcher,
} from '../schema.ts';

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/**
 * Finds the 1-based line number where a package name is defined in package.json text.
 */
function findPackageLine(packageJsonContent: string, pkgName: string): number {
  const lines = packageJsonContent.split('\n');
  const targetPattern = `"${pkgName}"`;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l && l.includes(targetPattern)) {
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

/**
 * Scans package.json content against a list of DependencyRuleMatchers.
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

  if (typeof pkgData !== 'object' || pkgData === null) {
    return [];
  }

  const pkgRecord = pkgData as Record<string, unknown>;
  const ctx: DependencyMatcherContext = {
    filePath,
    packageJson: pkgRecord,
  };

  const matches: AnalyzerMatch[] = [];

  for (const field of DEPENDENCY_FIELDS) {
    const section = pkgRecord[field];
    if (typeof section !== 'object' || section === null) {
      continue;
    }

    const deps = section as Record<string, unknown>;
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

  return matches;
}
