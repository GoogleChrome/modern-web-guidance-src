import fs from 'fs';
import path from 'path';
import { rootDir } from './paths.ts';

// Temporary post-restructure cleanup: remove stale nested workspace node_modules,
// legacy generated build/cache artifacts, and empty legacy top-level directories
// left behind after pulling the restructure.
const STALE_PATHS_TO_DELETE = [
  'guides/node_modules',
  'serving/node_modules',
  'harness/node_modules',
  'eval-view/node_modules',
  'serving/build',
  'serving/vector_store',
  'serving/lib/use-cases.gen.ts',
  'serving/lib/use-cases.vectors.gen.json',
  'serving/lib/use-cases.vectors.gen.json.gz',
  'serving/benchmarks/data/eval-queries.gen.json',
  'eval-view/features_mapping.gen.js',
  'eval-view/grouped-tasks.gen.json',
  'eval-view/suites.gen.json',
  'dist/.cache',
  'grade-report',
];

const LEGACY_EMPTY_DIRS = [
  'serving/benchmarks/data',
  'serving/benchmarks',
  'serving/lib',
  'serving',
  'guides/lib',
  'harness',
  'eval-view',
  'lib',
  'scripts',
];

for (const relPath of STALE_PATHS_TO_DELETE) {
  fs.rmSync(path.join(rootDir, relPath), { recursive: true, force: true });
}

for (const dir of LEGACY_EMPTY_DIRS) {
  try {
    fs.rmdirSync(path.join(rootDir, dir));
  } catch {
    // Ignore if directory does not exist or is non-empty
  }
}
