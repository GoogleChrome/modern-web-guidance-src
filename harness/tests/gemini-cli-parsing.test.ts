import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  generateNormalizedTrajectory,
  collectGeminiGuidesFromTrajectory,
  collectGeminiToolsFromTrajectory,
  extractGeminiCliModel,
  extractGeminiCliTokenUsage
} from '../lib/trajectory-normalizer.ts';
import { Agents } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-parsing-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('Gemini CLI normalization with toolCalls and toolResults matching', async () => {
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

test('Gemini CLI subagents inlining and session parsing', async () => {
  const tempDir = createTempDir();
  try {
    const mainSession = {
      messages: [
        {
          role: 'gemini',
          timestamp: '2026-08-09T20:00:00.000Z',
          thought: 'Delegating work to subagent',
          toolCalls: [
            {
              name: 'run_shell_command',
              args: { command: 'node worker.js' }
            }
          ]
        }
      ]
    };

    const subagentSession = {
      messages: [
        {
          role: 'gemini',
          timestamp: '2026-08-09T20:00:02.000Z',
          thought: 'Subagent editing styles',
          toolCalls: [
            {
              name: 'write_file',
              args: { file_path: 'main.css', content: 'body { margin: 0; }' }
            }
          ]
        }
      ]
    };

    fs.writeFileSync(path.join(tempDir, 'session-main.json'), JSON.stringify(mainSession));
    fs.writeFileSync(path.join(tempDir, 'subagent-agent-worker-gem.json'), JSON.stringify(subagentSession));

    await generateNormalizedTrajectory(tempDir, Agents.GEMINI_CLI, 'Build app');

    const summary = JSON.parse(fs.readFileSync(path.join(tempDir, 'trajectory_summary.json'), 'utf8'));
    assert.strictEqual(summary.agent, Agents.GEMINI_CLI);
    assert.ok(summary.subagents?.['worker-gem']);
    assert.strictEqual(summary.subagents['worker-gem'].totalSteps, 1);
    assert.strictEqual(summary.steps.length, 2);

    assert.strictEqual(summary.steps[0].stepNumber, 1);
    assert.strictEqual(summary.steps[0].timestamp, '2026-08-09T20:00:00.000Z');
    assert.strictEqual(summary.steps[0].action?.name, 'run_shell_command');

    assert.strictEqual(summary.steps[1].stepNumber, 2);
    assert.strictEqual(summary.steps[1].timestamp, '2026-08-09T20:00:02.000Z');
    assert.strictEqual(summary.steps[1].subagentId, 'worker-gem');
    assert.strictEqual(summary.steps[1].action?.name, 'write_file');
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectGemini metrics from a single trajectory file', async () => {
  const tempDir = createTempDir();
  try {
    const sessionData = {
      messages: [
        {
          type: 'gemini',
          model: 'gemini-2.5-flash',
          tokens: { total: 300, cached: 100 },
          toolCalls: [
            {
              name: 'mcp_modern-web-guidance_get_best_practices',
              args: { use_case_id: 'accessible-error-announcement' }
            },
            {
              name: 'read_file',
              args: { file_path: '/path/to/skills/modern-web-guidance/references/forms/required-field-feedback.md' }
            }
          ]
        },
        {
          type: 'gemini',
          toolCalls: [
            {
              name: 'run_shell_command',
              args: { command: 'npx modern-web-guidance retrieve dialog-closedby' }
            },
            {
              name: 'activate_skill',
              args: { name: 'modern-web-guidance' }
            }
          ]
        }
      ]
    };

    fs.writeFileSync(path.join(tempDir, 'session-123.json'), JSON.stringify(sessionData));

    // Test Guides
    const guides = await collectGeminiGuidesFromTrajectory(tempDir, 'mcp');
    assert.deepStrictEqual(guides.retrievedGuides.sort(), ['accessible-error-announcement', 'dialog-closedby'].sort());
    assert.deepStrictEqual(guides.fileReadGuides, ['required-field-feedback']);

    // Test Tools
    const tools = collectGeminiToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);

    // Test Model and Token extraction
    const model = extractGeminiCliModel(tempDir);
    assert.strictEqual(model, 'gemini-2.5-flash');

    const tokens = extractGeminiCliTokenUsage(tempDir);
    assert.deepStrictEqual(tokens, { total: 300, cached: 100 });
    
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectGemini metrics from a .jsonl trajectory file', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        type: 'gemini',
        model: 'gemini-2.5-pro',
        tokens: { total: 400, cached: 150 },
        toolCalls: [
          {
            name: 'mcp_modern-web_get_best_practices',
            args: { use_case_id: 'accessible-error-announcement' }
          },
          {
            name: 'read_file',
            args: { file_path: '/path/to/skills/modern-web/references/forms/required-field-feedback.md' }
          }
        ]
      }),
      JSON.stringify({
        type: 'gemini',
        toolCalls: [
          {
            name: 'run_shell_command',
            args: { command: 'npx modern-web-guidance retrieve dialog-closedby' }
          },
          {
            name: 'activate_skill',
            args: { name: 'modern-web' }
          }
        ]
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-123.jsonl'), lines.join('\n'));

    // Test Guides
    const guides = await collectGeminiGuidesFromTrajectory(tempDir, 'mcp');
    assert.deepStrictEqual(guides.retrievedGuides.sort(), ['accessible-error-announcement', 'dialog-closedby'].sort());
    assert.deepStrictEqual(guides.fileReadGuides, ['required-field-feedback']);

    // Test Tools
    const tools = collectGeminiToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools.sort(), ['modern-web-guidance', 'modern-web'].sort());

    const model = extractGeminiCliModel(tempDir);
    assert.strictEqual(model, 'gemini-2.5-pro');

    const tokens = extractGeminiCliTokenUsage(tempDir);
    assert.deepStrictEqual(tokens, { total: 400, cached: 150 });

  } finally {
    removeTempDir(tempDir);
  }
});
