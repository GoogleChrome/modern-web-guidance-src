import { execFile } from 'node:child_process';
import type { Dirent } from 'node:fs';
import { open, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { ScanFinding, ScanRule } from '../schema.ts';
import {
  BUILD_OR_INSTALL_DIR_SEGMENTS,
  CORPUS_NON_APP_DIR_SEGMENTS,
  MAX_SOURCE_FILE_BYTES,
  type FileFilterOptions,
} from './file-filter.ts';
import { isPackageJsonPath } from './format-registry.ts';
import {
  classifyFile,
  createScanSession,
  scanLoadedFile,
  type ScanOptions,
  type ScanSession,
} from './index.ts';

export const DEFAULT_MAX_FILES = 5000;
const FILE_READ_CONCURRENCY = 64;

export interface RepoScanStats {
  skippedDocsAndTestsCount?: number;
  scannedFileCount?: number;
  eligibleFileCount?: number;
  truncatedByMaxFiles?: boolean;
}

export interface RepoScanOptions extends ScanOptions {
  readonly maxFiles?: number;
}

/**
 * Resolves a programmatic `maxFiles` option (`undefined` -> `DEFAULT_MAX_FILES`,
 * `0` or `Infinity` -> unlimited / `Infinity`), throwing on invalid finite values.
 */
export function resolveMaxFiles(maxFiles?: number): number {
  if (maxFiles === undefined) {
    return DEFAULT_MAX_FILES;
  }
  if (maxFiles === 0 || maxFiles === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY;
  }
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 0) {
    throw new RangeError(
      `Invalid maxFiles value (${String(maxFiles)}): expected a non-negative safe integer (0 or Infinity for unlimited).`,
    );
  }
  return maxFiles;
}

const execFileAsync = promisify(execFile);

interface ReadCandidateResult {
  readonly kind: 'source' | 'vendored';
  readonly content: string;
}

async function tryReadFileContent(
  fullPath: string,
  relPath: string,
  session: ScanSession,
): Promise<ReadCandidateResult | undefined> {
  try {
    const handle = await open(fullPath, 'r');
    try {
      const fileStat = await handle.stat();
      if (!fileStat.isFile() || fileStat.size > MAX_SOURCE_FILE_BYTES) {
        return undefined;
      }
      const content = await handle.readFile('utf8');
      const disposition = classifyFile(relPath, content, session);
      if (disposition === 'source' || disposition === 'vendored') {
        return { kind: disposition, content };
      }
      return undefined;
    } finally {
      await handle.close();
    }
  } catch {
    // Missing/deleted file (ENOENT), unreadable, or binary file
    return undefined;
  }
}

async function collectDirectoryPaths(
  resolvedRoot: string,
  filterOpts: FileFilterOptions | undefined,
  currentDir = resolvedRoot,
  outPaths: string[] = [],
): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return outPaths;
  }

  entries.sort((entryA, entryB) => entryA.name.localeCompare(entryB.name));

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    const relPath = relative(resolvedRoot, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      const dirLower = entry.name.toLowerCase();
      if (
        (dirLower !== '.' && dirLower !== '..' && dirLower.startsWith('.')) ||
        BUILD_OR_INSTALL_DIR_SEGMENTS.has(dirLower) ||
        filterOpts?.customIgnoredDirs?.has(dirLower) ||
        (filterOpts?.excludeCorpusNonAppDirs &&
          CORPUS_NON_APP_DIR_SEGMENTS.has(dirLower))
      ) {
        continue;
      }
      await collectDirectoryPaths(resolvedRoot, filterOpts, fullPath, outPaths);
      continue;
    }

    if (entry.isFile()) {
      outPaths.push(relPath);
    }
  }

  return outPaths;
}

async function tryEnumerateGitFiles(resolvedRepoDir: string): Promise<string[] | null> {
  let stdout: string;
  try {
    const res = await execFileAsync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      {
        cwd: resolvedRepoDir,
        maxBuffer: 50 * 1024 * 1024,
        timeout: 10_000,
      },
    );
    stdout = res.stdout;
  } catch {
    return null;
  }

  const rawPaths = stdout.split('\0').filter(Boolean);
  return rawPaths.length > 0 ? rawPaths : null;
}

/**
 * Traverses a repository directory on disk and scans all eligible files against ScanRules.
 */
export async function scanRepoFiles(
  repoDirPath: string,
  rules: readonly ScanRule[],
  options?: RepoScanOptions,
): Promise<ScanFinding[]> {
  const maxFiles = resolveMaxFiles(options?.maxFiles);
  const session = createScanSession(rules, options);

  if (session.activeEngines.size === 0) {
    if (options?.stats) {
      options.stats.skippedDocsAndTestsCount = 0;
      options.stats.scannedFileCount = 0;
      options.stats.eligibleFileCount = 0;
      options.stats.truncatedByMaxFiles = false;
    }
    return [];
  }

  const resolvedRepoDir = resolve(repoDirPath);
  const rawPaths =
    (await tryEnumerateGitFiles(resolvedRepoDir)) ??
    (await collectDirectoryPaths(resolvedRepoDir, session.filterOpts));

  const pkgCandidates: string[] = [];
  const otherCandidates: string[] = [];
  let skippedDocsAndTestsCount = 0;

  for (const rawPath of rawPaths) {
    if (!rawPath) continue;
    const relPath = rawPath.replace(/\\/g, '/');
    const disposition = classifyFile(relPath, undefined, session);
    if (disposition === 'skipped-docs-tests') {
      skippedDocsAndTestsCount++;
    } else if (disposition !== 'skip') {
      if (isPackageJsonPath(relPath)) {
        pkgCandidates.push(relPath);
      } else {
        otherCandidates.push(relPath);
      }
    }
  }

  const candidates = [...pkgCandidates, ...otherCandidates];
  const findings: ScanFinding[] = [];
  let scannedFileCount = 0;
  let idx = 0;

  while (idx < candidates.length && scannedFileCount < maxFiles) {
    const batchLimit = Math.min(FILE_READ_CONCURRENCY, maxFiles - scannedFileCount);
    const batch = candidates.slice(idx, idx + batchLimit);
    idx += batch.length;

    const reads = await Promise.all(
      batch.map((relPath) =>
        tryReadFileContent(join(resolvedRepoDir, relPath), relPath, session),
      ),
    );
    for (let i = 0; i < batch.length; i++) {
      const relPath = batch[i];
      const read = reads[i];
      if (relPath !== undefined && read !== undefined) {
        scannedFileCount++;
        findings.push(...scanLoadedFile(session, relPath, read.content, read.kind));
      }
    }
  }

  const remainingCandidateCount = candidates.length - idx;
  if (options?.stats) {
    options.stats.skippedDocsAndTestsCount = skippedDocsAndTestsCount;
    options.stats.scannedFileCount = scannedFileCount;
    options.stats.eligibleFileCount = scannedFileCount + remainingCandidateCount;
    options.stats.truncatedByMaxFiles = remainingCandidateCount > 0;
  }

  return findings;
}
