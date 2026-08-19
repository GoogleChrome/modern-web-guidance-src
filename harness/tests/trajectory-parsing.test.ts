import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseSync } from 'node:sqlite';
import { collectGeminiGuidesFromTrajectory, collectGeminiToolsFromTrajectory } from '../agents/gemini-cli-agent.ts';
import { collectClaudeGuidesFromTrajectory, collectClaudeToolsFromTrajectory } from '../agents/claude-code-agent.ts';
import { collectCodexGuidesFromTrajectory, collectCodexToolsFromTrajectory, extractCommandsFromCodexItem, extractCodexCliModel, extractCodexCliTokenUsage } from '../agents/codex-cli-agent.ts';
import { collectJetskiCliGuidesFromTrajectory, collectJetskiCliToolsFromTrajectory, writeTrajectorySummary, readTrajectorySummary, parseJetskiCliSession } from '../agents/jetski-cli-agent.ts';
import { collectGuidesUsed, collectGuidanceToolsUsed } from '../lib/guidance_validation.ts';
import { extractModelFromResults, extractTokenUsageFromResults } from '../lib/collection.ts';
import { Agents, Serving } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trajectory-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function encodeVarint(val: number): Buffer {
  const bytes: number[] = [];
  while (val >= 0x80) {
    bytes.push((val & 0x7f) | 0x80);
    val >>>= 7;
  }
  bytes.push(val);
  return Buffer.from(bytes);
}

function encodeField(tag: number, wireType: number, payload: Buffer | number): Buffer {
  const header = encodeVarint((tag << 3) | wireType);
  if (wireType === 2 && Buffer.isBuffer(payload)) {
    const len = encodeVarint(payload.length);
    return Buffer.concat([header, len, payload]);
  } else if (wireType === 0 && typeof payload === 'number') {
    return Buffer.concat([header, encodeVarint(payload)]);
  }
  return header;
}

test('collectJetski metrics from trajectory files', async () => {
  const tempDir = createTempDir();
  try {
    const dbPath = path.join(tempDir, 'session-123.db');
    const db = new DatabaseSync(dbPath);
    db.exec(`
      CREATE TABLE steps (idx INTEGER, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB);
      CREATE TABLE gen_metadata (idx INTEGER, data BLOB);
    `);

    // 1. step_payload with command line, file read, and skill activation
    const payload1 = encodeField(5, 2, Buffer.from('npx -y modern-web-guidance@latest retrieve "validate-input-after-interaction,required-field-feedback"'));
    const payload2 = encodeField(5, 2, Buffer.from('/skills/modern-web-guidance/required-field-feedback/guide.md'));
    const payload3 = encodeField(5, 2, Buffer.from('/skills/modern-web-guidance/SKILL.md'));

    // 2. metadata with tag 9 -> tag 2 (1500), tag 5 (400)
    const statsInner = Buffer.concat([
      encodeField(2, 0, 1500),
      encodeField(5, 0, 400)
    ]);
    const metadataProto = encodeField(9, 2, statsInner);

    // 3. gen_metadata with tag 1 -> tag 21 ("gemini-3.6-flash")
    const modelInner = encodeField(21, 2, Buffer.from('gemini-3.6-flash'));
    const genDataProto = encodeField(1, 2, modelInner);

    const insertStep = db.prepare('INSERT INTO steps (idx, step_type, status, metadata, step_payload) VALUES (?, ?, ?, ?, ?)');
    insertStep.run(1, 21, 1, metadataProto, payload1);
    insertStep.run(2, 8, 1, null, payload2);
    insertStep.run(3, 8, 1, null, payload3);

    const insertGen = db.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)');
    insertGen.run(1, genDataProto);

    db.close();

    // 1. Verify session parsing
    const parsed = parseJetskiCliSession(tempDir);
    assert.deepStrictEqual(parsed.retrievedGuides, ['validate-input-after-interaction', 'required-field-feedback']);
    assert.deepStrictEqual(parsed.fileReadGuides, ['required-field-feedback']);
    assert.deepStrictEqual(parsed.toolsUsed, ['modern-web-guidance']);
    assert.strictEqual(parsed.model, 'gemini-3.6-flash');
    assert.deepStrictEqual(parsed.tokenUsage, { total: 1900, cached: 400 });

    // 2. Write summary file as done by the agent run() lifecycle
    writeTrajectorySummary(tempDir, parsed);

    // 3. Verify collection methods read strictly from summary
    const guides = await collectJetskiCliGuidesFromTrajectory(tempDir, 'skills_cli');
    assert.deepStrictEqual(guides.retrievedGuides, ['validate-input-after-interaction', 'required-field-feedback']);
    assert.deepStrictEqual(guides.fileReadGuides, ['required-field-feedback']);

    const tools = collectJetskiCliToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);

    const model = extractModelFromResults(tempDir, Agents.JETSKI_CLI);
    assert.strictEqual(model, 'gemini-3.6-flash');

    const tokens = extractTokenUsageFromResults(tempDir, Agents.JETSKI_CLI);
    assert.deepStrictEqual(tokens, { total: 1900, cached: 400 });
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
    const guides = await collectClaudeGuidesFromTrajectory(tempDir, 'mcp');
    assert.deepStrictEqual(guides.retrievedGuides, ['accessible-error-announcement']);
    assert.deepStrictEqual(guides.fileReadGuides, ['accessible-error-announcement']);

    // Test Tools
    const tools = collectClaudeToolsFromTrajectory(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);

  } finally {
    removeTempDir(tempDir);
  }
});

test('trajectory_summary.json generation and priority read', async () => {
  const tempDir = createTempDir();
  try {
    writeTrajectorySummary(tempDir, {
      retrievedGuides: ['summary-guide-1'],
      fileReadGuides: ['summary-read-1'],
      toolsUsed: ['modern-web-guidance'],
      model: 'test-model-pro',
      tokenUsage: { total: 500, cached: 200 }
    });

    const summary = readTrajectorySummary(tempDir);
    assert.ok(summary);
    assert.deepStrictEqual(summary.retrievedGuides, ['summary-guide-1']);
    assert.deepStrictEqual(summary.fileReadGuides, ['summary-read-1']);
    assert.deepStrictEqual(summary.toolsUsed, ['modern-web-guidance']);
    assert.strictEqual(summary.model, 'test-model-pro');
    assert.deepStrictEqual(summary.tokenUsage, { total: 500, cached: 200 });

    // Validate that collection functions read from summary without requiring raw session files
    const guides = await collectGuidesUsed(tempDir, Serving.SKILLS_CLI, Agents.JETSKI_CLI);
    assert.deepStrictEqual(guides.retrievedGuides, ['summary-guide-1']);
    assert.deepStrictEqual(guides.fileReadGuides, ['summary-read-1']);

    const tools = await collectGuidanceToolsUsed(tempDir, Serving.SKILLS_CLI, Agents.JETSKI_CLI);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);

    const model = extractModelFromResults(tempDir, Agents.JETSKI_CLI);
    assert.strictEqual(model, 'test-model-pro');

    const tokenUsage = extractTokenUsageFromResults(tempDir, Agents.JETSKI_CLI);
    assert.deepStrictEqual(tokenUsage, { total: 500, cached: 200 });
  } finally {
    removeTempDir(tempDir);
  }
});

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
