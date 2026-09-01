import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  generateNormalizedTrajectory,
  collectClaudeGuidesFromTrajectory,
  collectClaudeToolsFromTrajectory,
  extractClaudeCodeModel,
  extractClaudeCodeTokenUsage
} from '../lib/trajectory-normalizer.ts';
import { Agents } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'claude-parsing-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('Claude Code normalization with timestamps and thinking block extraction', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        role: 'user',
        timestamp: '2026-08-09T20:00:00.000Z',
        message: { content: 'Fix it' }
      }),
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T20:00:01.000Z',
        message: {
          content: [
            {
              type: 'thinking',
              thinking: 'I need to read the file'
            },
            {
              type: 'tool_use',
              id: 'call_1',
              name: 'Read',
              input: { file_path: 'app.js' }
            }
          ]
        }
      }),
      JSON.stringify({
        role: 'user',
        timestamp: '2026-08-09T20:00:02.000Z',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call_1',
              content: 'file content'
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-123.jsonl'), lines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CLAUDE_CODE, 'Fix it');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath));

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.agent, Agents.CLAUDE_CODE);
    assert.strictEqual(summary.initialPrompt, 'Fix it');
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].stepNumber, 1);
    assert.strictEqual(summary.steps[0].timestamp, '2026-08-09T20:00:01.000Z');
    assert.strictEqual(summary.steps[0].thought, 'I need to read the file');
    assert.strictEqual(summary.steps[0].action?.type, 'read_file');
    assert.strictEqual(summary.steps[0].action?.name, 'Read');
    assert.strictEqual(summary.steps[0].action?.params?.file_path, 'app.js');
    assert.strictEqual(summary.steps[0].outcome?.status, 'success');

  } finally {
    removeTempDir(tempDir);
  }
});

test('Claude Code subagents inlining and metadata', async () => {
  const tempDir = createTempDir();
  try {
    // 1. Main session that dispatches a subagent via Task tool
    const mainLines = [
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T20:00:00.000Z',
        message: {
          content: [
            {
              type: 'thinking',
              thinking: 'Dispatching worker subagent'
            },
            {
              type: 'tool_use',
              id: 'task_call_1',
              name: 'Task',
              input: { prompt: 'Edit index.html' }
            }
          ]
        }
      }),
      JSON.stringify({
        role: 'user',
        timestamp: '2026-08-09T20:00:05.000Z',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'task_call_1',
              content: 'Worker finished. agentId: worker-sub-1'
            }
          ]
        }
      })
    ];

    // 2. Subagent session log with file modifications and thought
    const subagentLines = [
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T20:00:02.000Z',
        message: {
          content: [
            {
              type: 'thinking',
              thinking: 'Subagent editing index.html'
            },
            {
              type: 'tool_use',
              id: 'edit_call_1',
              name: 'write_file',
              input: { file_path: 'index.html', content: '<h1>Hello</h1>' }
            }
          ]
        }
      }),
      JSON.stringify({
        role: 'user',
        timestamp: '2026-08-09T20:00:03.000Z',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'edit_call_1',
              content: 'File updated successfully'
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-main.jsonl'), mainLines.join('\n'));
    fs.writeFileSync(path.join(tempDir, 'subagent-subagents-agent-worker-sub-1.jsonl'), subagentLines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CLAUDE_CODE, 'Build page');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath));

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.agent, Agents.CLAUDE_CODE);
    assert.ok(summary.subagents, 'subagents metadata should be populated');
    assert.ok(summary.subagents['worker-sub-1'], 'worker-sub-1 should be in subagents metadata');
    assert.strictEqual(summary.subagents['worker-sub-1'].totalSteps, 1);

    // Total steps: 1 (main dispatch) + 1 (subagent edit) = 2 steps
    assert.strictEqual(summary.steps.length, 2);

    // Verify monotonic sorting: Step 1 is main dispatch (20:00:00), Step 2 is subagent edit (20:00:02)
    assert.strictEqual(summary.steps[0].stepNumber, 1);
    assert.strictEqual(summary.steps[0].timestamp, '2026-08-09T20:00:00.000Z');
    assert.strictEqual(summary.steps[0].action?.name, 'Task');

    assert.strictEqual(summary.steps[1].stepNumber, 2);
    assert.strictEqual(summary.steps[1].timestamp, '2026-08-09T20:00:02.000Z');
    assert.strictEqual(summary.steps[1].subagentId, 'worker-sub-1');
    assert.strictEqual(summary.steps[1].action?.type, 'write_file');
    assert.strictEqual(summary.steps[1].action?.name, 'write_file');
    assert.strictEqual(summary.steps[1].action?.canonicalCategory, 'code_mutation');
    assert.strictEqual(summary.steps[1].outcome?.status, 'success');

  } finally {
    removeTempDir(tempDir);
  }
});

test('Claude Code subagent agentId extraction from array or object content', async () => {
  const tempDir = createTempDir();
  try {
    // Main session where tool_result has content as an array with text block containing agentId
    const mainLines = [
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T20:00:00.000Z',
        message: {
          content: [
            {
              type: 'thinking',
              thinking: 'Dispatching worker subagent via array tool_result'
            },
            {
              type: 'tool_use',
              id: 'task_call_arr',
              name: 'Task',
              input: { prompt: 'Add responsive navigation' }
            }
          ]
        }
      }),
      JSON.stringify({
        role: 'user',
        timestamp: '2026-08-09T20:00:05.000Z',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'task_call_arr',
              content: [
                {
                  type: 'text',
                  text: 'Subagent completed task. agentId: subagent-array-456'
                }
              ]
            }
          ]
        }
      })
    ];

    // Subagent session log
    const subagentLines = [
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T20:00:02.000Z',
        message: {
          content: [
            {
              type: 'thinking',
              thinking: 'Subagent writing nav.css'
            },
            {
              type: 'tool_use',
              id: 'edit_call_sub',
              name: 'write_file',
              input: { file_path: 'nav.css', content: 'nav { display: flex; }' }
            }
          ]
        }
      }),
      JSON.stringify({
        role: 'user',
        timestamp: '2026-08-09T20:00:03.000Z',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'edit_call_sub',
              content: 'Saved nav.css'
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-main.jsonl'), mainLines.join('\n'));
    fs.writeFileSync(path.join(tempDir, 'subagent-subagents-agent-subagent-array-456.jsonl'), subagentLines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CLAUDE_CODE, 'Build navigation');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath));

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.agent, Agents.CLAUDE_CODE);
    assert.ok(summary.subagents, 'subagents metadata should be populated');
    assert.ok(summary.subagents['subagent-array-456'], 'subagent-array-456 should be present in subagents metadata');
    assert.strictEqual(summary.subagents['subagent-array-456'].totalSteps, 1);

    // Total steps: 1 (main dispatch) + 1 (subagent write) = 2 steps
    assert.strictEqual(summary.steps.length, 2);
    assert.strictEqual(summary.steps[0].action?.name, 'Task');
    assert.strictEqual(summary.steps[1].subagentId, 'subagent-array-456');
    assert.strictEqual(summary.steps[1].action?.name, 'write_file');
    assert.strictEqual(summary.steps[1].action?.type, 'write_file');
    assert.strictEqual(summary.steps[1].outcome?.status, 'success');

  } finally {
    removeTempDir(tempDir);
  }
});

test('Claude Code monotonic timestamp sorting across multiple subagents', async () => {
  const tempDir = createTempDir();
  try {
    const mainLines = [
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T21:00:10.000Z',
        message: {
          content: [
            { type: 'thinking', thinking: 'Parent wrap up' },
            { type: 'text', text: 'All tasks completed' }
          ]
        }
      })
    ];

    const sub1Lines = [
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T21:00:01.000Z',
        message: {
          content: [
            { type: 'tool_use', id: 's1', name: 'search_use_cases', input: { query: 'tabs' } }
          ]
        }
      })
    ];

    const sub2Lines = [
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T21:00:05.000Z',
        message: {
          content: [
            { type: 'tool_use', id: 's2', name: 'replace_file_content', input: { TargetFile: 'tab.js' } }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-main.jsonl'), mainLines.join('\n'));
    fs.writeFileSync(path.join(tempDir, 'subagent-agent-sub1.jsonl'), sub1Lines.join('\n'));
    fs.writeFileSync(path.join(tempDir, 'subagent-agent-sub2.jsonl'), sub2Lines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CLAUDE_CODE, 'Multi agent test');

    const summary = JSON.parse(fs.readFileSync(path.join(tempDir, 'trajectory_summary.json'), 'utf8'));
    assert.strictEqual(summary.steps.length, 3);

    // Verify timestamps are strictly sorted: 21:00:01 -> 21:00:05 -> 21:00:10
    assert.strictEqual(summary.steps[0].stepNumber, 1);
    assert.strictEqual(summary.steps[0].subagentId, 'sub1');
    assert.strictEqual(summary.steps[0].timestamp, '2026-08-09T21:00:01.000Z');
    assert.strictEqual(summary.steps[0].action?.name, 'search_use_cases');

    assert.strictEqual(summary.steps[1].stepNumber, 2);
    assert.strictEqual(summary.steps[1].subagentId, 'sub2');
    assert.strictEqual(summary.steps[1].timestamp, '2026-08-09T21:00:05.000Z');
    assert.strictEqual(summary.steps[1].action?.name, 'replace_file_content');

    assert.strictEqual(summary.steps[2].stepNumber, 3);
    assert.strictEqual(summary.steps[2].timestamp, '2026-08-09T21:00:10.000Z');
    assert.strictEqual(summary.steps[2].action?.name, 'respond_to_user');

  } finally {
    removeTempDir(tempDir);
  }
});

test('collectClaude metrics and token extraction from trajectory files', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        message: {
          model: 'claude-3-7-sonnet',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 25
          },
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              input: { command: 'npx modern-web-guidance retrieve accessible-error-announcement' }
            },
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/path/to/skills/modern-web-guidance/accessible-error-announcement/guide.md' }
            }
          ]
        }
      }),
      JSON.stringify({
        message: {
          model: 'claude-3-7-sonnet',
          usage: {
            input_tokens: 200,
            output_tokens: 80,
            cache_read_input_tokens: 50
          },
          content: [
            {
              type: 'tool_use',
              name: 'Skill',
              input: { skill: 'modern-web-guidance' }
            },
            {
              type: 'tool_use',
              name: 'activate_skill',
              input: { name: 'modern-web-guidance' }
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-123.jsonl'), lines.join('\n'));

    // Test Guides
    const guides = await collectClaudeGuidesFromTrajectory(tempDir);
    assert.deepStrictEqual(guides.retrievedGuides, ['accessible-error-announcement']);
    assert.deepStrictEqual(guides.fileReadGuides, ['accessible-error-announcement']);

    // Test Tools
    const tools = collectClaudeToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);

    // Test Model and Token extraction
    const model = extractClaudeCodeModel(tempDir);
    assert.strictEqual(model, 'claude-3-7-sonnet');

    const tokens = extractClaudeCodeTokenUsage(tempDir);
    assert.deepStrictEqual(tokens, { total: (100 + 50 + 25) + (200 + 80 + 50), cached: 25 + 50 });

  } finally {
    removeTempDir(tempDir);
  }
});
