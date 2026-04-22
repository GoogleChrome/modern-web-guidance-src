/**
 * @file backfill.ts
 * @description Backfills evaluation metrics for all suites in a results directory.
 * 
 * Rationale:
 * When reporting logic changes (e.g., adding split guide metrics or handling new directory structures),
 * we need to re-evaluate historical test runs to update their `evals.json` and `evals.md` reports.
 * This script iterates over all suite directories in the results folder and delegates to `evaluateSuite`
 * to re-process results, running grading only if missing, and updating the summary files.
 * 
 * Usage:
 * node harness/backfill.ts [custom_results_dir]
 * 
 * If no argument is provided, it defaults to the project's standard results directory.
 */

import path from 'path';
import fs from 'fs';
import 'colors';
import { evaluateSuite } from './evaluate.ts';
import { resultsDir } from '../lib/paths.ts';

export function resolveResultsDir(argv: string[], defaultDir: string): string {
  const arg = argv[2];
  if (arg === 'backfill') {
    const customDir = argv[3];
    if (customDir) return path.resolve(customDir);
  } else if (arg) {
    return path.resolve(arg);
  }
  return defaultDir;
}

async function backfillSuite(suiteResultsDir: string, suiteName: string) {
  await evaluateSuite(suiteResultsDir, suiteName);
}

export async function runBackfill() {
  console.log('Starting Backfill of all results...'.cyan.bold);
  console.log('process.argv:', process.argv);

  let mainResultsDir = resultsDir;
  
  mainResultsDir = resolveResultsDir(process.argv, resultsDir);

  if (!fs.existsSync(mainResultsDir)) {
    console.error(`Results directory not found at ${mainResultsDir}!`.red);
    process.exit(1);
  }

  const entries = fs.readdirSync(mainResultsDir, { withFileTypes: true });
  // Check if this is a single suite folder (contains numbered run directories)
  const hasRunDirs = entries.some(e => e.isDirectory() && /^\d+$/.test(e.name));

  if (hasRunDirs) {
    const suiteName = path.basename(mainResultsDir);
    console.log(`Detected single suite folder. Backfilling ${suiteName}...`.cyan);
    await backfillSuite(mainResultsDir, suiteName);
  } else {
    const suiteDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    console.log(`Found ${suiteDirs.length} potential suites in ${mainResultsDir}.`.cyan);

    for (const suiteName of suiteDirs) {
      const suiteResultsDir = path.join(mainResultsDir, suiteName);
      await backfillSuite(suiteResultsDir, suiteName);
    }
  }

  console.log('Backfill completed!'.cyan.bold);
}

import { fileURLToPath } from 'url';

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  runBackfill().catch(console.error);
}
