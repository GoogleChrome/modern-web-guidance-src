import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'colors';
import { collectResults, extractModelFromResults } from './lib/collection.ts';
import { calculateMetrics } from './lib/metrics.ts';
import { generateMarkdownReport, generateJsonReport, saveReports } from './lib/reporting.ts';
import { resultsDir } from '../lib/paths.ts';

import type { SuiteConfig } from './config.ts';

export async function evaluateSuite(suiteResultsDir: string, suiteName: string) {
  console.log(`Evaluating suite: ${suiteName}`.cyan);
  console.log(`Results directory: ${suiteResultsDir}`.cyan);

  if (!fs.existsSync(suiteResultsDir)) {
    console.error(`Results directory not found at ${suiteResultsDir}!`.red);
    return;
  }

  const configPath = path.join(suiteResultsDir, 'suite_config.json');
  let suiteConfig: SuiteConfig | null = null;
  if (fs.existsSync(configPath)) {
    try {
      suiteConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      console.warn(`⚠️ Failed to parse suite_config.json in ${suiteResultsDir}`.yellow);
    }
  }

  if (!suiteConfig) {
    console.error(`⚠️ No suite_config.json found or failed to parse in ${suiteResultsDir}. Aborting evaluation.`.red);
    return;
  }

  try {
    const { allResults, numRuns } = await collectResults(suiteResultsDir, suiteConfig);
    console.log(`Found ${numRuns} test run(s)`.cyan);

    const metrics = calculateMetrics(allResults, numRuns);
    const mdReport = generateMarkdownReport(metrics, allResults);
    const timestamp = new Date().toISOString();
    const model = extractModelFromResults(suiteResultsDir, suiteConfig.agent);
    const jsonReport = generateJsonReport(metrics, allResults, timestamp, numRuns, suiteConfig.agent, suiteConfig.serving, model);

    saveReports(suiteResultsDir, mdReport, jsonReport);

    console.log(`\nReport generated: ${path.resolve(path.join(suiteResultsDir, 'evals.md'))}`.green.bold);
    console.log(`JSON Report generated: ${path.resolve(path.join(suiteResultsDir, 'evals.json'))}`.green.bold);
    console.log(`Pass Rate - Unguided: ${metrics.summary.unguidedPassRate}%, Guided: ${metrics.summary.guidedPassRate}%`.cyan);

  } catch (error: any) {
    console.error(`Evaluation failed: ${error.message}`.red);
  }
}

export async function evaluate() {
  console.log('Starting Evaluation...'.cyan.bold);

  let suiteName = process.argv[2];

  if (!suiteName) {
    console.error('❌ No suite name provided!'.red);
    process.exit(1);
  }

  const suiteResultsDir = path.join(resultsDir, suiteName);
  await evaluateSuite(suiteResultsDir, suiteName);
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  evaluate().catch(console.error);
}
