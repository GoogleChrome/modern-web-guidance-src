import path from 'path';
import fs from 'fs';
import 'colors';
import { collectResults } from './lib/collection.ts';
import { calculateMetrics } from './lib/metrics.ts';
import { generateMarkdownReport, generateJsonReport, saveReports } from './lib/reporting.ts';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { config } from './config.ts';

async function main() {
  console.log('Starting Evaluation...'.cyan.bold);

  const resultsDirBase = path.join(__dirname, 'results');
  let suiteName = process.argv[2] || config.suite.name;
  if (!suiteName) {
    console.error('❌ No suite name provided! Please specify a suite to evaluate.'.red);
    process.exit(1);
  }
  const resultsDir = path.join(resultsDirBase, suiteName);

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
    const jsonReport = generateJsonReport(metrics, allResults, timestamp, numRuns, config.suite.agent, config.suite.enableSkills);

    saveReports(resultsDir, mdReport, jsonReport);

    console.log(`
Report generated: ${path.resolve(path.join(resultsDir, 'evals.md'))}`.green.bold);
    console.log(`JSON Report generated: ${path.resolve(path.join(resultsDir, 'evals.json'))}`.green.bold);
    console.log(`Pass Rate - Unguided: ${metrics.summary.unguidedPassRate}%, Guided: ${metrics.summary.guidedPassRate}%`.cyan);

  } catch (error: any) {
    console.error(`Evaluation failed: ${error.message}`.red);
  }
}

main().catch(console.error);
