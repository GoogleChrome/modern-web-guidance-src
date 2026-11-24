import type { ScanFinding, ScanRule } from '../schema.ts';
import {
  classifyAndTallyFile,
  createScanSession,
  createStatsAccumulator,
  scanLoadedFile,
  type ScanOptions,
} from './scan-session.ts';

export * from './ast-helpers.ts';
export * from './context-slicer.ts';
export * from './css-scanner.ts';
export * from './dependency-scanner.ts';
export * from './dom-scanner.ts';
export * from './file-filter.ts';
export * from './js-scanner.ts';
export * from './sfc-extractor.ts';
export {
  DEFAULT_MAX_FILES,
  resolveMaxFiles,
  scanRepoFiles,
  type RepoScanOptions,
} from './repo-scanner.ts';
export {
  CARD_ID_HEX_LENGTH,
  computeCardId,
  computeGuideHash,
  type RepoScanStats,
  type ScanOptions,
} from './scan-session.ts';

/**
 * Scans an in-memory map of files (relPath -> content) against a suite of ScanRules.
 */
export function scanFiles(
  files: ReadonlyMap<string, string>,
  rules: readonly ScanRule[],
  options?: ScanOptions,
): ScanFinding[] {
  const session = createScanSession(rules, options);
  const acc = createStatsAccumulator();
  if (session.activeEngines.size === 0) {
    acc.finalize(options?.stats);
    return [];
  }

  const findings: ScanFinding[] = [];
  for (const [relPath, content] of files) {
    const disposition = classifyAndTallyFile(relPath, content, session, acc);
    if (disposition === 'skip') {
      continue;
    }
    const hadParseError = scanLoadedFile(session, relPath, content, disposition, findings);
    acc.recordScannedFile(hadParseError);
  }

  acc.finalize(options?.stats);
  return findings;
}
