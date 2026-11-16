import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rootDir } from '../core/paths.ts';

const ALLOWED_AGENTS = new Set(['claude_code', 'codex_cli', 'antigravity_cli']);
const OUTPUT_PATH = path.join(rootDir, 'src/build/eval-results-summary.json');
const PUBLIC_EVALS_REF = 'refs/remotes/origin/gh-pages';

export interface EvalsSummary {
  testId: string;
  timestamp: string;
  agent: string;
  model: string;
  taskCount: number;
  assertionCount: number;
  unguidedPassRate: number;
  guidedPassRate: number;
}

export interface PublicSuiteManifestEntry {
  testId?: string;
  timestamp?: string;
  agent?: string;
  model?: string;
  taskCount?: number;
  guidedStats?: { passed?: number; total?: number };
  unguidedStats?: { passed?: number; total?: number };
}

export function collectSummariesFromPublicEvals(
  manifest: PublicSuiteManifestEntry[],
  limit = 10,
): EvalsSummary[] {
  const summaries: EvalsSummary[] = [];

  for (const entry of manifest) {
    const testId = typeof entry?.testId === 'string' ? entry.testId.trim() : '';
    if (!/^nightly-[^/]+$/.test(testId)) continue;

    const agent = entry.agent ?? '';
    if (!ALLOWED_AGENTS.has(agent)) continue;

    const taskCount = entry.taskCount ?? 0;
    const guidedTotal = entry.guidedStats?.total ?? 0;
    const unguidedTotal = entry.unguidedStats?.total ?? 0;
    if (taskCount < 60 || guidedTotal < 500 || unguidedTotal === 0) continue;

    const guidedPassRate = Math.round(((entry.guidedStats?.passed ?? 0) / guidedTotal) * 100);
    const unguidedPassRate = Math.round(((entry.unguidedStats?.passed ?? 0) / unguidedTotal) * 100);
    if (guidedPassRate === 0 || unguidedPassRate === 0) continue;

    const timestamp = entry.timestamp ?? '';
    if (!timestamp || Number.isNaN(Date.parse(timestamp))) continue;

    summaries.push({
      testId,
      timestamp,
      agent,
      model: entry.model || 'unknown',
      taskCount,
      assertionCount: guidedTotal,
      unguidedPassRate,
      guidedPassRate,
    });
  }

  summaries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return summaries.slice(0, limit);
}

function fetchPublicEvalsManifest(): PublicSuiteManifestEntry[] {
  execFileSync(
    'git',
    ['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/gh-pages:${PUBLIC_EVALS_REF}`],
    { cwd: rootDir, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const rawManifest = execFileSync(
    'git',
    ['show', `${PUBLIC_EVALS_REF}:public-evals/suites.gen.json`],
    { cwd: rootDir, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const parsed = JSON.parse(rawManifest);
  if (!Array.isArray(parsed)) {
    throw new Error('public-evals/suites.gen.json is not a JSON array');
  }
  return parsed as PublicSuiteManifestEntry[];
}

export function collectResults() {
  let manifest: PublicSuiteManifestEntry[];
  try {
    manifest = fetchPublicEvalsManifest();
  } catch (err) {
    console.error(
      'Failed to read public-evals/suites.gen.json from origin/gh-pages:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }

  const summaries = collectSummariesFromPublicEvals(manifest);
  if (summaries.length === 0) {
    console.error('No valid nightly evaluation runs found in public-evals/suites.gen.json.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summaries, null, 2) + '\n');
  console.log(`Saved ${summaries.length} nightly eval summaries to ${OUTPUT_PATH}`);

  try {
    execFileSync(process.execPath, ['--test', 'src/build/eval-regression.test.ts'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } catch {
    console.error('Evaluation regression detected.');
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  collectResults();
}
