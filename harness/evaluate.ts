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

  // Read manifest to find the latest test
  const resultsDirBase = path.join(__dirname, 'results');
  const manifestPath = path.join(resultsDirBase, 'tests.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('Manifest file not found at results/tests.json!'.red);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    console.error('Failed to parse manifest!'.red);
    return;
  }

  if (!manifest.tests || manifest.tests.length === 0) {
    console.error('No tests found in manifest!'.red);
    return;
  }

  let testID;
  if (config.eval.suiteName) {
    testID = config.eval.suiteName;
  } else {
    // Get the latest test if no specific test ID is provided
    const latestTest = manifest.tests[manifest.tests.length - 1];
    testID = latestTest.id;
  }
  const resultsDir = path.join(resultsDirBase, testID);

  console.log(`Evaluating test: ${testID}`.cyan);
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
    const jsonReport = generateJsonReport(metrics, allResults);

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
