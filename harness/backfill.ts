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

async function backfillSuite(suiteResultsDir: string, suiteName: string) {
  await evaluateSuite(suiteResultsDir, suiteName);
}

async function main() {
  console.log('Starting Backfill of all results...'.cyan.bold);

  let mainResultsDir = resultsDir;
  
  // Allow passing a custom results directory as an argument!
  if (process.argv[2]) {
    mainResultsDir = path.resolve(process.argv[2]);
  }

  if (!fs.existsSync(mainResultsDir)) {
    console.error(`Results directory not found at ${mainResultsDir}!`.red);
    process.exit(1);
  }

  const entries = fs.readdirSync(mainResultsDir, { withFileTypes: true });
  const suiteDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  console.log(`Found ${suiteDirs.length} potential suites in ${mainResultsDir}.`.cyan);

  for (const suiteName of suiteDirs) {
    const suiteResultsDir = path.join(mainResultsDir, suiteName);
    await backfillSuite(suiteResultsDir, suiteName);
  }

  console.log('Backfill completed!'.cyan.bold);
}

main().catch(console.error);
