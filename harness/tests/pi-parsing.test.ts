import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  generateNormalizedTrajectory,
  collectPiGuidesFromTrajectory,
  collectPiToolsFromTrajectory,
  extractPiModel,
  extractPiTokenUsage
} from '../lib/trajectory-normalizer.ts';
import { Agents } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pi-trajectory-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('collectPiToolsFromTrajectory parses tool calls correctly', async () => {
  const tempDir = createTempDir();
  try {
    // Create a mock Pi session file with tool calls
    const sessionLines = [
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'I need to read a file' },
            { type: 'toolCall', name: 'read', arguments: { path: 'test.txt' } }
          ]
        }
      }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            { type: 'toolCall', name: 'write', arguments: { path: 'output.txt', content: 'hello' } }
          ]
        }
      }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            { type: 'toolCall', name: 'bash', arguments: { command: 'echo test' } }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-123.jsonl'), sessionLines.join('\n'));

    const tools = collectPiToolsFromTrajectory(tempDir);
    
    // Should not include built-in tools (read, write, bash)
    assert.strictEqual(tools.length, 0, 'Should not include built-in Pi tools');
    
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectPiGuidesFromTrajectory extracts guide reads', async () => {
  const tempDir = createTempDir();
  try {
    const sessionLines = [
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'toolCall',
              name: 'read',
              arguments: { path: '/path/to/skills/modern-web-guidance/guides/forms/dialog-focus-management/guide.md' }
            }
          ]
        }
      }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'toolCall',
              name: 'read',
              arguments: { path: '/path/to/.agents/skills/modern-web-guidance/references/css/container-queries.md' }
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-456.jsonl'), sessionLines.join('\n'));

    const guides = await collectPiGuidesFromTrajectory(tempDir, 'skills_cli');
    
    assert.deepStrictEqual(
      guides.fileReadGuides.sort(),
      ['container-queries', 'dialog-focus-management'].sort(),
      'Should extract guide names from file paths'
    );
    assert.strictEqual(guides.retrievedGuides.length, 0, 'Should have no retrieved guides');
    
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectPiGuidesFromTrajectory extracts retrieve commands', async () => {
  const tempDir = createTempDir();
  try {
    const sessionLines = [
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'toolCall',
              name: 'bash',
              arguments: { command: 'npx modern-web-guidance retrieve dialog-closedby,light-dismiss' }
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-789.jsonl'), sessionLines.join('\n'));

    const guides = await collectPiGuidesFromTrajectory(tempDir, 'skills_cli');
    
    assert.deepStrictEqual(
      guides.retrievedGuides.sort(),
      ['dialog-closedby', 'light-dismiss'].sort(),
      'Should extract guide IDs from retrieve command'
    );
    assert.strictEqual(guides.fileReadGuides.length, 0, 'Should have no file read guides');
    
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectPiToolsFromTrajectory detects modern-web-guidance usage', async () => {
  const tempDir = createTempDir();
  try {
    const sessionLines = [
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'toolCall',
              name: 'read',
              arguments: { path: '/skills/modern-web-guidance/guides/forms/dialog-focus-management/guide.md' }
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-abc.jsonl'), sessionLines.join('\n'));

    const tools = collectPiToolsFromTrajectory(tempDir);
    
    // Note: current implementation only detects tools by name, not by file reads
    // This test documents current behavior - may need to enhance detection
    assert.strictEqual(tools.length, 0, 'Built-in read tool should be filtered');
    
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectPiGuidesFromTrajectory handles mixed session with multiple entries', async () => {
  const tempDir = createTempDir();
  try {
    const sessionLines = [
      JSON.stringify({ type: 'session', id: 'test-123' }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Build a dialog' }]
        }
      }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'Let me check the guide' },
            {
              type: 'toolCall',
              name: 'read',
              arguments: { path: '/skills/modern-web-guidance/guides/forms/declarative-dialog/guide.md' }
            },
            {
              type: 'toolCall',
              name: 'bash',
              arguments: { command: 'npx modern-web-guidance retrieve light-dismiss' }
            }
          ]
        }
      }),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: [
            { type: 'toolCall', name: 'write', arguments: { path: 'index.html', content: '<dialog>' } }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-mixed.jsonl'), sessionLines.join('\n'));

    const guides = await collectPiGuidesFromTrajectory(tempDir, 'skills_cli');
    
    assert.deepStrictEqual(
      guides.fileReadGuides,
      ['declarative-dialog'],
      'Should extract guide from read'
    );
    assert.deepStrictEqual(
      guides.retrievedGuides,
      ['light-dismiss'],
      'Should extract guide from retrieve command'
    );
    
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectPiToolsFromTrajectory handles empty or missing sessions', () => {
  const tempDir = createTempDir();
  try {
    const tools = collectPiToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, [], 'Should return empty array for no sessions');
  } finally {
    removeTempDir(tempDir);
  }
});

test('collectPiGuidesFromTrajectory handles empty or missing sessions', async () => {
  const tempDir = createTempDir();
  try {
    const guides = await collectPiGuidesFromTrajectory(tempDir, 'skills_cli');
    assert.deepStrictEqual(guides, { retrievedGuides: [], fileReadGuides: [] }, 'Should return empty for no sessions');
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

test('collectPi metrics and token extraction from trajectory files', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          model: 'claude-3-5-sonnet',
          usage: {
            totalTokens: 200,
            cacheRead: 30
          },
          content: [
            {
              type: 'toolCall',
              name: 'modern-web-guidance',
              arguments: { query: 'dialog' }
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-pi-meta.jsonl'), lines.join('\n'));

    const model = extractPiModel(tempDir);
    assert.strictEqual(model, 'claude-3-5-sonnet');

    const tokens = extractPiTokenUsage(tempDir);
    assert.deepStrictEqual(tokens, { total: 200, cached: 30 });

    const tools = collectPiToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);
  } finally {
    removeTempDir(tempDir);
  }
});
