import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly patternName: string;
  readonly matchedText: string;
  readonly outOfScope: boolean;
}

export const BANNED_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  { name: 'analyzer-internal', regex: /analyzer-internal/i },
  { name: 'gitmirror', regex: /git[-_ ]?mirror/i },
  { name: 'farm_fingerprint', regex: /farm_fingerprint/i },
  { name: 'jetski', regex: /jetski/i },
  { name: 'decision-id', regex: /\bD-[0-9]{3}\b/ },
];

/**
 * Files currently owned by other agents during active refactoring.
 * Hits in these files are reported as pending work for their respective owners.
 */
export function isOutOfScope(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  if (
    normalized === 'src/analyzing/README.md' ||
    normalized === 'src/analyzing/LEXICON.md' ||
    normalized === 'src/analyzing/cli.ts' ||
    normalized === 'src/analyzing/cli.test.ts' ||
    normalized === 'src/analyzing/schema.ts' ||
    normalized === 'src/analyzing/rules/index.ts'
  ) {
    return true;
  }
  if (normalized.startsWith('src/analyzing/scanners/')) {
    return true;
  }
  if (normalized.startsWith('src/analyzing/rules/')) {
    // lazy-load-video-and-audio is in-scope and owned by this task
    if (normalized.includes('lazy-load-video-and-audio')) {
      return false;
    }
    return true;
  }
  return false;
}

export function scanDirectory(
  dir: string,
  root: string = resolve(import.meta.dirname, '../..'),
): Violation[] {
  const violations: Violation[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(root, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        continue;
      }
      violations.push(...scanDirectory(fullPath, root));
    } else if (entry.isFile()) {
      // Exclude this guard script and its test
      if (
        entry.name === 'check-internal-references.ts' ||
        entry.name === 'check-internal-references.test.ts'
      ) {
        continue;
      }

      // Only check text / source / markdown / json files
      if (!/\.(ts|js|json|md)$/.test(entry.name)) {
        continue;
      }

      const content = readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        for (const pattern of BANNED_PATTERNS) {
          if (pattern.regex.test(line)) {
            const outOfScope = isOutOfScope(relPath);
            violations.push({
              file: relPath,
              line: i + 1,
              patternName: pattern.name,
              matchedText: line.trim(),
              outOfScope,
            });
          }
        }
      }
    }
  }

  return violations;
}

export function runCheck(): { inScopeViolations: Violation[]; pendingViolations: Violation[] } {
  const analyzingDir = resolve(import.meta.dirname);
  const root = resolve(analyzingDir, '../..');
  const allViolations = scanDirectory(analyzingDir, root);

  const inScopeViolations = allViolations.filter((v) => !v.outOfScope);
  const pendingViolations = allViolations.filter((v) => v.outOfScope);

  return { inScopeViolations, pendingViolations };
}

// Execute when run directly via CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const { inScopeViolations, pendingViolations } = runCheck();

  if (pendingViolations.length > 0) {
    console.log(`\n[check-internal-references] Found ${pendingViolations.length} allowed out-of-scope occurrences:`);
    for (const v of pendingViolations) {
      console.log(`  [OUT OF SCOPE] ${v.file}:${v.line} (${v.patternName}) -> ${v.matchedText}`);
    }
  }

  if (inScopeViolations.length > 0) {
    console.error(`\n❌ [check-internal-references] FAILED: Found ${inScopeViolations.length} internal reference violations in in-scope analyzer files:`);
    for (const v of inScopeViolations) {
      console.error(`  ${v.file}:${v.line} [${v.patternName}]: ${v.matchedText}`);
    }
    process.exit(1);
  }

  console.log(`\n✔ [check-internal-references] PASSED: Zero internal references in public in-scope analyzer code.`);
}
