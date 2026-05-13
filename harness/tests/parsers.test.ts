import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Agents } from '../config.ts';
import { extractTokenUsageFromResults, extractModelFromResults } from '../lib/collection.ts';
import { collectGeminiToolsFromTrajectory, collectGeminiGuidesFromTrajectory } from '../agents/gemini-cli-agent.ts';
import { collectClaudeToolsFromTrajectory, collectClaudeGuidesFromTrajectory } from '../agents/claude-code-agent.ts';
import { collectCodexToolsFromTrajectory, collectCodexGuidesFromTrajectory } from '../agents/codex-cli-agent.ts';

function getMostRecentFiles(baseDir: string, pattern: string, count = 5): string[] {
  if (!fs.existsSync(baseDir)) return [];
  try {
    const files = fs.globSync(pattern, { cwd: baseDir });
    return files
      .map(f => {
        try {
          return { path: f, mtime: fs.statSync(path.join(baseDir, f)).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.mtime - a!.mtime)
      .slice(0, count)
      .map(x => path.join(baseDir, x!.path));
  } catch {
    return [];
  }
}

function setupTempSessionDir(srcFiles: string[]): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-test-'));
  for (let i = 0; i < srcFiles.length; i++) {
    const src = srcFiles[i];
    const ext = path.extname(src);
    // Prepend session- so our agent parsers recognize it
    const dest = path.join(tempDir, `session-mock-${i}${ext}`);
    fs.copyFileSync(src, dest);
  }
  return tempDir;
}

function cleanupTempDir(dir: string) {
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

test('Gemini CLI real trajectory parsing sanity check', async (t) => {
  const baseDir = path.join(os.homedir(), '.gemini', 'tmp');
  const recentFiles = getMostRecentFiles(baseDir, '*/chats/*.{json,jsonl}');

  if (recentFiles.length === 0) {
    t.skip('No recent Gemini CLI trajectories found in ~/.gemini/tmp');
    return;
  }

  const tempDir = setupTempSessionDir(recentFiles);
  try {
    const usage = extractTokenUsageFromResults(tempDir, Agents.GEMINI_CLI);
    if (usage) {
      assert.ok(usage.total > 0, `Total tokens should be non-zero (got ${usage.total})`);
      assert.ok(usage.cached <= usage.total, 'Cached tokens cannot exceed total');
      assert.ok(usage.cached >= 0, 'Cached tokens should be non-negative');
    }

    const model = extractModelFromResults(tempDir, Agents.GEMINI_CLI);
    assert.ok(typeof model === 'string', 'Model extracted as string');

    assert.doesNotThrow(() => collectGeminiToolsFromTrajectory(tempDir));
    await assert.doesNotReject(async () => collectGeminiGuidesFromTrajectory(tempDir, 'mcp'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Claude Code real trajectory parsing sanity check', async (t) => {
  const baseDir = path.join(os.homedir(), '.claude', 'projects');
  const recentFiles = getMostRecentFiles(baseDir, '**/*.jsonl');

  if (recentFiles.length === 0) {
    t.skip('No recent Claude Code trajectories found in ~/.claude/projects');
    return;
  }

  const tempDir = setupTempSessionDir(recentFiles);
  try {
    const usage = extractTokenUsageFromResults(tempDir, Agents.CLAUDE_CODE);
    if (usage) {
      assert.ok(usage.total > 0, `Total tokens should be non-zero (got ${usage.total})`);
      assert.ok(usage.cached <= usage.total, 'Cached tokens cannot exceed total');
      assert.ok(usage.cached >= 0, 'Cached tokens should be non-negative');
    }

    const model = extractModelFromResults(tempDir, Agents.CLAUDE_CODE);
    assert.ok(typeof model === 'string', 'Model extracted as string');

    assert.doesNotThrow(() => collectClaudeToolsFromTrajectory(tempDir));
    await assert.doesNotReject(async () => collectClaudeGuidesFromTrajectory(tempDir, 'mcp'));
  } finally {
    cleanupTempDir(tempDir);
  }
});

test('Codex CLI real trajectory parsing sanity check', async (t) => {
  const baseDir = path.join(os.homedir(), '.codex', 'sessions');
  const recentFiles = getMostRecentFiles(baseDir, '**/*.jsonl');

  if (recentFiles.length === 0) {
    t.skip('No recent Codex CLI trajectories found in ~/.codex/sessions');
    return;
  }

  const tempDir = setupTempSessionDir(recentFiles);
  try {
    const usage = extractTokenUsageFromResults(tempDir, Agents.CODEX_CLI);
    if (usage) {
      assert.ok(usage.total > 0, `Total tokens should be non-zero (got ${usage.total})`);
      assert.ok(usage.cached <= usage.total, 'Cached tokens cannot exceed total');
      assert.ok(usage.cached >= 0, 'Cached tokens should be non-negative');
    }

    const model = extractModelFromResults(tempDir, Agents.CODEX_CLI);
    assert.ok(typeof model === 'string', 'Model extracted as string');

    assert.doesNotThrow(() => collectCodexToolsFromTrajectory(tempDir));
    await assert.doesNotReject(async () => collectCodexGuidesFromTrajectory(tempDir, 'skills_cli'));
  } finally {
    cleanupTempDir(tempDir);
  }
});
