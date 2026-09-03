import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  categorizeAction,
  mapToolType,
  finalizeTrajectorySummary,
  writeTrajectorySummary,
  readTrajectorySummary,
  generateNormalizedTrajectory,
  standardizeAction,
  type TrajectorySummary,
  TRAJECTORY_SUMMARY_FILE,
  extractClaudeMetadata,
  extractCodexMetadata,
  extractGeminiMetadata,
  extractPiMetadata
} from '../lib/trajectory-normalizer.ts';
import { collectGuidesUsed, collectGuidanceToolsUsed } from '../lib/guidance_validation.ts';
import { extractModelFromResults, extractTokenUsageFromResults } from '../lib/collection.ts';
import { Agents } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'trajectory-normalizer-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('categorizeAction avoids false-positives from code mutation content', () => {
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

  // Test 6: Mandatory rule thought classification
  const thoughtCat = categorizeAction('custom_check', {}, 'I must follow the mandatory baseline css guidance rules');
  assert.strictEqual(thoughtCat, 'mandatory_rule_thought');

  // Test 7: respond_to_user classification
  const respondCat = categorizeAction('respond_to_user', {});
  assert.strictEqual(respondCat, 'other');

  // Test 8: Incidental noise fallback
  const noiseCat = categorizeAction('unknown_utility_ping', {});
  assert.strictEqual(noiseCat, 'incidental_noise');
});

test('categorizeAction distinguishes read actions mentioning files from mutation actions', () => {
  // Read actions mentioning filenames should NOT be categorized as code_mutation
  assert.notStrictEqual(categorizeAction('cat index.html', { cmd: 'cat index.html' }), 'code_mutation');
  assert.notStrictEqual(categorizeAction('read_file', { file_path: 'index.html' }), 'code_mutation');
  assert.notStrictEqual(categorizeAction('view_file', { AbsolutePath: 'app.jsx' }), 'code_mutation');

  // Mutation actions should be categorized as code_mutation
  assert.strictEqual(categorizeAction('write_to_file', { TargetFile: 'index.html' }), 'code_mutation');
  assert.strictEqual(categorizeAction('replace_file_content', { TargetFile: 'app.jsx' }), 'code_mutation');
  assert.strictEqual(categorizeAction('edit', { path: 'style.css' }), 'code_mutation');
});


test('mapToolType maps standard tool names to canonical types', () => {
  assert.strictEqual(mapToolType('read_file'), 'read_file');
  assert.strictEqual(mapToolType('view_file'), 'read_file');
  assert.strictEqual(mapToolType('Read'), 'read_file');
  assert.strictEqual(mapToolType('write_file'), 'write_file');
  assert.strictEqual(mapToolType('str_replace_editor'), 'write_file');
  assert.strictEqual(mapToolType('edit'), 'write_file');
  assert.strictEqual(mapToolType('bash'), 'run_command');
  assert.strictEqual(mapToolType('execute_bash'), 'run_command');
  assert.strictEqual(mapToolType('run_shell_command'), 'run_command');
  assert.strictEqual(mapToolType('search'), 'web_search');
  assert.strictEqual(mapToolType('get_best_practices'), 'web_search');
  assert.strictEqual(mapToolType('retrieve'), 'web_search');
  assert.strictEqual(mapToolType('query_guidance'), 'web_search');
  assert.strictEqual(mapToolType('unknown_action'), 'other');
});

test('standardizeAction enforces strictly typed parameter shapes per action type', () => {
  // run_command standardizes 'cmd', 'command', or string to params.command
  const cmd1 = standardizeAction('run_command', 'bash', { cmd: 'cat index.html' });
  assert.strictEqual(cmd1.type, 'run_command');
  assert.strictEqual(cmd1.name, 'bash');
  assert.strictEqual(cmd1.params?.command, 'cat index.html');

  const cmd2 = standardizeAction('run_command', 'terminal', { command: 'pnpm test' });
  assert.strictEqual(cmd2.params?.command, 'pnpm test');

  // read_file standardizes path, file_path, AbsolutePath, etc. to params.path
  const read1 = standardizeAction('read_file', 'read', { file_path: 'src/index.ts' });
  assert.strictEqual(read1.type, 'read_file');
  assert.strictEqual(read1.params?.path, 'src/index.ts');

  const read2 = standardizeAction('read_file', 'view_file', { AbsolutePath: 'app.jsx' });
  assert.strictEqual(read2.params?.path, 'app.jsx');

  // write_file standardizes path/TargetFile and content/CodeContent/ReplacementChunks
  const write1 = standardizeAction('write_file', 'write_to_file', {
    TargetFile: 'index.html',
    CodeContent: '<html></html>'
  });
  assert.strictEqual(write1.type, 'write_file');
  assert.strictEqual(write1.params?.path, 'index.html');
  assert.strictEqual(write1.params?.content, '<html></html>');

  // web_search standardizes query, search, use_case_id to params.query
  const search1 = standardizeAction('web_search', 'get_best_practices', { use_case_id: 'dialog' });
  assert.strictEqual(search1.type, 'web_search');
  assert.strictEqual(search1.params?.query, 'dialog');
  assert.strictEqual(search1.params?.use_case_id, 'dialog');

  // other preserves raw properties
  const other1 = standardizeAction('other', 'respond_to_user', { response: 'Done' });
  assert.strictEqual(other1.type, 'other');
  assert.deepStrictEqual(other1.params, { response: 'Done' });
});

test('finalizeTrajectorySummary sorts steps monotonically and re-indexes with 1-based numbering', () => {
  const summary: TrajectorySummary = {
    agent: Agents.CLAUDE_CODE,
    steps: [
      {
        stepNumber: 99,
        timestamp: '2026-08-09T21:00:10.000Z',
        action: { name: 'respond_to_user', type: 'other' }
      },
      {
        stepNumber: 99,
        timestamp: '2026-08-09T21:00:01.000Z',
        action: { name: 'search_use_cases', type: 'web_search' }
      },
      {
        stepNumber: 99,
        timestamp: '2026-08-09T21:00:05.000Z',
        action: { name: 'write_file', type: 'write_file' }
      }
    ]
  };

  const finalized = finalizeTrajectorySummary(summary);
  assert.strictEqual(finalized.steps.length, 3);
  assert.strictEqual(finalized.steps[0].stepNumber, 1);
  assert.strictEqual(finalized.steps[0].timestamp, '2026-08-09T21:00:01.000Z');
  assert.strictEqual(finalized.steps[0].action?.name, 'search_use_cases');
  assert.strictEqual(finalized.steps[0].action?.canonicalCategory, 'skill_search');

  assert.strictEqual(finalized.steps[1].stepNumber, 2);
  assert.strictEqual(finalized.steps[1].timestamp, '2026-08-09T21:00:05.000Z');
  assert.strictEqual(finalized.steps[1].action?.name, 'write_file');
  assert.strictEqual(finalized.steps[1].action?.canonicalCategory, 'code_mutation');

  assert.strictEqual(finalized.steps[2].stepNumber, 3);
  assert.strictEqual(finalized.steps[2].timestamp, '2026-08-09T21:00:10.000Z');
  assert.strictEqual(finalized.steps[2].action?.name, 'respond_to_user');
  assert.strictEqual(finalized.steps[2].action?.canonicalCategory, 'other');
});

test('Mixed and heterogeneous timestamp formats (ISO, epoch sec, epoch ms, undefined)', async () => {
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

test('trajectory_summary.json generation and priority read', async () => {
  const tempDir = createTempDir();
  try {
    writeTrajectorySummary(tempDir, {
      agent: Agents.JETSKI_CLI,
      steps: [],
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
    const guides = await collectGuidesUsed(tempDir);
    assert.deepStrictEqual(guides.retrievedGuides, ['summary-guide-1']);
    assert.deepStrictEqual(guides.fileReadGuides, ['summary-read-1']);

    const tools = await collectGuidanceToolsUsed(tempDir);
    assert.deepStrictEqual(tools, ['modern-web-guidance']);

    const model = extractModelFromResults(tempDir);
    assert.strictEqual(model, 'test-model-pro');

    const tokenUsage = extractTokenUsageFromResults(tempDir);
    assert.deepStrictEqual(tokenUsage, { total: 500, cached: 200 });
  } finally {
    removeTempDir(tempDir);
  }
});

test('generateNormalizedTrajectory dispatcher writes summary for given agent', async () => {
  const tempDir = createTempDir();
  try {
    const sessionData = {
      messages: [
        { role: 'user', content: 'Inspect code' },
        {
          role: 'gemini',
          thought: 'Looking up guide',
          toolCalls: [{ name: 'mcp_modern-web_get_best_practices', args: { use_case_id: 'container-queries' } }]
        },
        {
          role: 'user',
          toolResults: [{ status: 'success', output: 'Guide details' }]
        }
      ]
    };
    fs.writeFileSync(path.join(tempDir, 'session-101.json'), JSON.stringify(sessionData));

    await generateNormalizedTrajectory(tempDir, Agents.GEMINI_CLI, 'Inspect code');

    const summaryPath = path.join(tempDir, TRAJECTORY_SUMMARY_FILE);
    assert.ok(fs.existsSync(summaryPath), 'trajectory_summary.json should be created by dispatcher');

    const summary = readTrajectorySummary(tempDir);
    assert.ok(summary);
    assert.strictEqual(summary.agent, Agents.GEMINI_CLI);
    assert.strictEqual(summary.initialPrompt, 'Inspect code');
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].stepNumber, 1);
    assert.strictEqual(summary.steps[0].action?.name, 'mcp_modern-web_get_best_practices');
  } finally {
    removeTempDir(tempDir);
  }
});

test('generateNormalizedTrajectory aggregates entries across multiple main session files', async () => {
  const tempDir = createTempDir();
  try {
    const session1Lines = [
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T21:00:00.000Z',
        message: {
          content: [{ type: 'tool_use', id: 'c1', name: 'search_use_cases', input: { query: 'first' } }]
        }
      })
    ];
    const session2Lines = [
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-09T21:00:05.000Z',
        message: {
          content: [{ type: 'tool_use', id: 'c2', name: 'write_file', input: { TargetFile: 'app.js' } }]
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-1.jsonl'), session1Lines.join('\n'));
    fs.writeFileSync(path.join(tempDir, 'session-2.jsonl'), session2Lines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CLAUDE_CODE, 'Multi-session test');

    const summary = readTrajectorySummary(tempDir);
    assert.ok(summary, 'trajectory_summary.json should exist');
    assert.strictEqual(summary.steps.length, 2, 'Should aggregate steps from both session files');
    assert.strictEqual(summary.steps[0].action?.name, 'search_use_cases');
    assert.strictEqual(summary.steps[1].action?.name, 'write_file');
  } finally {
    removeTempDir(tempDir);
  }
});

test('agent trajectory parsers strictly enforce modern-web-guidance retrieve filter', () => {
  const validCmd = 'npx -y modern-web-guidance@latest retrieve "dialog-closedby,light-dismiss"';
  const legacyCmd = 'npx modern-web retrieve dialog-closedby';
  const searchCmd = 'npx modern-web-guidance search "dialog"';
  const genericCmd = 'curl https://example.com/retrieve/docs && git retrieve-branch';

  // 1. Claude
  const claudeMeta = extractClaudeMetadata([
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: validCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: legacyCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: searchCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: genericCmd } }] } },
  ]);
  assert.deepStrictEqual(claudeMeta.retrievedGuides, ['dialog-closedby', 'light-dismiss']);

  // 2. Codex
  const codexMeta = extractCodexMetadata([
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: validCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: legacyCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: searchCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: genericCmd }) } },
  ]);
  assert.deepStrictEqual(codexMeta.retrievedGuides, ['dialog-closedby', 'light-dismiss']);

  // 3. Gemini
  const geminiMeta = extractGeminiMetadata({
    messages: [
      { type: 'gemini', toolCalls: [{ name: 'run_shell_command', args: { command: validCmd } }] },
      { type: 'gemini', toolCalls: [{ name: 'run_shell_command', args: { command: legacyCmd } }] },
      { type: 'gemini', toolCalls: [{ name: 'run_shell_command', args: { command: searchCmd } }] },
      { type: 'gemini', toolCalls: [{ name: 'run_shell_command', args: { command: genericCmd } }] },
    ]
  });
  assert.deepStrictEqual(geminiMeta.retrievedGuides, ['dialog-closedby', 'light-dismiss']);

  // 4. Pi
  const piMeta = extractPiMetadata([
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: validCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: legacyCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: searchCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: genericCmd } }] } },
  ]);
  assert.deepStrictEqual(piMeta.retrievedGuides, ['dialog-closedby', 'light-dismiss']);
});

