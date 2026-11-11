import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  generateNormalizedTrajectory,
  loadSessionLogs
} from '../lib/trajectory-normalizer.ts';
import { getPiCommandAndArgs, exportPiTrajectories, parsePiTrajectory } from './pi-agent.ts';
import { Agents } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pi-trajectory-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function parsePiSessionDir(dir: string) {
  const { logData, subagentsMap } = loadSessionLogs(dir);
  return parsePiTrajectory(logData, subagentsMap);
}

test('parsePiTrajectory parses tool calls correctly', async () => {
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

    const tools = parsePiSessionDir(tempDir).toolsUsed ?? [];
    
    // Should not include built-in tools (read, write, bash)
    assert.strictEqual(tools.length, 0, 'Should not include built-in Pi tools');
    
  } finally {
    removeTempDir(tempDir);
  }
});

test('parsePiTrajectory extracts guide reads', async () => {
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

    const guides = parsePiSessionDir(tempDir);
    
    assert.deepStrictEqual(
      (guides.fileReadGuides ?? []).sort(),
      ['container-queries', 'dialog-focus-management'].sort(),
      'Should extract guide names from file paths'
    );
    assert.strictEqual((guides.retrievedGuides ?? []).length, 0, 'Should have no retrieved guides');
    
  } finally {
    removeTempDir(tempDir);
  }
});

test('parsePiTrajectory extracts retrieve commands', async () => {
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

    const guides = parsePiSessionDir(tempDir);
    
    assert.deepStrictEqual(
      (guides.retrievedGuides ?? []).sort(),
      ['dialog-closedby', 'light-dismiss'].sort(),
      'Should extract guide IDs from retrieve command'
    );
    assert.strictEqual((guides.fileReadGuides ?? []).length, 0, 'Should have no file read guides');
    
  } finally {
    removeTempDir(tempDir);
  }
});

test('parsePiTrajectory detects modern-web-guidance usage', async () => {
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

    const tools = parsePiSessionDir(tempDir).toolsUsed ?? [];
    assert.strictEqual(tools.length, 0, 'Reading a guide.md directly should not count as skill activation');
  } finally {
    removeTempDir(tempDir);
  }
});

test('parsePiTrajectory detects SKILL.md read as skill activation', async () => {
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
              arguments: { path: '/tmp/ghh-pi-123/.agents/skills/modern-web-guidance/SKILL.md' }
            }
          ]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-skill.jsonl'), sessionLines.join('\n'));

    const summary = parsePiSessionDir(tempDir);
    assert.deepStrictEqual(summary.toolsUsed, ['modern-web-guidance']);
    assert.deepStrictEqual(summary.fileReadGuides, [], 'SKILL.md should not be recorded as a file-read guide');
  } finally {
    removeTempDir(tempDir);
  }
});

test('parsePiTrajectory handles mixed session with multiple entries', async () => {
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

    const guides = parsePiSessionDir(tempDir);
    
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

test('parsePiTrajectory handles empty or missing sessions', () => {
  const tempDir = createTempDir();
  try {
    const summary = parsePiSessionDir(tempDir);
    assert.deepStrictEqual(summary.toolsUsed, [], 'Should return empty array for no sessions');
    assert.deepStrictEqual(
      { retrievedGuides: summary.retrievedGuides ?? [], fileReadGuides: summary.fileReadGuides ?? [] },
      { retrievedGuides: [], fileReadGuides: [] },
      'Should return empty for no sessions'
    );
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
              arguments: { command: 'npx modern-web-guidance retrieve autofill-address-form' }
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

    const summary = parsePiSessionDir(tempDir);
    assert.strictEqual(summary.model, 'claude-3-5-sonnet');
    assert.deepStrictEqual(summary.tokenUsage, { total: 200, cached: 30 });
    assert.deepStrictEqual(summary.toolsUsed, ['modern-web-guidance']);
  } finally {
    removeTempDir(tempDir);
  }
});
test('getPiCommandAndArgs does not include --no-session by default', () => {
  const oldEnv = process.env.PI_NO_SESSION;
  delete process.env.PI_NO_SESSION;
  try {
    const { commandArgs } = getPiCommandAndArgs('test prompt');
    assert.ok(!commandArgs.includes('--no-session'), 'Should not use --no-session by default');
  } finally {
    if (oldEnv !== undefined) {
      process.env.PI_NO_SESSION = oldEnv;
    }
  }
});

test('getPiCommandAndArgs includes --no-session when PI_NO_SESSION is true', () => {
  const oldEnv = process.env.PI_NO_SESSION;
  process.env.PI_NO_SESSION = 'true';
  try {
    const { commandArgs } = getPiCommandAndArgs('test prompt');
    assert.ok(commandArgs.includes('--no-session'), 'Should use --no-session when PI_NO_SESSION=true');
  } finally {
    if (oldEnv !== undefined) {
      process.env.PI_NO_SESSION = oldEnv;
    } else {
      delete process.env.PI_NO_SESSION;
    }
  }
});

test('getPiCommandAndArgs handles PI_NO_SESSION=1, 0, and false', () => {
  const oldEnv = process.env.PI_NO_SESSION;
  try {
    process.env.PI_NO_SESSION = '1';
    assert.ok(getPiCommandAndArgs('test').commandArgs.includes('--no-session'));

    process.env.PI_NO_SESSION = 'false';
    assert.ok(!getPiCommandAndArgs('test').commandArgs.includes('--no-session'));

    process.env.PI_NO_SESSION = '0';
    assert.ok(!getPiCommandAndArgs('test').commandArgs.includes('--no-session'));
  } finally {
    if (oldEnv !== undefined) {
      process.env.PI_NO_SESSION = oldEnv;
    } else {
      delete process.env.PI_NO_SESSION;
    }
  }
});

test('exportPiTrajectories exports nested Pi session files with session- prefix', () => {
  const tempHome = createTempDir();
  const targetDir = createTempDir();
  try {
    const workDir = path.join(tempHome, 'work');
    const sessionsDir = path.join(tempHome, '.pi', 'agent', 'sessions', '--path--');
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, '2026-08-30_abc.jsonl'), '{"type":"session"}');

    exportPiTrajectories(workDir, targetDir);

    const exportedFiles = fs.readdirSync(targetDir);
    assert.strictEqual(exportedFiles.length, 1);
    assert.strictEqual(exportedFiles[0], 'session---path---2026-08-30_abc.jsonl');
  } finally {
    removeTempDir(tempHome);
    removeTempDir(targetDir);
  }
});

test('parsePiTrajectory handles stringified JSON tool arguments', () => {
  const lines = [
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            id: 'call_pi_1',
            name: 'bash',
            arguments: JSON.stringify({ command: 'pnpm test' })
          }
        ]
      }
    },
    {
      type: 'tool_result',
      tool_use_id: 'call_pi_1',
      output: 'Pass',
      is_error: false
    }
  ];

  const summary = parsePiTrajectory(lines);
  assert.strictEqual(summary.steps.length, 1);
  assert.strictEqual(summary.steps[0].action?.type, 'run_command');
  assert.strictEqual(summary.steps[0].action?.params?.command, 'pnpm test');
  assert.strictEqual(summary.steps[0].outcome?.status, 'success');
});

test('parsePiTrajectory handles native Pi message.role toolResult format', () => {
  const lines = [
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            id: 'call_pi_native',
            name: 'bash',
            arguments: { command: 'git status' }
          }
        ]
      }
    },
    {
      type: 'message',
      message: {
        role: 'toolResult',
        toolCallId: 'call_pi_native',
        toolName: 'bash',
        content: [{ type: 'text', text: 'On branch main' }],
        isError: false
      }
    }
  ];

  const summary = parsePiTrajectory(lines);
  assert.strictEqual(summary.steps.length, 1);
  assert.strictEqual(summary.steps[0].action?.type, 'run_command');
  assert.strictEqual(summary.steps[0].outcome?.status, 'success');
  assert.strictEqual(summary.steps[0].outcome?.message, 'On branch main');
});

