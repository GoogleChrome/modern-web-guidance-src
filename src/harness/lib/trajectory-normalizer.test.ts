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
  type StandardizedAction,
  type TrajectorySummary,
  TRAJECTORY_SUMMARY_FILE,
  extractSubagentIdFromFilename
} from './trajectory-normalizer.ts';
import { parseClaudeTrajectory } from '../agents/claude-code-agent.ts';
import { parseCodexTrajectory } from '../agents/codex-cli-agent.ts';
import { parsePiTrajectory } from '../agents/pi-agent.ts';
import { collectGuidesUsed, collectGuidanceToolsUsed, hasTrajectoryGuideLeak } from './guide-usage.ts';
import { extractModelFromResults, extractTokenUsageFromResults } from './collection.ts';
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
  }, undefined, 'write_file');
  assert.strictEqual(cat1, 'code_mutation');

  // Test 2: replace_file_content with "search" in content should be code_mutation, NOT skill_search
  const cat2 = categorizeAction('replace_file_content', {
    TargetFile: 'src/search-bar.ts',
    TargetContent: 'const search = () => {};',
    ReplacementContent: 'const search = (q) => performSearch(q);'
  }, undefined, 'write_file');
  assert.strictEqual(cat2, 'code_mutation');

  // Test 3: write_to_file with "retrieve" and "search" in content
  const cat3 = categorizeAction('write_to_file', {
    TargetFile: 'src/api.ts',
    CodeContent: 'export async function retrieveAndSearch() {}'
  }, undefined, 'write_file');
  assert.strictEqual(cat3, 'code_mutation');

  // Test 4: edit / str_replace_editor tools
  const cat4 = categorizeAction('str_replace_editor', {
    command: 'str_replace',
    path: 'index.html',
    new_str: '<button onclick="search()">Search</button>'
  }, undefined, 'write_file');
  assert.strictEqual(cat4, 'code_mutation');

  // Test 5: Guidance tagging keys off a literal `modern-web-guidance` invocation
  const cliSearchCat = categorizeAction('bash', { command: 'npx -y modern-web-guidance@latest search "accordion"' }, undefined, 'run_command');
  assert.strictEqual(cliSearchCat, 'skill_search');

  const cliAnalyzeCat = categorizeAction('bash', { command: 'npx -y modern-web-guidance@latest analyze src/ --json' }, undefined, 'run_command');
  assert.strictEqual(cliAnalyzeCat, 'skill_search');

  const cliLegacyScanCat = categorizeAction('bash', { command: 'npx -y modern-web-guidance@latest legacy-scan src/ --json' }, undefined, 'run_command');
  assert.strictEqual(cliLegacyScanCat, 'skill_search');

  const cliRetrieveCat = categorizeAction('bash', { command: 'npx -y modern-web-guidance@latest retrieve "details-styling"' }, undefined, 'run_command');
  assert.strictEqual(cliRetrieveCat, 'guide_retrieval');

  // Test 6: Mandatory rule thought classification
  const thoughtCat = categorizeAction('custom_check', {}, 'I must follow the mandatory baseline css guidance rules', 'other');
  assert.strictEqual(thoughtCat, 'mandatory_rule_thought');

  // Test 7: respond_to_user classification
  const respondCat = categorizeAction('respond_to_user', {}, undefined, 'other');
  assert.strictEqual(respondCat, 'other');

  // Test 8: Incidental noise fallback
  const noiseCat = categorizeAction('unknown_utility_ping', {}, undefined, 'other');
  assert.strictEqual(noiseCat, 'incidental_noise');

  // Test 9: Skill activations get their own category
  const skillCat = categorizeAction('Skill', { skill: 'modern-web-guidance' }, undefined, 'other');
  assert.strictEqual(skillCat, 'skill_activation');
  assert.strictEqual(categorizeAction('activate_skill', { name: 'modern-web-guidance' }, undefined, 'other'), 'skill_activation');
});

test('categorizeAction rejects commands and thoughts that only incidentally mention guidance terms', () => {
  const notGuidance = [
    'curl https://example.com/retrieve/item',
    'rg search ./gd-utils/',
    'git cat-file -p HEAD # retrieve gd blob',
    'node ./scripts/cli.js search foo',
    'gd search dialog'
  ];
  assert.deepStrictEqual(
    notGuidance.map(command => categorizeAction('bash', { command }, undefined, 'run_command')),
    notGuidance.map(() => 'incidental_noise')
  );

  // Generic search/retrieve tool names are not the guidance skill
  assert.strictEqual(categorizeAction('code_search', { query: 'dialog' }, undefined, 'other'), 'incidental_noise');
  assert.strictEqual(categorizeAction('get_best_practices', { use_case_id: 'accessible-forms' }, undefined, 'other'), 'incidental_noise');

  // A thought that merely mentions css/baseline/guidance is not a mandatory rule adoption
  assert.strictEqual(
    categorizeAction('list_dir', {}, 'Listing the css folder to see what is there', 'other'),
    'incidental_noise'
  );
});

test('categorizeAction distinguishes read actions mentioning files from mutation actions', () => {
  // Read actions mentioning filenames should NOT be categorized as code_mutation
  assert.notStrictEqual(categorizeAction('bash', { cmd: 'cat index.html' }, undefined, 'run_command'), 'code_mutation');
  assert.notStrictEqual(categorizeAction('read_file', { file_path: 'index.html' }, undefined, 'read_file'), 'code_mutation');
  assert.notStrictEqual(categorizeAction('view_file', { AbsolutePath: 'app.jsx' }, undefined, 'read_file'), 'code_mutation');

  // Mutation actions should be categorized as code_mutation
  assert.strictEqual(categorizeAction('write_to_file', { TargetFile: 'index.html' }, undefined, 'write_file'), 'code_mutation');
  assert.strictEqual(categorizeAction('replace_file_content', { TargetFile: 'app.jsx' }, undefined, 'write_file'), 'code_mutation');
  assert.strictEqual(categorizeAction('edit', { path: 'style.css' }, undefined, 'write_file'), 'code_mutation');

  // Also support callers without explicit actionType when mutationParamKeys are present
  assert.strictEqual(categorizeAction('write_to_file', { TargetFile: 'index.html' }), 'code_mutation');
  assert.strictEqual(categorizeAction('replace_file_content', { TargetFile: 'app.jsx' }), 'code_mutation');
});

test('categorizeAction classifies TodoWrite and non-mutation tools as incidental noise', () => {
  // Claude Code TodoWrite should never be miscategorized as code_mutation
  assert.strictEqual(categorizeAction('TodoWrite', { todos: [] }, undefined, 'other'), 'incidental_noise');
  assert.strictEqual(categorizeAction('TodoWrite', { todos: [] }), 'incidental_noise');
  assert.strictEqual(categorizeAction('TodoRead', {}, undefined, 'other'), 'incidental_noise');

  // Run command with edit/write in its name should not be miscategorized as code_mutation
  assert.strictEqual(categorizeAction('edit_plan_notes', { command: 'echo "notes"' }, undefined, 'run_command'), 'incidental_noise');
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
  assert.strictEqual(mapToolType('search'), 'other');
  assert.strictEqual(mapToolType('get_best_practices'), 'other');
  assert.strictEqual(mapToolType('retrieve'), 'other');
  assert.strictEqual(mapToolType('query_guidance'), 'other');
  assert.strictEqual(mapToolType('TodoWrite'), 'other');
  assert.strictEqual(mapToolType('TodoRead'), 'other');
  assert.strictEqual(mapToolType('unknown_action'), 'other');
});

function assertActionType<T extends StandardizedAction['type']>(
  action: StandardizedAction,
  type: T
): asserts action is Extract<StandardizedAction, { type: T }> {
  assert.strictEqual(action.type, type);
}

test('standardizeAction enforces strictly typed parameter shapes per action type', () => {
  // run_command standardizes 'cmd', 'command', or string to params.command
  const cmd1 = standardizeAction('run_command', 'bash', { cmd: 'cat index.html' });
  assertActionType(cmd1, 'run_command');
  assert.strictEqual(cmd1.name, 'bash');
  assert.strictEqual(cmd1.params.command, 'cat index.html');

  const cmd2 = standardizeAction('run_command', 'terminal', { command: 'pnpm test' });
  assertActionType(cmd2, 'run_command');
  assert.strictEqual(cmd2.params.command, 'pnpm test');

  const cmd3 = standardizeAction('run_command', 'bash', 'git status');
  assertActionType(cmd3, 'run_command');
  assert.strictEqual(cmd3.params.command, 'git status');

  // read_file standardizes path, file_path to params.path
  const read1 = standardizeAction('read_file', 'read', { file_path: 'src/index.ts' });
  assertActionType(read1, 'read_file');
  assert.strictEqual(read1.params.path, 'src/index.ts');

  const read2 = standardizeAction('read_file', 'view_file', { path: 'app.jsx' });
  assertActionType(read2, 'read_file');
  assert.strictEqual(read2.params.path, 'app.jsx');

  // write_file standardizes path/file_path and content/new_string/newText
  const write1 = standardizeAction('write_file', 'write_to_file', {
    path: 'index.html',
    content: '<html></html>'
  });
  assertActionType(write1, 'write_file');
  assert.strictEqual(write1.params.path, 'index.html');
  assert.strictEqual(write1.params.content, '<html></html>');

  const write2 = standardizeAction('write_file', 'edit', {
    file_path: '/path/to/main.ts',
    new_string: 'const a = 1;'
  });
  assertActionType(write2, 'write_file');
  assert.strictEqual(write2.params.path, '/path/to/main.ts');
  assert.strictEqual(write2.params.content, 'const a = 1;');

  const write3 = standardizeAction('write_file', 'edit', {
    path: '/path/to/main.ts',
    newText: 'const b = 2;'
  });
  assertActionType(write3, 'write_file');
  assert.strictEqual(write3.params.path, '/path/to/main.ts');
  assert.strictEqual(write3.params.content, 'const b = 2;');

  // write_file strips raw untruncated content fields and truncates long content to 300 chars
  const writeTruncated = standardizeAction('write_file', 'write_to_file', {
    path: 'big.js',
    content: 'x'.repeat(400),
    CodeContent: 'raw-code',
    ReplacementChunks: 'raw-chunks',
    ReplacementContent: 'raw-repl',
    TargetContent: 'raw-target',
    otherProp: 'keep'
  });
  assertActionType(writeTruncated, 'write_file');
  assert.strictEqual(writeTruncated.params.path, 'big.js');
  assert.strictEqual(writeTruncated.params.content, 'x'.repeat(300) + '... [truncated]');
  assert.strictEqual((writeTruncated.params as any).otherProp, 'keep');
  assert.strictEqual((writeTruncated.params as any).CodeContent, undefined);
  assert.strictEqual((writeTruncated.params as any).ReplacementChunks, undefined);
  assert.strictEqual((writeTruncated.params as any).ReplacementContent, undefined);
  assert.strictEqual((writeTruncated.params as any).TargetContent, undefined);

  // other preserves raw properties
  const other1 = standardizeAction('other', 'respond_to_user', { response: 'Done' });
  assertActionType(other1, 'other');
  assert.deepStrictEqual(other1.params, { response: 'Done' });
});

test('finalizeTrajectorySummary sorts steps monotonically and re-indexes with 1-based numbering', () => {
  const summary: TrajectorySummary = {
    agent: Agents.CLAUDE_CODE,
    steps: [
      {
        stepNumber: 99,
        timestamp: '2026-08-09T21:00:10.000Z',
        action: standardizeAction('other', 'respond_to_user')
      },
      {
        stepNumber: 99,
        timestamp: '2026-08-09T21:00:01.000Z',
        action: standardizeAction('run_command', 'bash', { command: 'npx modern-web-guidance search "dialog"' })
      },
      {
        stepNumber: 99,
        timestamp: '2026-08-09T21:00:05.000Z',
        action: standardizeAction('write_file', 'write_file', { path: 'index.html' })
      }
    ]
  };

  const finalized = finalizeTrajectorySummary(summary);
  assert.strictEqual(finalized.steps.length, 3);
  assert.strictEqual(finalized.steps[0].stepNumber, 1);
  assert.strictEqual(finalized.steps[0].timestamp, '2026-08-09T21:00:01.000Z');
  assert.strictEqual(finalized.steps[0].action?.name, 'bash');
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

    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'summary-guide-1'), true);
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'unrelated-guide'), false);
  } finally {
    removeTempDir(tempDir);
  }
});

test('hasTrajectoryGuideLeak ignores host node_modules and passive search result snippets', () => {
  const tempDir = createTempDir();
  try {
    // 1. Host node_modules path reference + unrelated mention of guideName -> false
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Checking dependencies for translator',
          action: {
            type: 'run_command',
            name: 'ls /usr/local/google/home/user/modern-web-guidance-src/node_modules/.pnpm',
            params: { command: 'ls /usr/local/google/home/user/modern-web-guidance-src/node_modules/.pnpm' }
          },
          outcome: { status: 'success', message: 'translator feature check' }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'translator'), false);

    // 2. Passive web-search result snippet (turn0search0) where URL is not opened -> false
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Searching web',
          action: { type: 'run_command', name: 'exec', params: { command: 'exec' } },
          outcome: {
            status: 'success',
            message: 'SMS OTP form verification | Modern Web Guidance | Chrome for Developers (https://developer.chrome.com/docs/modern-web-guidance/guides/forms/sms-otp-form)\n\uE200cite\uE202turn0search0\uE201 [wordlim: 200] Published: 4 weeks ago'
          }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'sms-otp-form'), false);

    // 3. Truncated GitHub search result snippet -> false
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Searching web',
          action: { type: 'run_command', name: 'exec', params: { command: 'exec' } },
          outcome: {
            status: 'success',
            message: 'Script completed\nOutput:\n\nmodern-web-guidance/skills/modern-web-guidance/guides/webmcp/agentic-javascript-tools.md at main · GoogleChrome/modern-web-guidance · GitHub (https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guid... [truncated]'
          }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'agentic-javascript-tools'), false);

    // 4. Opened guide page (turn1view0) -> true
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Opening guide',
          action: { type: 'run_command', name: 'exec', params: { command: 'exec' } },
          outcome: {
            status: 'success',
            message: 'Local Network Access | Modern Web Guidance | Chrome for Developers (https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)\n\uE200cite\uE202turn1view0\uE201 [wordlim: 200] Source: open({"ref_id":"https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access"})'
          }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'local-network-access'), true);

    // 5. Opened guide page (turn1view0) followed by search result (turn1search0) in same outcome -> true
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Opening guide and searching MDN',
          action: { type: 'run_command', name: 'exec', params: { command: 'exec' } },
          outcome: {
            status: 'success',
            message: '(https://raw.githubusercontent.com/GoogleChrome/modern-web-guidance/main/skills/modern-web-guidance/guides/performance/detect-initial-visibility-state.md)\n\uE200cite\uE202turn1view0\uE201 [wordlim: 200]\nMDN VisibilityState\n\uE200cite\uE202turn1search0\uE201 [wordlim: 200]'
          }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'detect-initial-visibility-state'), true);

    // 6. Search snippet body mentioning modern-web-guidance after \uE201 on the same line -> false
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Searching web',
          action: { type: 'run_command', name: 'exec', params: { command: 'exec' } },
          outcome: {
            status: 'success',
            message: 'SMS OTP | Modern Web Guidance (https://developer.chrome.com/docs/modern-web-guidance/guides/forms/sms-otp-form)\n\uE200cite\uE202turn0search0\uE201 [wordlim: 200] npx -y modern-web-guidance@latest retrieve sms-otp-form'
          }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'sms-otp-form'), false);

    // 7. Truncated developer.chrome.com snippet on a search_query-only webRuns step -> false
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Searching web for dialog',
          action: {
            type: 'other',
            name: 'exec',
            params: {
              value: 'text(await tools.web__run({search_query:[{q:"modern-web-guidance dialog"}],response_length:"short"}));',
              webRuns: ['tools.web__run({search_query:[{q:"modern-web-guidance dialog"}],response_length:"short"})']
            }
          },
          outcome: {
            status: 'success',
            message: 'MDN dialog\n\uE200cite\uE202turn0search0\uE201\nDialog | Modern Web Guidance | Chrome for Developers (https://developer.chrome.com/docs/modern-web-guidance/guides/html/dialog... [truncated]'
          }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'dialog'), false);

    // 8. Cross-step isolation: unrelated modern-web-guidance mention in step 1 + guideName in step 2 -> false
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Step 1',
          action: {
            type: 'run_command',
            name: 'curl https://developer.chrome.com/docs/modern-web-guidance/guides/css/other-guide',
            params: { command: 'curl https://developer.chrome.com/docs/modern-web-guidance/guides/css/other-guide' }
          },
          outcome: { status: 'success', message: 'other-guide content' }
        },
        {
          stepNumber: 2,
          thought: 'Implementing popover component',
          action: {
            type: 'run_command',
            name: 'rg popover src/',
            params: { command: 'rg popover src/' }
          },
          outcome: { status: 'success', message: 'src/popover.ts' }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'popover'), false);

    // 9. Checkout named modern-web-guidance (without -src) and Windows-escaped paths -> false
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Checking processes',
          action: {
            type: 'run_command',
            name: 'ps aux',
            params: { command: 'ps aux', winPath: 'C:\\node_modules\\bin' }
          },
          outcome: {
            status: 'success',
            message: '/Users/dev/modern-web-guidance/node_modules/.bin/codex translator'
          }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'translator'), false);

    // 10. retrievedGuides or fileReadGuides top-level arrays -> true
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      retrievedGuides: ['local-network-access'],
      steps: []
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'local-network-access'), true);

    // 11. write_file (apply_patch) citing a modern-web-guidance URL in README.md or index.html -> false
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Adding reference link to README',
          action: {
            type: 'write_file',
            name: 'apply_patch',
            params: {
              path: 'README.md',
              patch: '*** Begin Patch\n*** Update File: README.md\n+See https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access\n'
            }
          },
          outcome: { status: 'success', message: 'Script completed' }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'local-network-access'), false);

    // 12. run_command writing a file via heredoc (cat <<'EOF' > INP.md) citing a modern-web-guidance URL -> false
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Writing INP.md documentation',
          action: {
            type: 'run_command',
            name: "cat <<'EOF' > INP.md",
            params: {
              command: "cat <<'EOF' > INP.md\nSee [identifying INP causes](https://developer.chrome.com/docs/modern-web-guidance/guides/performance/identify-inp-causes).\nEOF"
            }
          },
          outcome: { status: 'success', message: 'Script completed\nOutput:\n{"exit_code":0,"output":""}' }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'identify-inp-causes'), false);

    // 13. Category directory collision (/guides/webmcp/agentic-javascript-tools when guideName is 'webmcp') -> false,
    // while matching the actual leaf guide (/guides/webmcp/webmcp) -> true
    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Opened a different guide under the webmcp category',
          action: {
            type: 'run_command',
            name: 'exec',
            params: {
              command: 'exec',
              webRuns: ['tools.web__run({open:[{ref_id:"https://developer.chrome.com/docs/modern-web-guidance/guides/webmcp/agentic-javascript-tools"}]})']
            }
          },
          outcome: { status: 'success', message: 'Script completed' }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'webmcp'), false);
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'agentic-javascript-tools'), true);

    writeTrajectorySummary(tempDir, {
      agent: Agents.CODEX_CLI,
      steps: [
        {
          stepNumber: 1,
          thought: 'Opened the webmcp discipline guide itself',
          action: {
            type: 'run_command',
            name: 'exec',
            params: {
              command: 'exec',
              webRuns: ['tools.web__run({open:[{ref_id:"https://developer.chrome.com/docs/modern-web-guidance/guides/webmcp/webmcp"}]})']
            }
          },
          outcome: { status: 'success', message: 'Script completed' }
        }
      ]
    });
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'webmcp'), true);
  } finally {
    removeTempDir(tempDir);
  }
});

test('generateNormalizedTrajectory dispatcher writes summary for given agent', async () => {
  const tempDir = createTempDir();
  try {
    const sessionLine = JSON.stringify({
      type: 'message',
      timestamp: '2026-08-09T21:00:00.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Looking up guide' },
          { type: 'toolCall', id: 'tc1', name: 'bash', arguments: { command: 'node modern-web.mjs retrieve container-queries' } }
        ]
      }
    });
    fs.writeFileSync(path.join(tempDir, 'session-101.jsonl'), sessionLine + '\n');

    await generateNormalizedTrajectory(tempDir, Agents.PI, 'Inspect code');

    const summaryPath = path.join(tempDir, TRAJECTORY_SUMMARY_FILE);
    assert.ok(fs.existsSync(summaryPath), 'trajectory_summary.json should be created by dispatcher');

    const summary = readTrajectorySummary(tempDir);
    assert.ok(summary);
    assert.strictEqual(summary.agent, Agents.PI);
    assert.strictEqual(summary.initialPrompt, 'Inspect code');
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].stepNumber, 1);
    assert.strictEqual(summary.steps[0].action?.name, 'bash');
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
  const chainedCmd = 'npx -y modern-web-guidance@latest retrieve cpp-on-the-web; head -n 40 index.html && npx -y modern-web-guidance@latest retrieve "identify-inp-causes, support-global-calendar-systems"';
  const spaceCmd = 'npx -y modern-web-guidance@latest retrieve accessible-generated-content 2d-panning > /tmp/mwg-guide.md 2>&1';
  const directNodeMjsCmd = 'node /tmp/env/.agents/skills/modern-web-guidance/modern-web.mjs retrieve color';
  const goJsonEscapedCmd = '{"CommandLine":"npx -y modern-web-guidance@latest retrieve \\"shadow-dom\\" \\u003e /tmp/mwg-guides.md \\u0026\\u0026 head -n 400 /tmp/mwg-guides.md","WaitMsBeforeAsync":5000,"toolSummary":"Retrieve web component guides"}';
  const legacyCmd = 'npx modern-web retrieve dialog-closedby';
  const searchCmd = 'npx modern-web-guidance search "retrieve password passkey"';
  const inlineGuideRef = 'For more information, see `accessibility` (via `npx -y modern-web-guidance@latest retrieve "accessibility"`).';
  const genericCmd = 'curl https://example.com/retrieve/docs && git retrieve-branch';

  // 1. Claude
  const claudeMeta = parseClaudeTrajectory([
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: validCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: chainedCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: spaceCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: directNodeMjsCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: goJsonEscapedCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: legacyCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: searchCmd } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: inlineGuideRef } }] } },
    { message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: genericCmd } }] } },
  ]);
  assert.deepStrictEqual(claudeMeta.retrievedGuides, ['dialog-closedby', 'light-dismiss', 'cpp-on-the-web', 'identify-inp-causes', 'support-global-calendar-systems', 'accessible-generated-content', '2d-panning', 'color', 'shadow-dom']);

  // 2. Codex
  const codexMeta = parseCodexTrajectory([
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: validCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: chainedCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: spaceCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: directNodeMjsCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: goJsonEscapedCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: legacyCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: searchCmd }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: inlineGuideRef }) } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd: genericCmd }) } },
  ]);
  assert.deepStrictEqual(codexMeta.retrievedGuides, ['dialog-closedby', 'light-dismiss', 'cpp-on-the-web', 'identify-inp-causes', 'support-global-calendar-systems', 'accessible-generated-content', '2d-panning', 'color', 'shadow-dom']);

  // 3. Pi
  const piMeta = parsePiTrajectory([
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: validCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: chainedCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: spaceCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: directNodeMjsCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: goJsonEscapedCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: legacyCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: searchCmd } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: inlineGuideRef } }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', name: 'bash', arguments: { command: genericCmd } }] } },
  ]);
  assert.deepStrictEqual(piMeta.retrievedGuides, ['dialog-closedby', 'light-dismiss', 'cpp-on-the-web', 'identify-inp-causes', 'support-global-calendar-systems', 'accessible-generated-content', '2d-panning', 'color', 'shadow-dom']);
});

test('ensureFreshTrajectorySummary regenerates stale trajectory_summary.json missing normalizerVersion when raw session logs exist', async () => {
  const {
    NORMALIZER_VERSION,
    ensureFreshTrajectorySummary
  } = await import('../lib/trajectory-normalizer.ts');

  const tempDir = createTempDir();
  try {
    // Write stale trajectory_summary.json without normalizerVersion and with outdated step categorization
    writeTrajectorySummary(tempDir, {
      agent: Agents.CLAUDE_CODE,
      initialPrompt: 'Preserve this prompt',
      steps: [
        {
          stepNumber: 1,
          action: {
            type: 'run_command',
            canonicalCategory: 'incidental_noise',
            name: 'Bash',
            params: { command: 'npx modern-web-guidance search "popover"' }
          }
        }
      ]
    });

    // Write raw session log (session-1.jsonl)
    const rawEntry = {
      role: 'assistant',
      timestamp: '2026-08-10T10:00:00.000Z',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'call_1',
            name: 'Bash',
            input: { command: 'npx modern-web-guidance search "popover"' }
          }
        ]
      }
    };
    fs.writeFileSync(path.join(tempDir, 'session-1.jsonl'), JSON.stringify(rawEntry));

    const refreshed = await ensureFreshTrajectorySummary(tempDir);
    assert.ok(refreshed);
    assert.strictEqual(refreshed.normalizerVersion, NORMALIZER_VERSION);
    assert.strictEqual(refreshed.initialPrompt, 'Preserve this prompt');
    assert.strictEqual(refreshed.steps.length, 1);
    assert.strictEqual(refreshed.steps[0].action?.canonicalCategory, 'skill_search');

    const onDisk = readTrajectorySummary(tempDir);
    assert.strictEqual(onDisk?.normalizerVersion, NORMALIZER_VERSION);
  } finally {
    removeTempDir(tempDir);
  }
});

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let v = value;
  while (v >= 0x80) {
    bytes.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  bytes.push(v);
  return Buffer.from(bytes);
}

function encodeLengthDelimited(fieldNumber: number, payload: Buffer): Buffer {
  const tag = (fieldNumber << 3) | 2;
  return Buffer.concat([encodeVarint(tag), encodeVarint(payload.length), payload]);
}

function encodeVarintField(fieldNumber: number, value: number): Buffer {
  const tag = (fieldNumber << 3) | 0;
  return Buffer.concat([encodeVarint(tag), encodeVarint(value)]);
}

test('parseJetskiCliSession and findProtoTimestamp recover step timestamps from SQLite protobuf metadata', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const {
    parseProtobuf,
    findProtoTimestamp,
    parseJetskiCliSession
  } = await import('../agents/jetski-cli-agent.ts');

  // 1754860800 seconds = 2025-08-10T21:20:00.000Z, 250000000 nanos = 250ms
  const timestampSubmsg = Buffer.concat([
    encodeVarintField(1, 1754860800),
    encodeVarintField(2, 250_000_000)
  ]);
  // Wrap inside outer metadata field 4
  const metadataBuf = encodeLengthDelimited(4, timestampSubmsg);

  const parsedMeta = parseProtobuf(metadataBuf);
  const extractedIso = findProtoTimestamp(parsedMeta);
  assert.strictEqual(extractedIso, '2025-08-10T21:20:00.250Z');

  // Also test full SQLite session db parsing without any timestamp column
  const tempDir = createTempDir();
  try {
    const dbPath = path.join(tempDir, 'session-jetski.db');
    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB)');
    const payloadJson = JSON.stringify({
      toolAction: 'Running command',
      toolSummary: 'Search web guidance',
      CommandLine: 'npx modern-web-guidance search "anchor positioning"'
    });
    const stmt = db.prepare('INSERT INTO steps (idx, step_type, status, metadata, step_payload) VALUES (?, ?, ?, ?, ?)');
    stmt.run(1, 1, 1, metadataBuf, Buffer.from(payloadJson, 'utf8'));
    db.close();

    const summary = parseJetskiCliSession(tempDir);
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].timestamp, '2025-08-10T21:20:00.250Z');
  } finally {
    removeTempDir(tempDir);
  }
});

test('extractSubagentIdFromFilename extracts clean subagent id across formats and prefixes', () => {
  assert.strictEqual(extractSubagentIdFromFilename('subagent-agent-worker-cdx.jsonl'), 'worker-cdx');
  assert.strictEqual(extractSubagentIdFromFilename('subagent-subagents-agent-worker-sub-1.jsonl'), 'worker-sub-1');
  assert.strictEqual(extractSubagentIdFromFilename('subagent-subagents-agent-subagent-array-456.jsonl'), 'subagent-array-456');
  assert.strictEqual(extractSubagentIdFromFilename('subagent-agent-worker-gem.json'), 'worker-gem');
  assert.strictEqual(extractSubagentIdFromFilename('subagent-subagents-worker.jsonl'), 'worker');
  assert.strictEqual(extractSubagentIdFromFilename('subagent-worker.jsonl'), 'worker');
  assert.strictEqual(extractSubagentIdFromFilename('/path/to/subagent-agent-worker.jsonl'), 'worker');
});

test('generateNormalizedTrajectory enriches summary with guides and tool usage from modern-web.log', async () => {
  const tempDir = createTempDir();
  try {
    const rawEntry = {
      role: 'assistant',
      timestamp: '2026-08-10T10:00:00.000Z',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'call_1',
            name: 'Bash',
            input: { command: 'ls -la' }
          }
        ]
      }
    };
    fs.writeFileSync(path.join(tempDir, 'session-1.jsonl'), JSON.stringify(rawEntry));
    fs.writeFileSync(
      path.join(tempDir, 'modern-web.log'),
      JSON.stringify({ tool: 'get_best_practices', result: [{ id: 'dialog-closedby' }, { id: 'popover-api' }] }) + '\n'
    );

    await generateNormalizedTrajectory(tempDir, Agents.CLAUDE_CODE, 'Enrich from log test');

    const summary = readTrajectorySummary(tempDir);
    assert.ok(summary);
    assert.deepStrictEqual(summary.retrievedGuides, ['dialog-closedby', 'popover-api']);
    assert.deepStrictEqual(summary.toolsUsed, ['modern-web-guidance']);
  } finally {
    removeTempDir(tempDir);
  }
});

test('parseJetskiCliSession extracts observed reasoning effort from gen_metadata display names without altering model extraction', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { parseJetskiCliSession } = await import('../agents/jetski-cli-agent.ts');

  const geminiDir = createTempDir();
  const claudeDir = createTempDir();
  try {
    const geminiDb = new DatabaseSync(path.join(geminiDir, 'session-1.db'));
    geminiDb.exec('CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB)');
    geminiDb.exec('CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB)');
    const geminiDisplayBuf = encodeLengthDelimited(1, Buffer.from('Gemini 4 Argon (High)|extra', 'utf8'));
    geminiDb.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)').run(1, geminiDisplayBuf);
    geminiDb.close();

    const geminiSummary = parseJetskiCliSession(geminiDir);
    assert.strictEqual(geminiSummary.model, 'Gemini 4 Argon (High)');
    assert.deepStrictEqual(geminiSummary.reasoningEffort, { level: 'high', source: 'observed' });

    const claudeDb = new DatabaseSync(path.join(claudeDir, 'session-1.db'));
    claudeDb.exec('CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB)');
    claudeDb.exec('CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB)');
    const claudeDisplayBuf = encodeLengthDelimited(1, Buffer.from('Claude Fable 5.1 (Max)', 'utf8'));
    claudeDb.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)').run(1, claudeDisplayBuf);
    claudeDb.close();

    const claudeSummary = parseJetskiCliSession(claudeDir);
    assert.strictEqual(claudeSummary.model, 'unknown');
    assert.deepStrictEqual(claudeSummary.reasoningEffort, { level: 'max', source: 'observed' });

    // Live agy / jetski gen_metadata where 1.21 (model_display_name) is omitted,
    // 1.19 (chat_model.response_model) = "gemini-3.8-flash", and 3.28 (planner_config.model_name) = "gemini-3.8-flash-high"
    const nestedDir = createTempDir();
    try {
      const nestedDb = new DatabaseSync(path.join(nestedDir, 'session-1.db'));
      nestedDb.exec('CREATE TABLE steps (idx INTEGER PRIMARY KEY, step_type INTEGER, status INTEGER, metadata BLOB, step_payload BLOB)');
      nestedDb.exec('CREATE TABLE gen_metadata (idx INTEGER PRIMARY KEY, data BLOB)');
      const chatModelMsg = Buffer.concat([
        encodeLengthDelimited(1, Buffer.from('Gemini system prompt hint that should not shadow 1.19', 'utf8')),
        encodeLengthDelimited(19, Buffer.from('gemini-3.8-flash', 'utf8')),
      ]);
      const plannerConfigMsg = encodeLengthDelimited(28, Buffer.from('gemini-3.8-flash-high', 'utf8'));
      const genMetaBuf = Buffer.concat([
        encodeLengthDelimited(1, chatModelMsg),
        encodeLengthDelimited(3, plannerConfigMsg),
      ]);
      nestedDb.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)').run(1, genMetaBuf);
      nestedDb.close();

      const nestedSummary = parseJetskiCliSession(nestedDir);
      assert.strictEqual(nestedSummary.model, 'gemini-3.8-flash');
      assert.deepStrictEqual(nestedSummary.reasoningEffort, { level: 'high', source: 'observed' });
    } finally {
      removeTempDir(nestedDir);
    }
  } finally {
    removeTempDir(geminiDir);
    removeTempDir(claudeDir);
  }
});

test('parseClaudeTrajectory extracts observed reasoning effort from main-session api-request output_config', async () => {
  const { parseClaudeTrajectory } = await import('../agents/claude-code-agent.ts');

  const summary = parseClaudeTrajectory(
    [
      {
        type: 'api-request',
        params: {
          model: 'claude-opus-5-5',
          output_config: { effort: 'Medium' },
        },
      },
      {
        type: 'api-request',
        isSidechain: true,
        params: {
          model: 'claude-haiku-4-5',
          output_config: { effort: 'low' },
        },
      },
      {
        role: 'assistant',
        message: {
          model: 'claude-opus-5-5',
          content: [{ type: 'text', text: 'Done' }],
        },
      },
    ],
    {
      sub1: [
        {
          type: 'api-request',
          params: {
            model: 'claude-haiku-4-5',
            output_config: { effort: 'low' },
          },
        },
      ],
    },
  );
  assert.strictEqual(summary.model, 'claude-opus-5-5');
  assert.deepStrictEqual(summary.reasoningEffort, { level: 'medium', source: 'observed' });

  const assistantSummary = parseClaudeTrajectory([
    {
      type: 'assistant',
      effort: 'medium',
      message: {
        id: 'msg_1',
        model: 'claude-sonnet-5-5',
        content: [{ type: 'text', text: 'Done' }],
      },
    },
    {
      type: 'assistant',
      isSidechain: true,
      effort: 'low',
      message: {
        id: 'msg_2',
        model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: 'Sidechain' }],
      },
    },
  ]);
  assert.strictEqual(assistantSummary.model, 'claude-sonnet-5-5');
  assert.deepStrictEqual(assistantSummary.reasoningEffort, { level: 'medium', source: 'observed' });
});

test('parsePiTrajectory extracts observed thinking_level_change and offline regeneration preserves configured effort', async () => {
  const { parsePiTrajectory } = await import('../agents/pi-agent.ts');
  const { ensureFreshTrajectorySummary, finalizeTrajectorySummary } = await import('./trajectory-normalizer.ts');

  const piSummary = parsePiTrajectory([
    { type: 'thinking_level_change', thinkingLevel: 'Medium' },
    {
      type: 'message',
      message: {
        model: 'deepseek/deepseek-v4.1-flash',
        role: 'assistant',
        content: [{ type: 'text', text: 'Done' }],
      },
    },
  ]);
  assert.deepStrictEqual(piSummary.reasoningEffort, { level: 'medium', source: 'observed' });

  const finalizedTiered = finalizeTrajectorySummary({
    agent: Agents.ANTIGRAVITY_CLI,
    model: 'gemini-3.8-flash-medium',
    steps: [],
  });
  assert.deepStrictEqual(finalizedTiered.reasoningEffort, { level: 'medium', source: 'model-id' });

  const tempDir = createTempDir();
  const prevClaudeEffort = process.env.CLAUDE_EFFORT;
  delete process.env.CLAUDE_EFFORT;
  try {
    // Simulate a summary originally recorded with CLAUDE_EFFORT=high, then re-normalized offline when env is gone.
    writeTrajectorySummary(tempDir, {
      normalizerVersion: 4,
      agent: Agents.CLAUDE_CODE,
      model: 'claude-sonnet-5-5',
      reasoningEffort: { level: 'high', source: 'configured' },
      steps: [
        {
          stepNumber: 1,
          action: { type: 'run_command', name: 'Bash', params: { command: 'ls' } },
        },
      ],
    });
    fs.writeFileSync(
      path.join(tempDir, 'session-1.jsonl'),
      JSON.stringify({
        role: 'assistant',
        timestamp: '2026-08-10T10:00:00.000Z',
        message: {
          model: 'claude-sonnet-5-5',
          content: [{ type: 'tool_use', id: 'c1', name: 'Bash', input: { command: 'ls' } }],
        },
      }) + '\n',
      'utf8',
    );

    const refreshed = await ensureFreshTrajectorySummary(tempDir);
    assert.ok(refreshed);
    assert.deepStrictEqual(refreshed.reasoningEffort, { level: 'high', source: 'configured' });

    // Also verify that an ambient process.env.CLAUDE_EFFORT = 'low' does NOT leak into offline
    // v4 -> v5 re-normalization of a historical summary without observed effort.
    process.env.CLAUDE_EFFORT = 'low';
    writeTrajectorySummary(tempDir, {
      normalizerVersion: 4,
      agent: Agents.CLAUDE_CODE,
      model: 'claude-sonnet-5-5',
      steps: [
        {
          stepNumber: 1,
          action: { type: 'run_command', name: 'Bash', params: { command: 'ls' } },
        },
      ],
    });
    const refreshedWithAmbientEnv = await ensureFreshTrajectorySummary(tempDir);
    assert.ok(refreshedWithAmbientEnv);
    assert.deepStrictEqual(refreshedWithAmbientEnv.reasoningEffort, { source: 'agent-default' });
  } finally {
    if (prevClaudeEffort === undefined) delete process.env.CLAUDE_EFFORT;
    else process.env.CLAUDE_EFFORT = prevClaudeEffort;
    removeTempDir(tempDir);
  }
});



