import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { collectGeminiGuidesFromTrajectory, collectGeminiToolsFromTrajectory } from '../agents/gemini-cli-agent.ts';
import { collectClaudeGuidesFromTrajectory, collectClaudeToolsFromTrajectory } from '../agents/claude-code-agent.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trajectory-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('collectGemini metrics from a single trajectory file', async () => {
  const tempDir = createTempDir();
  try {
    const sessionData = {
      messages: [
        {
          type: 'gemini',
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
        },
        {
          type: 'gemini',
          toolCalls: [
            {
              name: 'run_shell_command',
              args: { command: 'npx modern-web retrieve dialog-closedby' }
            },
            {
              name: 'activate_skill',
              args: { name: 'modern-web' }
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
    assert.deepStrictEqual(tools, ['modern-web']);
    
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
            args: { command: 'npx modern-web retrieve dialog-closedby' }
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
    assert.deepStrictEqual(tools, ['modern-web']);

  } finally {
    removeTempDir(tempDir);
  }
});

test('collectClaude metrics from a single trajectory file', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              input: { command: 'npx modern-web retrieve accessible-error-announcement' }
            },
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/path/to/skills/modern-web/accessible-error-announcement/guide.md' }
            }
          ]
        }
      }),
      JSON.stringify({
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Skill',
              input: { skill: 'modern-web' }
            },
            {
              type: 'tool_use',
              name: 'activate_skill',
              input: { name: 'modern-web' }
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-123.jsonl'), lines.join('\n'));

    // Test Guides
    const guides = await collectClaudeGuidesFromTrajectory(tempDir, 'mcp');
    assert.deepStrictEqual(guides.retrievedGuides, ['accessible-error-announcement']);
    assert.deepStrictEqual(guides.fileReadGuides, ['accessible-error-announcement']);

    // Test Tools
    const tools = collectClaudeToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web']);

  } finally {
    removeTempDir(tempDir);
  }
});
