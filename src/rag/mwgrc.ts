import fs from 'node:fs';
import path from 'node:path';

export interface MwgConfig {
  allowOriginTrials?: boolean;
  [key: string]: unknown;
}

const CONFIG_FILENAME = '.mwgrc';

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

export function readMwgrc(startDir = process.cwd()): MwgConfig {
  try {
    return JSON.parse(fs.readFileSync(resolveMwgrcPath(startDir), 'utf8'));
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw e;
  }
}

export function writeMwgrc(patch: Partial<MwgConfig>, startDir = process.cwd()): string {
  const targetPath = resolveMwgrcPath(startDir);
  const existing = readMwgrc(startDir);
  fs.writeFileSync(targetPath, JSON.stringify({ ...existing, ...patch }, null, 2) + '\n', 'utf8');
  return targetPath;
}
