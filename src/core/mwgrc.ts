import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface MwgConfig {
  allowOriginTrials?: boolean;
  allowVolatileFeatures?: boolean;
  /** Target Baseline threshold ('widely', 'newly', 'limited', or a 4-digit year like '2024'). */
  baseline?: string;
  [key: string]: unknown;
}

/**
 * Normalizes a user-provided Baseline target string into its canonical `.mwgrc` value
 * (`'widely'`, `'newly'`, `'limited'`, or `'YYYY'`), or returns `undefined` if unrecognized.
 */
export function normalizeBaselineTarget(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === 'widely' || trimmed === 'baseline widely available') return 'widely';
  if (trimmed === 'newly' || trimmed === 'baseline' || trimmed === 'baseline newly available') return 'newly';
  if (trimmed === 'limited' || trimmed === 'limited availability') return 'limited';
  const yearMatch = trimmed.match(/^(?:baseline\s+)?(\d{4})$/);
  if (yearMatch) return yearMatch[1];
  return undefined;
}

const CONFIG_FILENAME = '.mwgrc';

/**
 * Resolves the path to the `.mwgrc` configuration file.
 * Walks up from `startDir` and stops at the first directory containing `.mwgrc` or `.git`
 * (without merging ancestor configs), falling back to `~/.mwgrc` if one exists when invoked
 * outside any project (e.g. from `/tmp`), or `startDir/.mwgrc` otherwise.
 */
export function resolveMwgrcPath(startDir = process.cwd()): string {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, CONFIG_FILENAME)) || fs.existsSync(path.join(dir, '.git'))) {
      return path.join(dir, CONFIG_FILENAME);
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      const homeConfig = path.join(os.homedir(), CONFIG_FILENAME);
      if (fs.existsSync(homeConfig)) return homeConfig;
      return path.join(path.resolve(startDir), CONFIG_FILENAME);
    }
    dir = parent;
  }
}

function isNodeError(e: unknown): e is NodeJS.ErrnoException {
  return typeof e === 'object' && e !== null && 'code' in e;
}

export function readMwgrc(startDir = process.cwd()): MwgConfig {
  return readMwgrcFile(resolveMwgrcPath(startDir));
}

function readMwgrcFile(filePath: string): MwgConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e: unknown) {
    if (isNodeError(e) && e.code === 'ENOENT') return {};
    throw new Error(`Invalid ${CONFIG_FILENAME} at ${filePath}: ${(e as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid ${CONFIG_FILENAME} at ${filePath}: expected a JSON object`);
  }
  return parsed as MwgConfig;
}

export function writeMwgrc(patch: Partial<MwgConfig>, startDir = process.cwd()): string {
  const targetPath = resolveMwgrcPath(startDir);
  const existing = readMwgrcFile(targetPath);
  fs.writeFileSync(targetPath, JSON.stringify({ ...existing, ...patch }, null, 2) + '\n', 'utf8');
  return targetPath;
}
