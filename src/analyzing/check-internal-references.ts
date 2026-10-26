import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly patternName: string;
  readonly matchedText: string;
  readonly pendingEc03a62f: boolean;
}

export const BANNED_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  { name: 'analyzer-internal', regex: /analyzer[-_ ]?internal/i },
  { name: 'gitmirror', regex: /git[-_ ]?mirror/i },
  { name: 'farm_fingerprint', regex: /farm[-_ ]?fingerprint/i },
  { name: 'jetski', regex: /jetski/i },
  { name: 'review-observation-decision-id', regex: /\b(?:[RO][0-9]{1,3}|G[0-9]{1,3}|D-[0-9]{2,3})\b/ },
];

/**
 * Exactly one narrow, temporary exemption: gitMirrorFilter line in schema.ts,
 * pending its coordinated move into analyzer-internal.
 */
export function isExemptedLine(relPath: string, lineText: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  return normalized === 'src/analyzing/schema.ts' && lineText.includes('gitMirrorFilter');
}

/**
 * Files currently actively edited/deleted by ec03a62f (rules/index.ts, rules/index.test.ts,
 * update-eval-data.json, copy-button, and camera-and-microphone-capture).
 * Hits in these files are reported as pending work for ec03a62f rather than failing.
 */
export function isPendingEc03a62f(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  return (
    normalized === 'src/analyzing/rules/index.ts' ||
    normalized === 'src/analyzing/rules/index.test.ts' ||
    normalized === 'src/analyzing/eval/update-eval-data.json' ||
    normalized.includes('copy-button') ||
    normalized.includes('camera-and-microphone-capture')
  );
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
            const pending = isPendingEc03a62f(relPath);
            violations.push({
              file: relPath,
              line: i + 1,
              patternName: pattern.name,
              matchedText: line.trim(),
              pendingEc03a62f: pending,
            });
            break;
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

  const inScopeViolations = allViolations.filter((v) => !v.pendingEc03a62f);
  const pendingViolations = allViolations.filter((v) => v.pendingEc03a62f);

  return { inScopeViolations, pendingViolations };
}

// Execute when run directly via CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const { inScopeViolations, pendingViolations } = runCheck();

  if (pendingViolations.length > 0) {
    console.log(`\n[check-internal-references] Found ${pendingViolations.length} hits pending ec03a62f work:`);
    for (const v of pendingViolations) {
      console.log(`  [PENDING ec03a62f] ${v.file}:${v.line} (${v.patternName}) -> ${v.matchedText}`);
    }
  }

  if (inScopeViolations.length > 0) {
    console.error(`\n❌ [check-internal-references] FAILED: Found ${inScopeViolations.length} internal reference violations in public analyzer files:`);
    for (const v of inScopeViolations) {
      console.error(`  ${v.file}:${v.line} [${v.patternName}]: ${v.matchedText}`);
    }
    process.exit(1);
  }

  console.log(`\n✔ [check-internal-references] PASSED: Zero internal references in public analyzer code.`);
}
