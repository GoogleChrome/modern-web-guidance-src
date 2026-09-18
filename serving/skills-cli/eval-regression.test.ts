import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = path.resolve(import.meta.dirname, "../.."); // modern-web-guidance-src/
const SERVING_DIR = path.join(ROOT_DIR, "serving");

const getLatestGitTag = (target = 'HEAD') => {
  const output = execSync(`git tag --merged ${target} -l "v*.*.*" --sort=-v:refname`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  if (!output) {
    throw new Error(`No tag matching v*.*.* found reachable from ${target}`);
  }
  return output.split('\n')[0].trim();
};

test('Eval Pass Rate Regression Check', async () => {
  const isDryRun = process.argv.includes('--dry-run');
  const target = isDryRun ? 'origin/main' : 'HEAD';
  let previousTag: string;
  try {
    previousTag = getLatestGitTag(target);
  } catch (err) {
    if (isDryRun) {
      previousTag = getLatestGitTag('HEAD');
    } else {
      throw err;
    }
  }

  let prevSummaryJson = '';
  try {
    prevSummaryJson = execSync(`git show ${previousTag}:serving/skills-cli/eval-results-summary.json`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch (err) {
    console.log(`Warning: Could not read eval-results-summary.json from tag ${previousTag}. Skipping regression check.`);
    return;
  }

  const currentSummaryPath = path.join(SERVING_DIR, 'skills-cli', 'eval-results-summary.json');
  const currentSummary = JSON.parse(await fs.readFile(currentSummaryPath, 'utf8'));
  const prevSummary = JSON.parse(prevSummaryJson);

  const agents = ['claude_code', 'codex_cli', 'antigravity'];

  function getLatestRunForAgent(summary: any[], agentName: string) {
    const runs = summary.filter((r: any) => r.agent === agentName);
    if (runs.length === 0) return null;
    runs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return runs[0];
  }

  for (const agent of agents) {
    const currLatest = getLatestRunForAgent(currentSummary, agent);
    const prevLatest = getLatestRunForAgent(prevSummary, agent);

    if (!currLatest || !prevLatest) {
      console.log(`  Skipping regression check for ${agent}: missing run data in current or previous summary.`);
      continue;
    }

    const currRate = currLatest.guidedPassRate;
    const prevRate = prevLatest.guidedPassRate;
    const drop = prevRate - currRate;

    console.log(`  - ${agent}: Previous guided pass rate = ${prevRate}%, Current = ${currRate}%`);

    if (drop > 5) {
      assert.fail(`Regression detected for ${agent}: guided pass rate dropped by ${drop}% (from ${prevRate}% to ${currRate}%, which exceeds the 5% threshold).`);
    }
  }
});
