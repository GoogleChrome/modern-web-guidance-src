import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseSync } from 'node:sqlite';
import { generateNormalizedTrajectory, categorizeAction } from '../lib/trajectory-parser.ts';
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

test('Parser: Pi CLI normalization', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        type: 'message',
        timestamp: '2026-08-09T22:00:00.000Z',
        message: {
          role: 'user',
          content: 'Add autocomplete to form'
        }
      }),
      JSON.stringify({
        type: 'message',
        timestamp: '2026-08-09T22:00:01.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Searching for relevant guide' },
            {
              type: 'toolCall',
              name: 'bash',
              arguments: { command: 'node dist/cli.js --retrieve autofill-address-form' }
            }
          ]
        }
      }),
      JSON.stringify({
        type: 'message',
        timestamp: '2026-08-09T22:00:05.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Editing form component' },
            {
              type: 'toolCall',
              name: 'write',
              arguments: { path: 'form.html', content: '<input autocomplete="street-address" />' }
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-pi.jsonl'), lines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.PI, 'Add autocomplete to form');

    const summary = JSON.parse(fs.readFileSync(path.join(tempDir, 'trajectory_summary.json'), 'utf8'));
    assert.strictEqual(summary.agent, Agents.PI);
    assert.strictEqual(summary.steps.length, 2);

    assert.strictEqual(summary.steps[0].stepNumber, 1);
    assert.strictEqual(summary.steps[0].action?.name, 'bash');
    assert.strictEqual(summary.steps[0].action?.type, 'run_command');
    assert.strictEqual(summary.steps[0].action?.canonicalCategory, 'guide_retrieval');

    assert.strictEqual(summary.steps[1].stepNumber, 2);
    assert.strictEqual(summary.steps[1].action?.name, 'write');
    assert.strictEqual(summary.steps[1].action?.type, 'write_file');
    assert.strictEqual(summary.steps[1].action?.canonicalCategory, 'code_mutation');

  } finally {
    removeTempDir(tempDir);
  }
});

test('Parser: categorizeAction avoids false-positives from code mutation content', () => {
  // Test 1: replace_file_content with "retrieve" in content should be code_mutation, NOT guide_retrieval
  const cat1 = categorizeAction('replace_file_content', {
    TargetFile: 'src/user.ts',
    TargetContent: 'function retrieveUserData() { return null; }',
    ReplacementContent: 'function retrieveUserData() { return { id: 1 }; }'
  });
  assert.strictEqual(cat1, 'code_mutation');

  // Test 2: replace_file_content with "search" in content should be code_mutation, NOT skill_search
  const cat2 = categorizeAction('replace_file_content', {
    TargetFile: 'src/search-bar.ts',
    TargetContent: 'const search = () => {};',
    ReplacementContent: 'const search = (q) => performSearch(q);'
  });
  assert.strictEqual(cat2, 'code_mutation');

  // Test 3: write_to_file with "retrieve" and "search" in content
  const cat3 = categorizeAction('write_to_file', {
    TargetFile: 'src/api.ts',
    CodeContent: 'export async function retrieveAndSearch() {}'
  });
  assert.strictEqual(cat3, 'code_mutation');

  // Test 4: edit / str_replace_editor tools
  const cat4 = categorizeAction('str_replace_editor', {
    command: 'str_replace',
    path: 'index.html',
    new_str: '<button onclick="search()">Search</button>'
  });
  assert.strictEqual(cat4, 'code_mutation');

  // Test 5: Real guide retrieval / search tool calls are still classified correctly
  const guideCat = categorizeAction('get_best_practices', { query: 'accessible-forms' });
  assert.strictEqual(guideCat, 'skill_search');

  const retrieveCat = categorizeAction('retrieve_guidance', { id: 'dialog' });
  assert.strictEqual(retrieveCat, 'guide_retrieval');
});

test('Parser: Claude Code subagent agentId extraction from array or object content', async () => {
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

test('Parser: Codex CLI normalization with commentary, response items, and subagent inlining', async () => {
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
