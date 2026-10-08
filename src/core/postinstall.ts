import fs from 'fs';
import path from 'path';
import { rootDir } from './paths.ts';

// Temporary post-restructure cleanup: remove stale nested workspace node_modules
// and empty legacy top-level directories left behind after pulling the restructure.
const STALE_NODE_MODULES = ['guides', 'serving', 'harness', 'eval-view'];
const LEGACY_EMPTY_DIRS = ['guides/lib', 'serving', 'harness', 'eval-view', 'lib', 'scripts'];

for (const dir of STALE_NODE_MODULES) {
  fs.rmSync(path.join(rootDir, dir, 'node_modules'), { recursive: true, force: true });
}

for (const dir of LEGACY_EMPTY_DIRS) {
  try {
    fs.rmdirSync(path.join(rootDir, dir));
  } catch {
    // Ignore if directory does not exist or is non-empty
  }
}
