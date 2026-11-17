import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { rootDir } from '../core/paths.ts';

const ALLOWED_AGENTS = new Set(['claude_code', 'codex_cli', 'antigravity_cli']);
const OUTPUT_PATH = path.join(rootDir, 'src/build/eval-results-summary.json');

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

export function fetchPublicEvalsManifest(remoteUrl?: string): PublicSuiteManifestEntry[] {
  const url =
    remoteUrl ??
    execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

  // Fetch into an isolated temp repo so --depth=1 and --filter=blob:none do not
  // mark the main checkout shallow or persist partialclonefilter on origin.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mwg-public-evals-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: tempDir, stdio: ['pipe', 'pipe', 'pipe'] });
    execFileSync('git', ['remote', 'add', 'origin', url], { cwd: tempDir, stdio: ['pipe', 'pipe', 'pipe'] });
    execFileSync(
      'git',
      ['fetch', '--quiet', '--no-tags', '--depth=1', '--filter=blob:none', 'origin', 'refs/heads/gh-pages'],
      { cwd: tempDir, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const rawManifest = execFileSync(
      'git',
      ['show', 'FETCH_HEAD:public-evals/suites.gen.json'],
      { cwd: tempDir, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const parsed = JSON.parse(rawManifest);
    if (!Array.isArray(parsed)) {
      throw new Error('public-evals/suites.gen.json is not a JSON array');
    }
    return parsed as PublicSuiteManifestEntry[];
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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

if (import.meta.main) {
  collectResults();
}
