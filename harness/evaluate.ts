import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'colors';
import { collectResults, extractModelFromResults } from './lib/collection.ts';
import { calculateMetrics } from './lib/metrics.ts';
import { generateMarkdownReport, generateJsonReport, saveReports } from './lib/reporting.ts';
import { resultsDir } from '../lib/paths.ts';

import { Serving, type SuiteConfig } from './config.ts';

function inferSuiteConfig(suiteResultsDir: string): SuiteConfig {
  let agent = 'gemini-cli';
  let serving: Serving = 'mcp';

  const evalsPath = path.join(suiteResultsDir, 'evals.json');
  if (fs.existsSync(evalsPath)) {
    try {
      const oldEvals = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
      if (oldEvals.agent) agent = oldEvals.agent;
      if (oldEvals.serving) serving = oldEvals.serving;
      else if (oldEvals.enableSkills !== undefined) {
        serving = oldEvals.enableSkills ? 'skills' : 'mcp';
      }
    } catch {
      // Ignore parse error
    }
  }

  return { agent, serving, tasks: [], name: null, numRuns: 1, mcpServersToEnable: [], skillsToEnable: ['modern-web-guidance'] };
}

export async function evaluateSuite(suiteResultsDir: string, suiteName: string, suiteStartTime?: number) {
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
    console.warn(`⚠️ No suite_config.json found in ${suiteResultsDir}. Inferring config...`.yellow);
    suiteConfig = inferSuiteConfig(suiteResultsDir);
    console.log(`Inferred: agent=${suiteConfig.agent}, serving=${suiteConfig.serving}`.cyan);
  }

  if (!suiteConfig) {
    console.error(`⚠️ Failed to infer suite config for ${suiteResultsDir}. Aborting evaluation.`.red);
    return;
  }

  try {
    const { allResults, numRuns, totalRuntime: fallbackRuntime } = await collectResults(suiteResultsDir, suiteConfig);
    console.log(`Found ${numRuns} test run(s)`.cyan);

    const metrics = calculateMetrics(allResults, numRuns);
    const mdReport = generateMarkdownReport(metrics, allResults);
    
    let timestamp = new Date().toISOString();
    const evalsPath = path.join(suiteResultsDir, 'evals.json');
    if (fs.existsSync(evalsPath)) {
      try {
        const oldEvals = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
        if (oldEvals.timestamp) timestamp = oldEvals.timestamp;
      } catch {
        // Ignore
      }
    }

    const model = extractModelFromResults(suiteResultsDir, suiteConfig.agent);
    const totalRuntime = suiteStartTime ? Date.now() - suiteStartTime : fallbackRuntime;
    const jsonReport = generateJsonReport(metrics, allResults, timestamp, numRuns, suiteConfig.agent, suiteConfig.serving, model, totalRuntime);

    if (totalRuntime) {
      console.log(`Total runtime: ${totalRuntime}ms`);
    }

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
