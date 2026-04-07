import path from 'path';
import fs from 'fs';
import 'colors';
import { collectResults, extractModelFromResults } from './lib/collection.ts';
import { calculateMetrics } from './lib/metrics.ts';
import { generateMarkdownReport, generateJsonReport, saveReports } from './lib/reporting.ts';
import { resultsDir } from '../lib/paths.ts';
import { Serving, type SuiteConfig } from './config.ts';

async function backfillSuite(suiteResultsDir: string, suiteName: string) {
  console.log(`Backfilling suite: ${suiteName}`.cyan);

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

    suiteConfig = { agent, serving, tasks: [], name: null, numRuns: 1, mcpServersToEnable: [] };
    console.log(`Inferred: agent=${agent}, serving=${serving}`.cyan);
  }

  if (!suiteConfig) {
    console.error(`Failed to infer suite config`.red);
    return;
  }

  try {
    // Pass skipGrading=true to avoid re-running Playwright graders!
    const { allResults, numRuns } = await collectResults(suiteResultsDir, suiteConfig, true);
    console.log(`Found ${numRuns} test run(s)`.cyan);

    const metrics = calculateMetrics(allResults, numRuns);
    const mdReport = generateMarkdownReport(metrics, allResults);
    const timestamp = new Date().toISOString();
    const model = extractModelFromResults(suiteResultsDir, suiteConfig.agent);
    const jsonReport = generateJsonReport(metrics, allResults, timestamp, numRuns, suiteConfig.agent, suiteConfig.serving, model);

    saveReports(suiteResultsDir, mdReport, jsonReport);
    console.log(`Successfully backfilled ${suiteName}`.green);

  } catch (error: any) {
    console.error(`Backfill failed for ${suiteName}: ${error.message}`.red);
  }
}

async function main() {
  console.log('Starting Backfill of all results...'.cyan.bold);

  let mainResultsDir = '/Users/paulirish/code/guidance/harness/results';
  
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
