import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly patternName: string;
  readonly matchedText: string;
}

export const BANNED_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  { name: 'analyzer-internal', regex: /analyzer[-_ ]?internal/i },
  { name: 'gitmirror', regex: /git[-_ ]?mirror/i },
  { name: 'farm_fingerprint', regex: /farm[-_ ]?fingerprint/i },
  { name: 'jetski', regex: /jetski/i },
  { name: 'review-observation-decision-id', regex: /\b(?:[RO][0-9]{1,3}|G[0-9]{1,3}|D-[0-9]{2,3})\b/ },
  { name: 'internal-doc-reference', regex: /\b(?:PROGRESS|PLAN|DECISIONS)\.md\b/i },
];

/**
 * Narrow exemptions for existing code:
 * 1. llm-verifier.ts formatVerifierPrompt error string: version-hash continuity; remove at the next intentional verifier bump.
 * 2. update-eval.ts progress logging in internal eval directory.
 */
export function isExemptedLine(relPath: string, lineText: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');

  // 1. llm-verifier.ts formatVerifierPrompt: version-hash continuity; remove at the next intentional verifier bump
  if (
    normalized === 'src/analyzing/llm-verifier.ts' &&
    lineText.includes('formatVerifierPrompt failed:') &&
    lineText.includes('Failing fast per R28/O55a.')
  ) {
    return true;
  }

  // 2. update-eval.ts progress logging in internal eval directory
  if (
    normalized === 'src/analyzing/eval/update-eval.ts' &&
    lineText.includes('PROGRESS.md')
  ) {
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
        if (isExemptedLine(relPath, line)) {
          continue;
        }

        for (const pattern of BANNED_PATTERNS) {
          if (pattern.regex.test(line)) {
            violations.push({
              file: relPath,
              line: i + 1,
              patternName: pattern.name,
              matchedText: line.trim(),
            });
            break;
          }
        }
      }
    }
  }

  return violations;
}

export function runCheck(): Violation[] {
  const analyzingDir = resolve(import.meta.dirname);
  const root = resolve(analyzingDir, '../..');
  return scanDirectory(analyzingDir, root);
}

// Execute when run directly via CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const violations = runCheck();

  if (violations.length > 0) {
    console.error(`\n❌ [check-internal-references] FAILED: Found ${violations.length} internal reference violations in public analyzer files:`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} [${v.patternName}]: ${v.matchedText}`);
    }
    process.exit(1);
  }

  console.log(`\n✔ [check-internal-references] PASSED: Zero internal references in public analyzer code.`);
}
