import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { cBold, cCyan, cGreen, cRed, cYellow } from '../core/colors.ts';
import { collectResults } from './lib/collection.ts';
import { calculateMetrics } from './lib/metrics.ts';
import { generateMarkdownReport, generateJsonReport, saveReports } from './lib/reporting.ts';
import { suitesDir } from '../core/paths.ts';

import { defaultSuiteConfig, type SuiteConfig } from './config.ts';

function getCliVersion(): string | undefined {
  try {
    const output = execSync('git tag --merged HEAD -l "v*.*.*" --sort=-v:refname', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (output) {
      const firstTag = output.split('\n')[0].trim();
      return firstTag.startsWith('v') ? firstTag.slice(1) : firstTag;
    }
  } catch {
    // Ignore git error if tags are not reachable
  }
  return undefined;
}

function getSkillVersion(): string | undefined {
  try {
    const output = execSync('git log -1 --abbrev=8 --date=format:"%Y_%m_%d" --pretty=format:"%cd-%h" guides/modern-web-guidance/SKILL.md', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    return output || undefined;
  } catch {
    // Ignore git error if log is unavailable
  }
  return undefined;
}

function inferSuiteConfig(suiteResultsDir: string): SuiteConfig {
  let agent = defaultSuiteConfig.agent;

  const evalsPath = path.join(suiteResultsDir, 'evals.json');
  if (fs.existsSync(evalsPath)) {
    try {
      const oldEvals = JSON.parse(fs.readFileSync(evalsPath, 'utf8'));
      if (oldEvals.agent) agent = oldEvals.agent;
    } catch {
      // Ignore parse error
    }
  }

  return { agent, tasks: [], name: null, numRuns: 1, skillsToEnable: ['modern-web-guidance'] };
}

export async function evaluateSuite(suiteResultsDir: string, suiteName: string, suiteStartTime?: number) {
  console.log(cCyan(`Evaluating suite: ${suiteName}`));
  console.log(cCyan(`Results directory: ${suiteResultsDir}`));

  if (!fs.existsSync(suiteResultsDir)) {
    console.error(cRed(`Results directory not found at ${suiteResultsDir}!`));
    return;
  }

  const configPath = path.join(suiteResultsDir, 'suite_config.json');
  let suiteConfig: SuiteConfig | null = null;
  if (fs.existsSync(configPath)) {
    try {
      suiteConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      console.warn(cYellow(`⚠️ Failed to parse suite_config.json in ${suiteResultsDir}`));
    }
  }

  if (!suiteConfig) {
    console.warn(cYellow(`⚠️ No suite_config.json found in ${suiteResultsDir}. Inferring config...`));
    suiteConfig = inferSuiteConfig(suiteResultsDir);
    console.log(cCyan(`Inferred: agent=${suiteConfig.agent}`));
  }

  if (!suiteConfig) {
    console.error(cRed(`⚠️ Failed to infer suite config for ${suiteResultsDir}. Aborting evaluation.`));
    return;
  }

  try {
    const { allResults, numRuns, model, reasoningEffort, totalRuntime: fallbackRuntime } = await collectResults(suiteResultsDir, suiteConfig);
    console.log(cCyan(`Found ${numRuns} test run(s)`));

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

    const skillVersion = getSkillVersion();
    const cliVersion = getCliVersion();

    const totalRuntime = suiteStartTime ? Date.now() - suiteStartTime : fallbackRuntime;
    const jsonReport = generateJsonReport(metrics, allResults, timestamp, numRuns, suiteConfig.agent, model, totalRuntime, skillVersion, cliVersion, reasoningEffort);

    if (totalRuntime) {
      console.log(`Total runtime: ${totalRuntime}ms`);
    }

    saveReports(suiteResultsDir, mdReport, jsonReport);

    console.log(cBold(cGreen(`\nReport generated: ${path.resolve(path.join(suiteResultsDir, 'evals.md'))}`)));
    console.log(cBold(cGreen(`JSON Report generated: ${path.resolve(path.join(suiteResultsDir, 'evals.json'))}`)));
    console.log(cCyan(`Pass Rate - Unguided: ${metrics.summary.unguidedPassRate}%, Guided: ${metrics.summary.guidedPassRate}%`));

  } catch (error: any) {
    console.error(cRed(`Evaluation failed: ${error.message}`));
  }
}

export async function evaluate() {
  console.log(cBold(cCyan('Starting Evaluation...')));

  let suiteName = process.argv[2];

  if (!suiteName) {
    console.error(cRed('❌ No suite name provided!'));
    process.exit(1);
  }

  const suiteResultsDir = path.join(suitesDir, suiteName);
  await evaluateSuite(suiteResultsDir, suiteName);
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  evaluate().catch(console.error);
}
