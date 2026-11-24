import { execFile } from 'node:child_process';
import { constants as fsConstants, type Dirent } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
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
const GIT_SYMLINK_MODE = '120000';

/**
 * Returns `true` when normalized `candidatePath` sits at or inside normalized `rootPath`.
 */
export function isPathWithinRoot(candidatePath: string, rootPath: string): boolean {
  const prefix = rootPath.endsWith(sep) ? rootPath : `${rootPath}${sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(prefix);
}

function setEmptyScanStats(stats: RepoScanStats | undefined): void {
  if (!stats) return;
  stats.skippedDocsAndTestsCount = 0;
  stats.scannedFileCount = 0;
  stats.eligibleFileCount = 0;
  stats.truncatedByMaxFiles = false;
}

interface ReadCandidateResult {
  readonly kind: 'source' | 'vendored';
  readonly content: string;
}

function isParentWithinRoot(
  parentDir: string,
  realRepoRoot: string,
  parentCache: Map<string, Promise<boolean>>,
): Promise<boolean> {
  if (parentDir === realRepoRoot) {
    return Promise.resolve(true);
  }
  const cached = parentCache.get(parentDir);
  if (cached) {
    return cached;
  }
  const pending = realpath(parentDir)
    .then((realParent) => isPathWithinRoot(realParent, realRepoRoot))
    .catch(() => false);
  parentCache.set(parentDir, pending);
  return pending;
}

async function tryReadFileContent(
  realRepoRoot: string,
  relPath: string,
  session: ScanSession,
  parentCache: Map<string, Promise<boolean>>,
): Promise<ReadCandidateResult | undefined> {
  const fullPath = resolve(realRepoRoot, relPath);
  if (!isPathWithinRoot(fullPath, realRepoRoot)) {
    return undefined;
  }
  try {
    if (!(await isParentWithinRoot(dirname(fullPath), realRepoRoot, parentCache))) {
      return undefined;
    }
    const entryStat = await lstat(fullPath);
    if (entryStat.isSymbolicLink() || !entryStat.isFile()) {
      return undefined;
    }
    const handle = await open(fullPath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
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
    // Missing/deleted file (ENOENT), symlink (ELOOP), unreadable, or binary file
    return undefined;
  }
}

async function collectDirectoryPaths(
  realRoot: string,
  filterOpts: FileFilterOptions | undefined,
  currentDir = realRoot,
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
    if (entry.isSymbolicLink()) {
      continue;
    }

    const fullPath = join(currentDir, entry.name);
    const relPath = relative(realRoot, fullPath).replace(/\\/g, '/');

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
      await collectDirectoryPaths(realRoot, filterOpts, fullPath, outPaths);
      continue;
    }

    if (entry.isFile()) {
      outPaths.push(relPath);
    }
  }

  return outPaths;
}

function parseCachedGitFiles(stdout: string): string[] {
  const paths: string[] = [];
  for (const record of stdout.split('\0')) {
    if (!record) continue;
    const tabIdx = record.indexOf('\t');
    const spaceIdx = record.indexOf(' ');
    if (tabIdx === -1 || spaceIdx === -1 || spaceIdx > tabIdx) continue;
    if (record.slice(0, spaceIdx) === GIT_SYMLINK_MODE) continue;
    const filePath = record.slice(tabIdx + 1);
    if (filePath) {
      paths.push(filePath);
    }
  }
  return paths;
}

async function tryEnumerateGitFiles(realRepoRoot: string): Promise<string[] | null> {
  const execOpts = {
    cwd: realRepoRoot,
    maxBuffer: 50 * 1024 * 1024,
    timeout: 10_000,
  } as const;

  let cachedStdout: string;
  let othersStdout: string;
  try {
    const [cachedRes, othersRes] = await Promise.all([
      execFileAsync('git', ['ls-files', '-z', '-s', '--cached'], execOpts),
      execFileAsync('git', ['ls-files', '-z', '--others', '--exclude-standard'], execOpts),
    ]);
    cachedStdout = cachedRes.stdout;
    othersStdout = othersRes.stdout;
  } catch {
    return null;
  }

  if (!cachedStdout && !othersStdout) {
    return null;
  }

  const cachedPaths = parseCachedGitFiles(cachedStdout);
  const untrackedPaths = othersStdout.split('\0').filter(Boolean);
  return Array.from(new Set([...cachedPaths, ...untrackedPaths]));
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
    setEmptyScanStats(options?.stats);
    return [];
  }

  const resolvedRepoDir = resolve(repoDirPath);
  let realRepoRoot: string;
  try {
    realRepoRoot = await realpath(resolvedRepoDir);
  } catch {
    setEmptyScanStats(options?.stats);
    return [];
  }

  const rawPaths =
    (await tryEnumerateGitFiles(realRepoRoot)) ??
    (await collectDirectoryPaths(realRepoRoot, session.filterOpts));

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
  const parentCache = new Map<string, Promise<boolean>>();
  const findings: ScanFinding[] = [];
  let scannedFileCount = 0;
  let idx = 0;

  while (idx < candidates.length && scannedFileCount < maxFiles) {
    const batchLimit = Math.min(FILE_READ_CONCURRENCY, maxFiles - scannedFileCount);
    const batch = candidates.slice(idx, idx + batchLimit);
    idx += batch.length;

    const reads = await Promise.all(
      batch.map((relPath) => tryReadFileContent(realRepoRoot, relPath, session, parentCache)),
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
