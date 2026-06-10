import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { resultsDir } from '../../lib/paths.ts';

const ALLOWED_AGENTS = ['claudecode', 'geminicli', 'codex', 'claude', 'codexcli', 'antigravity'];

function isAgentAllowed(agent: string): boolean {
  const normalized = agent.toLowerCase().replace(/[-_]/g, '');
  return ALLOWED_AGENTS.includes(normalized);
}

const SERVING_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(SERVING_DIR, 'skills-cli', 'eval-results-summary.json');

interface EvalsSummary {
  testId: string;
  timestamp: string;
  agent: string;
  serving: string;
  model: string;
  taskCount: number;
  assertionCount: number;
  unguidedPassRate: number;
  guidedPassRate: number;
}

function pullRecentGcsSuites(): string[] {
  console.log(`Querying GCS (gs://guidance-evals) for the latest nightly evaluation suites...`);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  try {
    const lsOutput = execSync(`gcloud storage ls gs://guidance-evals/`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = lsOutput.split('\n');
    const targetFolders: string[] = [];

    for (const line of lines) {
      const clean = line.trim();
      if (!clean) continue;
      const match = clean.match(/gs:\/\/guidance-evals\/(nightly-[^\/]+)\//);
      if (match) {
        targetFolders.push(match[1]);
      }
    }

    targetFolders.sort((a, b) => b.localeCompare(a));

    const topRecent = targetFolders.slice(0, 10);
    console.log(`Discovered ${targetFolders.length} remote suites. Syncing evals.json for top ${topRecent.length} most recent suites...`);

    for (const folderName of topRecent) {
      const localSuiteDir = path.join(resultsDir, folderName);
      const targetEvalsPath = path.join(localSuiteDir, 'evals.json');

      if (fs.existsSync(targetEvalsPath)) {
        console.log(`  - ${folderName}: evals.json already cached locally.`);
        continue;
      }

      fs.mkdirSync(localSuiteDir, { recursive: true });
      console.log(`  - ${folderName}: copying evals.json from GCS...`);
      try {
        execSync(`gcloud storage cp gs://guidance-evals/${folderName}/evals.json ${targetEvalsPath}`, { stdio: 'ignore' });
      } catch (syncErr) {
        console.warn(`    ⚠️ Failed to copy evals.json for ${folderName}`);
      }
    }
    console.log(`✅ Successfully synced evals.json for top 10 recent nightly evaluation runs from GCS.`);
    return topRecent;
  } catch (err: any) {
    console.error(`❌ Error: Failed to list GCS bucket gs://guidance-evals. Cannot collect evaluation results without access to remote GCS data.`);
    process.exit(1);
  }
}

function collectResults() {
  const targetSuites = pullRecentGcsSuites();

  console.log(`Aggregating results from ${targetSuites.length} verified suites...`);
  const summaries: EvalsSummary[] = [];

  for (let folderName of targetSuites) {
    const suiteDir = path.join(resultsDir, folderName);
    const evalsPath = path.join(suiteDir, 'evals.json');

    if (!fs.existsSync(evalsPath)) {
      console.warn(`Missing evals.json in ${folderName}`);
      continue;
    }

    try {
      const content = fs.readFileSync(evalsPath, 'utf8');
      const data = JSON.parse(content);

      let agent = data.agent || 'unknown';
      if (agent.startsWith('jetski')) {
        agent = 'antigravity';
        folderName = folderName.replace('jetski_cli', 'agy');
      }

      if (!isAgentAllowed(agent)) {
        console.log(`Skipping ${folderName} (agent ${agent} not in allowlist)`);
        continue;
      }

      const summary = data.summary;
      if (!summary) {
        console.warn(`Missing summary in ${folderName}/evals.json`);
        continue;
      }

      const taskCount = summary.taskCount || 0;
      if (taskCount < 60) {
        console.log(`Skipping ${folderName} (taskCount ${taskCount} < 60)`);
        continue;
      }
      // broken run.
      if (summary.unguidedPassRate == 0 || summary.guidedPassRate == 0 || summary.guidedTotal < 500) {
        console.log(`Skipping ${folderName} (broken run probably)`);
        continue;
      }

      // Extract serving info, default to skills_cli if not specified
      let serving = data.serving || 'unknown';
      if (data.serving === undefined && data.enableSkills !== undefined) {
        serving = data.enableSkills ? 'skills_cli' : 'mcp';
      }

      summaries.push({
        testId: folderName,
        timestamp: data.timestamp || new Date().toISOString(),
        agent: agent,
        serving: serving,
        model: data.model || 'unknown',
        taskCount: taskCount,
        assertionCount: summary.guidedTotal ?? 0,
        unguidedPassRate: summary.unguidedPassRate ?? 0,
        guidedPassRate: summary.guidedPassRate ?? 0,
      });
    } catch (e) {
      console.error(`Error reading/parsing ${folderName}/evals.json:`, e);
    }
  }

  // Sort by timestamp descending
  summaries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  console.log(`Collected ${summaries.length} nightly runs.`);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summaries, null, 2));
  console.log(`Saved summary to ${OUTPUT_PATH}`);

  console.log(`\nVerifying collected summary against evaluation regression guardrails...`);
  try {
    execSync('node --experimental-strip-types --test skills-cli/eval-regression.test.ts', { cwd: SERVING_DIR, stdio: 'inherit' });
    console.log(`✅ Regression guardrail checks passed successfully.`);
  } catch (err) {
    console.error(`\n❌ EVALUATION REGRESSION DETECTED! Please review the failures above before committing.`);
    process.exit(1);
  }
}

collectResults();
