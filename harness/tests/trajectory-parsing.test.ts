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

test('collectGeminiGuidesFromTrajectory parses get_best_practices and read_file', async () => {
  const tempDir = createTempDir();
  try {
    const sessionData = {
      messages: [
        {
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
        }
      ]
    };

    fs.writeFileSync(path.join(tempDir, 'session-123.json'), JSON.stringify(sessionData));

    const result = await collectGeminiGuidesFromTrajectory(tempDir, 'mcp');
    
    assert.deepStrictEqual(result.retrievedGuides, ['accessible-error-announcement']);
    assert.deepStrictEqual(result.fileReadGuides, ['required-field-feedback']);
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectGeminiGuidesFromTrajectory parses run_shell_command with modern-web --retrieve', async () => {
  const tempDir = createTempDir();
  try {
    const sessionData = {
      messages: [
        {
          toolCalls: [
            {
              name: 'run_shell_command',
              args: { command: 'npx modern-web --retrieve accessible-error-announcement,required-field-feedback' }
            }
          ]
        }
      ]
    };

    fs.writeFileSync(path.join(tempDir, 'session-123.json'), JSON.stringify(sessionData));

    const result = await collectGeminiGuidesFromTrajectory(tempDir, 'skills_cli');
    
    assert.deepStrictEqual(result.retrievedGuides, ['accessible-error-announcement', 'required-field-feedback']);
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectGeminiToolsFromTrajectory parses get_best_practices and activate_skill', async () => {
  const tempDir = createTempDir();
  try {
    const sessionData = {
      messages: [
        {
          toolCalls: [
            { name: 'mcp_modern-web_get_best_practices' }
          ]
        },
        {
          toolCalls: [
            {
              name: 'activate_skill',
              args: { name: 'modern-web' }
            }
          ]
        }
      ]
    };

    fs.writeFileSync(path.join(tempDir, 'session-123.json'), JSON.stringify(sessionData));

    const result = collectGeminiToolsFromTrajectory(tempDir);
    
    assert.deepStrictEqual(result, ['modern-web']);
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectClaudeGuidesFromTrajectory parses Bash and Read', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              input: { command: 'npx modern-web --retrieve accessible-error-announcement' }
            }
          ]
        }
      }),
      JSON.stringify({
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/path/to/skills/modern-web/accessible-error-announcement/guide.md' }
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-123.jsonl'), lines.join('\n'));

    const result = await collectClaudeGuidesFromTrajectory(tempDir, 'mcp');
    
    assert.deepStrictEqual(result.retrievedGuides, ['accessible-error-announcement']);
    assert.deepStrictEqual(result.fileReadGuides, ['accessible-error-announcement']);
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectClaudeToolsFromTrajectory parses Skill and activate_skill', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Skill',
              input: { skill: 'modern-web' }
            }
          ]
        }
      }),
      JSON.stringify({
        message: {
          content: [
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

    const result = collectClaudeToolsFromTrajectory(tempDir);
    
    assert.deepStrictEqual(result, ['modern-web']);
  } finally {
    removeTempDir(tempDir);
  }
});
