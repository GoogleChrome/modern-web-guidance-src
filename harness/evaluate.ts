import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'colors';
import { collectResults, extractModelFromResults } from './lib/collection.ts';
import { calculateMetrics } from './lib/metrics.ts';
import { generateMarkdownReport, generateJsonReport, saveReports } from './lib/reporting.ts';
import { rootDir } from '../lib/root.ts';

import { config } from './config.ts';

export async function evaluateSuite(resultsDir: string, suiteName: string) {
  console.log(`Evaluating suite: ${suiteName}`.cyan);
  console.log(`Results directory: ${resultsDir}`.cyan);

  if (!fs.existsSync(resultsDir)) {
    console.error(`Results directory not found at ${resultsDir}!`.red);
    return;
  }

  try {
    const { allResults, numRuns } = await collectResults(resultsDir);
    console.log(`Found ${numRuns} test run(s)`.cyan);

    const metrics = calculateMetrics(allResults, numRuns);
    const mdReport = generateMarkdownReport(metrics, allResults);
    const timestamp = new Date().toISOString();
    const model = extractModelFromResults(resultsDir, config.suite.agent);
    const jsonReport = generateJsonReport(metrics, allResults, timestamp, numRuns, config.suite.agent, config.suite.serving, model);

    saveReports(resultsDir, mdReport, jsonReport);

    console.log(`\nReport generated: ${path.resolve(path.join(resultsDir, 'evals.md'))}`.green.bold);
    console.log(`JSON Report generated: ${path.resolve(path.join(resultsDir, 'evals.json'))}`.green.bold);
    console.log(`Pass Rate - Unguided: ${metrics.summary.unguidedPassRate}%, Guided: ${metrics.summary.guidedPassRate}%`.cyan);

  } catch (error: any) {
    console.error(`Evaluation failed: ${error.message}`.red);
  }
}

export async function evaluate() {
  console.log('Starting Evaluation...'.cyan.bold);

  const resultsDirBase = path.join(rootDir, 'harness', 'results');
  let suiteName = process.argv[2] || config.suite?.name;

  if (!suiteName) {
    console.error('❌ No suite name provided and no previous tests found!'.red);
    process.exit(1);
  }

  const resultsDir = path.join(resultsDirBase, suiteName);
  await evaluateSuite(resultsDir, suiteName);
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  evaluate().catch(console.error);
}
