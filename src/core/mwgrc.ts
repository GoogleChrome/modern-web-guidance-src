import fs from 'node:fs';
import path from 'node:path';

export interface MwgConfig {
  allowOriginTrials?: boolean;
  [key: string]: unknown;
}

const CONFIG_FILENAME = '.mwgrc';

/**
 * Resolves the path to the `.mwgrc` configuration file.
 * Walks up from `startDir` and stops at the first directory containing `.mwgrc` or `.git`
 * (without merging ancestor configs), falling back to `startDir/.mwgrc` outside git repos.
 */
export function resolveMwgrcPath(startDir = process.cwd()): string {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, CONFIG_FILENAME)) || fs.existsSync(path.join(dir, '.git'))) {
      return path.join(dir, CONFIG_FILENAME);
    }
    const parent = path.dirname(dir);
    if (parent === dir) return path.join(path.resolve(startDir), CONFIG_FILENAME);
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
