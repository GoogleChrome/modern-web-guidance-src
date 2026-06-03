import fs from 'fs';
import path from 'path';
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

function collectResults() {
  console.log(`Scanning results in: ${resultsDir}`);
  if (!fs.existsSync(resultsDir)) {
    console.error(`Results directory does not exist: ${resultsDir}`);
    return;
  }

  const items = fs.readdirSync(resultsDir, { withFileTypes: true });
  const summaries: EvalsSummary[] = [];

  for (const item of items) {
    if (!item.isDirectory()) continue;
    if (!item.name.startsWith('nightly-') && !item.name.startsWith('weekly-')) continue;

    const suiteDir = path.join(resultsDir, item.name);
    const evalsPath = path.join(suiteDir, 'evals.json');

    if (!fs.existsSync(evalsPath)) {
      console.warn(`Missing evals.json in ${item.name}`);
      continue;
    }

    try {
      const content = fs.readFileSync(evalsPath, 'utf8');
      const data = JSON.parse(content);

      let agent = data.agent || 'unknown';
      if (agent.startsWith('jetski')) {
        agent = 'antigravity';
        item.name = item.name.replace('jetski_cli', 'agy');
      }

      if (!isAgentAllowed(agent)) {
        console.log(`Skipping ${item.name} (agent ${agent} not in allowlist)`);
        continue;
      }

      const summary = data.summary;
      if (!summary) {
        console.warn(`Missing summary in ${item.name}/evals.json`);
        continue;
      }

      const taskCount = summary.taskCount || 0;
      if (taskCount < 60) {
        console.log(`Skipping ${item.name} (taskCount ${taskCount} < 60)`);
        continue;
      }
      // broken run.
      if (summary.unguidedPassRate == 0 || summary.guidedPassRate == 0 || summary.guidedTotal < 500) {
        console.log(`Skipping ${item.name} (broken run probably)`);
        continue;
      }

      // Extract serving info, default to skills_cli if not specified
      let serving = data.serving || 'unknown';
      if (data.serving === undefined && data.enableSkills !== undefined) {
        serving = data.enableSkills ? 'skills_cli' : 'mcp';
      }

      summaries.push({
        testId: item.name,
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
      console.error(`Error reading/parsing ${item.name}/evals.json:`, e);
    }
  }

  // Sort by timestamp descending
  summaries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  console.log(`Collected ${summaries.length} nightly/weekly runs.`);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summaries, null, 2));
  console.log(`Saved summary to ${OUTPUT_PATH}`);
}

collectResults();
