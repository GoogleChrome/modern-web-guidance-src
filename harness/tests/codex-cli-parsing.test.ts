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
import { extractCommandsFromCodexItem } from '../agents/codex-cli-agent.ts';
import { Agents, Serving } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codex-parsing-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('extractCommandsFromCodexItem handles quotes, backticks, escapes, and parentheses', () => {
  // 1. JSON object in function_call
  const cmd1 = extractCommandsFromCodexItem({
    type: 'function_call',
    arguments: JSON.stringify({ cmd: 'echo "hello"' })
  });
  assert.deepStrictEqual(cmd1, ['echo "hello"']);

  // 2. Custom tool call with double quotes, escapes, and parentheses (e.g. subshell)
  const cmd2 = extractCommandsFromCodexItem({
    type: 'custom_tool_call',
    input: 'const r = await tools.exec_command({"cmd":"echo $(which node) && (true || false)"}); text(r.output);'
  });
  assert.deepStrictEqual(cmd2, ['echo $(which node) && (true || false)']);

  // 3. Custom tool call with single quotes
  const cmd3 = extractCommandsFromCodexItem({
    payload: {
      type: 'custom_tool_call',
      input: "const r = await tools.exec_command({cmd: 'cat index.html && find . ( -name \\'*.ts\\' )'});"
    }
  });
  assert.deepStrictEqual(cmd3, ["cat index.html && find . ( -name '*.ts' )"]);

  // 4. Custom tool call with backticks
  const cmd4 = extractCommandsFromCodexItem({
    payload: {
      type: 'custom_tool_call',
      input: 'const r = await tools.exec_command({cmd: `ls -la`});'
    }
  });
  assert.deepStrictEqual(cmd4, ['ls -la']);
});

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

test('Codex CLI normalization with modern custom_tool_call exec_command', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-08-17T18:50:00.000Z',
        payload: {
          type: 'agent_message',
          phase: 'commentary',
          message: 'Retrieving guideline'
        }
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-08-17T18:50:01.000Z',
        payload: {
          type: 'custom_tool_call',
          call_id: 'call_custom_1',
          name: 'exec',
          input: 'const r = await tools.exec_command({"cmd":"npx -y modern-web-guidance@latest retrieve \\"dialog-focus-management\\""}); text(r.output);'
        }
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-08-17T18:50:02.000Z',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'call_custom_1',
          output: 'Retrieved guide dialog-focus-management'
        }
      }),
      JSON.stringify({
        type: 'turn_context',
        payload: { model: 'gpt-5.6-sol' }
      }),
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: {
              total_tokens: 1200,
              cached_input_tokens: 300
            }
          }
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-custom.jsonl'), lines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CODEX_CLI, 'Add focus management');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath));

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.agent, Agents.CODEX_CLI);
    assert.strictEqual(summary.model, 'gpt-5.6-sol');
    assert.deepStrictEqual(summary.tokenUsage, { total: 1200, cached: 300 });
    assert.deepStrictEqual(summary.retrievedGuides, ['dialog-focus-management']);
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].action?.type, 'run_command');
    assert.strictEqual(summary.steps[0].action?.canonicalCategory, 'guide_retrieval');
    assert.strictEqual(summary.steps[0].outcome?.status, 'success');
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectCodex metrics from legacy function_call trajectory file', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({ cmd: "sed -n '1,220p' /tmp/env/.agents/skills/modern-web-guidance/SKILL.md" })
      }),
      JSON.stringify({
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({ cmd: 'npx -y modern-web-guidance@latest retrieve "visually-texture-content,complex-shapes"' })
      }),
      JSON.stringify({
        type: 'function_call',
        name: 'exec_command',
        arguments: JSON.stringify({ cmd: 'cat /tmp/env/.agents/skills/css/size-aware-styling/guide.md' })
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-123.jsonl'), lines.join('\n'));

    const guides = await collectCodexGuidesFromTrajectory(tempDir, Serving.SKILLS_CLI);
    assert.deepStrictEqual(guides.retrievedGuides, ['visually-texture-content', 'complex-shapes']);
    assert.deepStrictEqual(guides.fileReadGuides, []);

    const skillGuides = await collectCodexGuidesFromTrajectory(tempDir, Serving.SKILLS);
    assert.deepStrictEqual(skillGuides.fileReadGuides, ['size-aware-styling']);

    const tools = collectCodexToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectCodex metrics from modern custom_tool_call trajectory file', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          input: 'const r = await tools.exec_command({"cmd":"sed -n \'1,240p\' /tmp/test/.agents/skills/modern-web-guidance/SKILL.md","workdir":"/tmp/test"}); text(r.output);'
        }
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          input: 'const r = await tools.exec_command({"cmd":"npx -y modern-web-guidance@latest retrieve \\"validate-input-after-interaction,accessible-error-announcement\\"","workdir":"/tmp/test"}); text(r.output);'
        }
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          name: 'exec',
          input: 'const r = await tools.exec_command({"cmd":"cat /tmp/test/.agents/skills/forms/validate-input-after-interaction/guide.md"}); text(r.output);'
        }
      }),
      JSON.stringify({
        type: 'turn_context',
        payload: {
          model: 'gpt-5.6-sol'
        }
      }),
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: {
              total_tokens: 1500,
              cached_input_tokens: 400
            }
          }
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-456.jsonl'), lines.join('\n'));

    const guides = await collectCodexGuidesFromTrajectory(tempDir, Serving.SKILLS_CLI);
    assert.deepStrictEqual(guides.retrievedGuides, ['validate-input-after-interaction', 'accessible-error-announcement']);

    const skillGuides = await collectCodexGuidesFromTrajectory(tempDir, Serving.SKILLS);
    assert.deepStrictEqual(skillGuides.fileReadGuides, ['validate-input-after-interaction']);

    const tools = collectCodexToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);

    const model = extractCodexCliModel(tempDir);
    assert.strictEqual(model, 'gpt-5.6-sol');

    const tokenUsage = extractCodexCliTokenUsage(tempDir);
    assert.deepStrictEqual(tokenUsage, { total: 1500, cached: 400 });
  } finally {
    removeTempDir(tempDir);
  }
});
