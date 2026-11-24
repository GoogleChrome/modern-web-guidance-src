import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import 'colors';
import { collectResults } from './lib/collection.ts';
import { calculateMetrics } from './lib/metrics.ts';
import { generateMarkdownReport, generateJsonReport, saveReports } from './lib/reporting.ts';
import { suitesDir } from '../core/paths.ts';

import { defaultJobConfig, type JobConfig } from './config.ts';

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

function inferJobConfig(jobResultsDir: string): JobConfig {
  let agent = defaultJobConfig.agent;

  const evalsPath = path.join(jobResultsDir, 'evals.json');
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

export async function evaluateJob(jobResultsDir: string, jobId: string, jobStartTime?: number) {
  console.log(`Evaluating job: ${jobId}`.cyan);
  console.log(`Results directory: ${jobResultsDir}`.cyan);

  if (!fs.existsSync(jobResultsDir)) {
    console.error(`Results directory not found at ${jobResultsDir}!`.red);
    return;
  }

  const configPath = path.join(jobResultsDir, 'suite_config.json');
  let jobConfig: JobConfig | null = null;
  if (fs.existsSync(configPath)) {
    try {
      jobConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      console.warn(`⚠️ Failed to parse suite_config.json in ${jobResultsDir}`.yellow);
    }
  }

  if (!jobConfig) {
    console.warn(`⚠️ No suite_config.json found in ${jobResultsDir}. Inferring config...`.yellow);
    jobConfig = inferJobConfig(jobResultsDir);
    console.log(`Inferred: agent=${jobConfig.agent}`.cyan);
  }

  if (!jobConfig) {
    console.error(`⚠️ Failed to infer job config for ${jobResultsDir}. Aborting evaluation.`.red);
    return;
  }

  try {
    const { allResults, trialsPerCondition, model, reasoningEffort, totalRuntime: fallbackRuntime } = await collectResults(jobResultsDir, jobConfig);
    console.log(`Found ${trialsPerCondition} trial repetition(s)`.cyan);

    const metrics = calculateMetrics(allResults, trialsPerCondition);
    const mdReport = generateMarkdownReport(metrics, allResults);
    
    let timestamp = new Date().toISOString();
    const evalsPath = path.join(jobResultsDir, 'evals.json');
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

    const totalRuntime = jobStartTime ? Date.now() - jobStartTime : fallbackRuntime;
    const jsonReport = generateJsonReport(metrics, allResults, timestamp, trialsPerCondition, jobConfig.agent, model, totalRuntime, skillVersion, cliVersion, reasoningEffort);

    if (totalRuntime) {
      console.log(`Total runtime: ${totalRuntime}ms`);
    }

    saveReports(jobResultsDir, mdReport, jsonReport);

    console.log(`\nReport generated: ${path.resolve(path.join(jobResultsDir, 'evals.md'))}`.green.bold);
    console.log(`JSON Report generated: ${path.resolve(path.join(jobResultsDir, 'evals.json'))}`.green.bold);
    console.log(`Pass Rate - Unguided: ${metrics.summary.unguidedPassRate}%, Guided: ${metrics.summary.guidedPassRate}%`.cyan);

  } catch (error: any) {
    console.error(`Evaluation failed: ${error.message}`.red);
  }
}

export async function evaluate() {
  console.log('Starting Evaluation...'.cyan.bold);

  let jobId = process.argv[2];

  if (!jobId) {
    console.error('❌ No job ID provided!'.red);
    process.exit(1);
  }

  const jobResultsDir = path.join(suitesDir, jobId);
  await evaluateJob(jobResultsDir, jobId);
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  evaluate().catch(console.error);
}
