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

test('Parser: Claude Code normalization', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        role: 'user',
        message: { content: 'Fix it' }
      }),
      JSON.stringify({
        role: 'assistant',
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
    assert.strictEqual(summary.steps[0].thought, 'I need to read the file');
    assert.strictEqual(summary.steps[0].action?.type, 'read_file');
    assert.strictEqual(summary.steps[0].action?.name, 'Read');
    assert.strictEqual(summary.steps[0].action?.params?.file_path, 'app.js');
    assert.strictEqual(summary.steps[0].outcome?.status, 'success');

  } finally {
    removeTempDir(tempDir);
  }
});
