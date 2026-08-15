import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  generateNormalizedTrajectory,
  collectCodexGuidesFromTrajectory,
  collectCodexToolsFromTrajectory,
  extractCodexCliModel,
  extractCodexCliTokenUsage
} from '../lib/trajectory-normalizer.ts';
import { Agents, Serving } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codex-parsing-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('Codex CLI normalization with commentary, response items, and subagent inlining', async () => {
  const tempDir = createTempDir();
  try {
    // 1. Primary Codex session with commentary phase thoughts, response_item tool calls & outputs, and final_answer
    const mainLines = [
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-08-09T20:30:00.000Z',
        payload: {
          type: 'agent_message',
          phase: 'commentary',
          message: 'Inspecting existing html structure'
        }
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-08-09T20:30:01.000Z',
        payload: {
          type: 'function_call',
          call_id: 'call_codex_1',
          name: 'exec_command',
          arguments: JSON.stringify({ cmd: 'cat index.html' })
        }
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-08-09T20:30:02.000Z',
        payload: {
          type: 'function_call_output',
          call_id: 'call_codex_1',
          output: '<html><body>Hello</body></html>\nProcess exited with code 0'
        }
      }),
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-08-09T20:30:10.000Z',
        payload: {
          type: 'agent_message',
          phase: 'final_answer',
          message: 'Updated index.html with new structure'
        }
      })
    ];

    // 2. Subagent session log for Codex
    const subagentLines = [
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-08-09T20:30:04.000Z',
        payload: {
          type: 'agent_message',
          phase: 'commentary',
          message: 'Subagent running tests'
        }
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-08-09T20:30:05.000Z',
        payload: {
          type: 'function_call',
          call_id: 'call_codex_sub_1',
          name: 'exec_command',
          arguments: JSON.stringify({ cmd: 'npm test' })
        }
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-08-09T20:30:06.000Z',
        payload: {
          type: 'function_call_output',
          call_id: 'call_codex_sub_1',
          output: 'All tests passed\nProcess exited with code 0'
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-codex-main.jsonl'), mainLines.join('\n'));
    fs.writeFileSync(path.join(tempDir, 'subagent-agent-worker-cdx.jsonl'), subagentLines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CODEX_CLI, 'Inspect and test');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath), 'trajectory_summary.json should be created');

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.agent, Agents.CODEX_CLI);
    assert.strictEqual(summary.initialPrompt, 'Inspect and test');
    assert.ok(summary.subagents, 'subagents metadata should be populated');
    assert.ok(summary.subagents['worker-cdx'], 'worker-cdx should be in subagents metadata');
    assert.strictEqual(summary.subagents['worker-cdx'].totalSteps, 1);

    // Total steps: 1 (main cat) + 1 (subagent test) + 1 (main final answer) = 3 steps
    assert.strictEqual(summary.steps.length, 3);

    // Step 1: main cat index.html (20:30:01)
    assert.strictEqual(summary.steps[0].stepNumber, 1);
    assert.strictEqual(summary.steps[0].timestamp, '2026-08-09T20:30:01.000Z');
    assert.strictEqual(summary.steps[0].thought, 'Inspecting existing html structure');
    assert.strictEqual(summary.steps[0].action?.name, 'cat index.html');
    assert.strictEqual(summary.steps[0].action?.type, 'run_command');
    assert.strictEqual(summary.steps[0].outcome?.status, 'success');

    // Step 2: subagent npm test (20:30:05)
    assert.strictEqual(summary.steps[1].stepNumber, 2);
    assert.strictEqual(summary.steps[1].timestamp, '2026-08-09T20:30:05.000Z');
    assert.strictEqual(summary.steps[1].subagentId, 'worker-cdx');
    assert.strictEqual(summary.steps[1].thought, 'Subagent running tests');
    assert.strictEqual(summary.steps[1].action?.name, 'npm test');
    assert.strictEqual(summary.steps[1].action?.type, 'run_command');
    assert.strictEqual(summary.steps[1].outcome?.status, 'success');

    // Step 3: main final_answer (20:30:10)
    assert.strictEqual(summary.steps[2].stepNumber, 3);
    assert.strictEqual(summary.steps[2].timestamp, '2026-08-09T20:30:10.000Z');
    assert.strictEqual(summary.steps[2].action?.name, 'respond_to_user');
    assert.strictEqual(summary.steps[2].action?.type, 'other');
    assert.strictEqual(summary.steps[2].outcome?.status, 'success');

  } finally {
    removeTempDir(tempDir);
  }
});

test('collectCodex metrics and token extraction from trajectory files', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        type: 'turn_context',
        payload: { model: 'gpt-4o' }
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'exec_command',
          arguments: JSON.stringify({ cmd: 'npx modern-web-guidance retrieve declarative-dialog' })
        }
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'function_call',
          name: 'exec_command',
          arguments: JSON.stringify({ cmd: 'cat /path/.agents/skills/modern-web-guidance/SKILL.md' })
        }
      }),
      JSON.stringify({
        type: 'token_count',
        info: {
          total_token_usage: {
            total_tokens: 650,
            cached_input_tokens: 250
          }
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-101.jsonl'), lines.join('\n'));

    const guides = await collectCodexGuidesFromTrajectory(tempDir, Serving.SKILLS_CLI);
    assert.deepStrictEqual(guides.retrievedGuides, ['declarative-dialog']);

    const tools = collectCodexToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);

    const model = extractCodexCliModel(tempDir);
    assert.strictEqual(model, 'gpt-4o');

    const tokens = extractCodexCliTokenUsage(tempDir);
    assert.deepStrictEqual(tokens, { total: 650, cached: 250 });
  } finally {
    removeTempDir(tempDir);
  }
});
