import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseSync } from 'node:sqlite';
import { generateNormalizedTrajectory } from '../lib/trajectory-parser.ts';
import { Agents } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trajectory-parser-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('Parser: Jetski CLI normalization', async () => {
  const tempDir = createTempDir();
  try {
    const dbPath = path.join(tempDir, 'session-123.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE steps (idx INTEGER, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB);
      CREATE TABLE gen_metadata (idx INTEGER, data BLOB);
    `);

    const mockActionJson = JSON.stringify({
      CommandLine: 'gd retrieve "validate-input-after-interaction"',
      toolSummary: 'Retrieving guidance',
      toolAction: 'Searching'
    });
    const payload1 = Buffer.from(mockActionJson);

    const insertStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata, step_payload) VALUES (?, ?, ?, ?, ?)');
    insertStep.run(1, 21, 1, null, payload1);
    db.close();

    await generateNormalizedTrajectory(tempDir, Agents.JETSKI_CLI, 'Test prompt for Jetski');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath), 'trajectory_summary.json should be created');

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.agent, Agents.JETSKI_CLI);
    assert.strictEqual(summary.initialPrompt, 'Test prompt for Jetski');
    assert.ok(Array.isArray(summary.steps));
    
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].action?.type, 'web_search');
    assert.strictEqual(summary.steps[0].action?.name, 'get_best_practices');
    assert.strictEqual(summary.steps[0].action?.params?.query, 'validate-input-after-interaction');

  } finally {
    removeTempDir(tempDir);
  }
});

test('Parser: Gemini CLI normalization', async () => {
  const tempDir = createTempDir();
  try {
    const sessionData = {
      messages: [
        {
          role: 'user',
          content: 'Hello'
        },
        {
          role: 'gemini',
          thought: 'Thinking...',
          toolCalls: [
            {
              name: 'mcp_modern-web_get_best_practices',
              args: { use_case_id: 'accessible-error-announcement' }
            }
          ]
        },
        {
          role: 'user',
          toolResults: [
            {
              status: 'success',
              output: 'Guidance content'
            }
          ]
        }
      ]
    };

    fs.writeFileSync(path.join(tempDir, 'session-123.json'), JSON.stringify(sessionData));

    await generateNormalizedTrajectory(tempDir, Agents.GEMINI_CLI, 'Hello');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath));

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.agent, Agents.GEMINI_CLI);
    assert.strictEqual(summary.initialPrompt, 'Hello');
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].thought, 'Thinking...');
    assert.strictEqual(summary.steps[0].action?.type, 'web_search');
    assert.strictEqual(summary.steps[0].action?.name, 'mcp_modern-web_get_best_practices');
    assert.strictEqual(summary.steps[0].action?.params?.use_case_id, 'accessible-error-announcement');
    assert.strictEqual(summary.steps[0].outcome?.status, 'success');

  } finally {
    removeTempDir(tempDir);
  }
});

test('Parser: Claude Code normalization with timestamps', async () => {
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

test('Parser: Claude Code subagents inlining and metadata', async () => {
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

test('Parser: Monotonic timestamp sorting across multiple subagents', async () => {
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

test('Parser: Mixed and heterogeneous timestamp formats (ISO, epoch sec, epoch ms, undefined)', async () => {
  const tempDir = createTempDir();
  try {
    // Step A: Epoch seconds (1786309200 = 2026-08-09T21:00:00.000Z)
    // Step B: Epoch milliseconds (1786309205000 = 2026-08-09T21:00:05.000Z)
    // Step C: ISO string (2026-08-09T21:00:02.000Z)
    // Step D: No timestamp
    const lines = [
      JSON.stringify({
        role: 'assistant',
        created_at: 1786309200, // 21:00:00
        message: {
          content: [{ type: 'tool_use', id: 'c1', name: 'search_use_cases', input: { query: 'first' } }]
        }
      }),
      JSON.stringify({
        role: 'assistant',
        timestamp: 1786309205000, // 21:00:05
        message: {
          content: [{ type: 'tool_use', id: 'c2', name: 'write_file', input: { targetFile: 'app.js' } }]
        }
      }),
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T21:00:02.000Z', // 21:00:02
        message: {
          content: [{ type: 'tool_use', id: 'c3', name: 'replace_file_content', input: { targetFile: 'app.js' } }]
        }
      }),
      JSON.stringify({
        role: 'assistant',
        message: {
          content: [{ type: 'text', text: 'All done' }]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-123.jsonl'), lines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CLAUDE_CODE, 'Mixed formats');

    const summary = JSON.parse(fs.readFileSync(path.join(tempDir, 'trajectory_summary.json'), 'utf8'));
    assert.strictEqual(summary.steps.length, 4);

    // Verify chronological order:
    // 1. 21:00:00 (epoch sec) -> step 1
    // 2. 21:00:02 (ISO)       -> step 2
    // 3. 21:00:05 (epoch ms)  -> step 3
    // 4. Undefined timestamp  -> step 4 (stable insertion order at end)
    assert.strictEqual(summary.steps[0].stepNumber, 1);
    assert.strictEqual(summary.steps[0].action?.name, 'search_use_cases');
    assert.strictEqual(new Date(summary.steps[0].timestamp).getTime(), 1786309200000);

    assert.strictEqual(summary.steps[1].stepNumber, 2);
    assert.strictEqual(summary.steps[1].action?.name, 'replace_file_content');
    assert.strictEqual(summary.steps[1].timestamp, '2026-08-09T21:00:02.000Z');

    assert.strictEqual(summary.steps[2].stepNumber, 3);
    assert.strictEqual(summary.steps[2].action?.name, 'write_file');
    assert.strictEqual(new Date(summary.steps[2].timestamp).getTime(), 1786309205000);

    assert.strictEqual(summary.steps[3].stepNumber, 4);
    assert.strictEqual(summary.steps[3].action?.name, 'respond_to_user');
    assert.strictEqual(summary.steps[3].timestamp, undefined);

  } finally {
    removeTempDir(tempDir);
  }
});
