import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  generateNormalizedTrajectory,
  collectCodexGuidesFromTrajectory,
  collectCodexToolsFromTrajectory,
  extractCodexCliModel,
  extractCodexCliTokenUsage,
  writeTrajectorySummary
} from '../lib/trajectory-normalizer.ts';
import { hasTrajectoryGuideLeak } from '../lib/guide-usage.ts';
import {
  ensureFreshHostCodexAuth,
  extractCommandsFromCodexItem,
  extractWebRunsFromCodexItem,
  parseCodexTrajectory
} from './codex-cli-agent.ts';
import { extractModelFromResults, extractReasoningEffortFromResults } from '../lib/collection.ts';
import { Agents } from '../config.ts';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codex-parsing-test-'));
}

function removeTempDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

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

  // 5. Code mode with direct string argument (positional string parameter)
  const cmd5 = extractCommandsFromCodexItem({
    payload: {
      type: 'custom_tool_call',
      input: 'const r = await tools.exec_command("pnpm test");'
    }
  });
  assert.deepStrictEqual(cmd5, ['pnpm test']);

  // 6. Responses API local_shell_call
  const cmd6 = extractCommandsFromCodexItem({
    payload: {
      type: 'local_shell_call',
      action: {
        type: 'exec',
        command: ['bash', '-c', 'git status --short']
      }
    }
  });
  assert.deepStrictEqual(cmd6, ['git status --short']);

  // 7. apply_patch should NOT be treated as a shell command
  const cmd7 = extractCommandsFromCodexItem({
    payload: {
      type: 'custom_tool_call',
      name: 'apply_patch',
      input: '*** Begin Patch\n*** File: src/index.ts\n-cmd: old\n+cmd: new'
    }
  });
  assert.deepStrictEqual(cmd7, []);

  // 8. exec tool call with array command argument
  const cmd8 = extractCommandsFromCodexItem({
    payload: {
      type: 'function_call',
      name: 'exec',
      arguments: JSON.stringify({ command: ['npm', 'test'] })
    }
  });
  assert.deepStrictEqual(cmd8, ['npm test']);
});

test('Codex CLI normalization with commentary, response items, and subagent inlining', async () => {
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
    assert.strictEqual(summary.steps[0].action?.params?.command, 'cat index.html');
    assert.strictEqual(summary.steps[0].outcome?.status, 'success');

    // Step 2: subagent npm test (20:30:05)
    assert.strictEqual(summary.steps[1].stepNumber, 2);
    assert.strictEqual(summary.steps[1].timestamp, '2026-08-09T20:30:05.000Z');
    assert.strictEqual(summary.steps[1].subagentId, 'worker-cdx');
    assert.strictEqual(summary.steps[1].thought, 'Subagent running tests');
    assert.strictEqual(summary.steps[1].action?.name, 'npm test');
    assert.strictEqual(summary.steps[1].action?.type, 'run_command');
    assert.strictEqual(summary.steps[1].action?.params?.command, 'npm test');
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

test('Codex CLI normalization with modern custom_tool_call exec_command', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-08-17T18:50:00.000Z',
        payload: {
          type: 'agent_message',
          phase: 'commentary',
          message: 'Retrieving guideline'
        }
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-08-17T18:50:01.000Z',
        payload: {
          type: 'custom_tool_call',
          call_id: 'call_custom_1',
          name: 'exec',
          input: 'const r = await tools.exec_command({"cmd":"npx -y modern-web-guidance@latest retrieve \\"dialog-focus-management\\""}); text(r.output);'
        }
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-08-17T18:50:02.000Z',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'call_custom_1',
          output: 'Retrieved guide dialog-focus-management'
        }
      }),
      JSON.stringify({
        type: 'turn_context',
        payload: { model: 'gpt-5.6-sol' }
      }),
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: {
              total_tokens: 1200,
              cached_input_tokens: 300
            }
          }
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-custom.jsonl'), lines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CODEX_CLI, 'Add focus management');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath));

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.agent, Agents.CODEX_CLI);
    assert.strictEqual(summary.model, 'gpt-5.6-sol');
    assert.deepStrictEqual(summary.tokenUsage, { total: 1200, cached: 300 });
    assert.deepStrictEqual(summary.retrievedGuides, ['dialog-focus-management']);
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].action?.type, 'run_command');
    assert.strictEqual(summary.steps[0].action?.canonicalCategory, 'guide_retrieval');
    assert.strictEqual(summary.steps[0].outcome?.status, 'success');
  } finally {
    removeTempDir(tempDir);
  }
});

test('Codex CLI handles array-structured output blocks in tool outputs', () => {
  const rollout = [
    {
      type: 'response_item',
      payload: {
        type: 'function_call',
        call_id: 'call_arr_1',
        name: 'exec',
        arguments: JSON.stringify({ command: 'node test.js' })
      }
    },
    {
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        call_id: 'call_arr_1',
        output: [
          { type: 'input_text', text: 'Script completed\nWall time 0.1s\nOutput:\n' },
          { type: 'input_text', text: 'All checks passed.' }
        ]
      }
    }
  ];

  const summary = parseCodexTrajectory(rollout);
  assert.strictEqual(summary.steps.length, 1);
  assert.strictEqual(summary.steps[0].outcome?.status, 'success');
  assert.ok(summary.steps[0].outcome?.message?.includes('All checks passed.'));
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

    const guides = await collectCodexGuidesFromTrajectory(tempDir);
    assert.deepStrictEqual(guides.retrievedGuides, ['visually-texture-content', 'complex-shapes']);
    assert.deepStrictEqual(guides.fileReadGuides, ['size-aware-styling']);

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

    const guides = await collectCodexGuidesFromTrajectory(tempDir);
    assert.deepStrictEqual(guides.retrievedGuides, ['validate-input-after-interaction', 'accessible-error-announcement']);
    assert.deepStrictEqual(guides.fileReadGuides, ['validate-input-after-interaction']);

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
test('Codex CLI normalization handles Responses API array output and extracts model', async () => {
  const tempDir = createTempDir();
  try {
    const lines = [
      JSON.stringify({
        type: 'turn_context',
        payload: { model: 'gpt-5.6-sol' }
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'custom_tool_call',
          call_id: 'call_array_1',
          name: 'exec',
          input: 'const r = await tools.exec_command({"cmd":"cat index.html"}); text(r.output);'
        }
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'call_array_1',
          output: [
            {
              type: 'input_text',
              text: 'Script completed\nWall time 0.1 seconds\nOutput:\n<html><body>Hello</body></html>'
            }
          ]
        }
      }),
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: {
              total_tokens: 2500,
              cached_input_tokens: 1000
            }
          }
        }
      })
    ];

    fs.writeFileSync(path.join(tempDir, 'session-responses-api.jsonl'), lines.join('\n'));

    await generateNormalizedTrajectory(tempDir, Agents.CODEX_CLI, 'Check index.html');

    const summaryPath = path.join(tempDir, 'trajectory_summary.json');
    assert.ok(fs.existsSync(summaryPath), 'trajectory_summary.json must be generated');

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    assert.strictEqual(summary.model, 'gpt-5.6-sol');
    assert.strictEqual(summary.steps.length, 1);
    assert.strictEqual(summary.steps[0].outcome?.status, 'success');
    assert.ok(summary.steps[0].outcome?.message?.includes('Script completed'));

    // Verify extractModelFromResults from collection.ts
    const extractedModel = extractModelFromResults(tempDir);
    assert.strictEqual(extractedModel, 'gpt-5.6-sol');
  } finally {
    removeTempDir(tempDir);
  }
});

test('parseCodexTrajectory handles structured array of content blocks in function_call_output', () => {
  const rollout = [
    {
      type: 'response_item',
      payload: {
        type: 'function_call',
        call_id: 'call_content_blocks',
        name: 'exec',
        arguments: JSON.stringify({ command: ['cat', 'package.json'] })
      }
    },
    {
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        call_id: 'call_content_blocks',
        output: [
          { type: 'input_text', text: 'Script completed\nOutput:\n' },
          { type: 'input_text', text: '{\n  "name": "test-app"\n}\n' }
        ]
      }
    }
  ];

  const summary = parseCodexTrajectory(rollout);
  assert.strictEqual(summary.steps.length, 1);
  assert.strictEqual(summary.steps[0].action?.type, 'run_command');
  assert.strictEqual(summary.steps[0].action?.name, 'cat package.json');
  assert.strictEqual(summary.steps[0].outcome?.status, 'success');
  assert.strictEqual(summary.steps[0].outcome?.message?.includes('"name": "test-app"'), true);
});

test('parseCodexTrajectory does not flag tool output containing "error:" substring as failure', () => {
  const rollout = [
    {
      type: 'response_item',
      payload: {
        type: 'function_call',
        call_id: 'call_view_error_file',
        name: 'exec',
        arguments: JSON.stringify({ command: 'cat index.html' })
      }
    },
    {
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        call_id: 'call_view_error_file',
        output: [
          { type: 'input_text', text: 'Script completed\nWall time 0.1s\nOutput:\n' },
          { type: 'input_text', text: '<p class="error">Error: Please enter a valid date</p>' }
        ]
      }
    }
  ];

  const summary = parseCodexTrajectory(rollout);
  assert.strictEqual(summary.steps.length, 1);
  assert.strictEqual(summary.steps[0].outcome?.status, 'success');
});

test('parseCodexTrajectory recognizes real Script failed as error', () => {
  const rollout = [
    {
      type: 'response_item',
      payload: {
        type: 'function_call',
        call_id: 'call_fail',
        name: 'exec',
        arguments: JSON.stringify({ command: 'node invalid.js' })
      }
    },
    {
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        call_id: 'call_fail',
        output: [
          { type: 'input_text', text: 'Script failed\nWall time 0.0s\nOutput:\n' },
          { type: 'input_text', text: 'Script error:\nSyntaxError: Unexpected token' }
        ]
      }
    }
  ];

  const summary = parseCodexTrajectory(rollout);
  assert.strictEqual(summary.steps.length, 1);
  assert.strictEqual(summary.steps[0].outcome?.status, 'error');
});

test('parseCodexTrajectory parses code-mode patch calls as write_file', () => {
  const rollout = [
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        call_id: 'call_patch_1',
        name: 'exec',
        input: 'const patch = "*** Begin Patch\\n*** Update File: src/App.tsx\\n@@\\n- const a = 1;\\n+ const a = 2;\\n";'
      }
    },
    {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call_output',
        call_id: 'call_patch_1',
        output: 'Script completed\nOutput:\n'
      }
    }
  ];

  const summary = parseCodexTrajectory(rollout);
  assert.strictEqual(summary.steps.length, 1);
  assert.strictEqual(summary.steps[0].action?.type, 'write_file');
  assert.strictEqual(summary.steps[0].action?.name, 'apply_patch');
  assert.strictEqual(summary.steps[0].action?.canonicalCategory, 'code_mutation');
  assert.strictEqual((summary.steps[0].action?.params as any)?.path, 'src/App.tsx');
  assert.strictEqual(summary.steps[0].outcome?.status, 'success');
});

test('parseCodexTrajectory extracts token usage from token_usage_record entries', () => {
  const rollout = [
    {
      type: 'token_usage_record',
      payload: {
        thread_id: 'thread_1',
        turn_id: 'turn_1',
        session_id: 'sess_1',
        thread_token_usage: {
          input_tokens: 400,
          cached_input_tokens: 150,
          output_tokens: 50,
          reasoning_output_tokens: 10,
          total_tokens: 450
        }
      }
    }
  ];

  const summary = parseCodexTrajectory(rollout);
  assert.deepStrictEqual(summary.tokenUsage, { total: 450, cached: 150 });
});

function makeFakeJwt(expSeconds: number): string {
  const b64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64({ alg: 'RS256' })}.${b64({ exp: expSeconds })}.sig`;
}

test('ensureFreshHostCodexAuth skips fresh tokens and rotates expiring tokens in-place', async () => {
  const tempDir = createTempDir();
  try {
    const authPath = path.join(tempDir, 'auth.json');
    const nowSec = Math.floor(Date.now() / 1000);
    const writeAuth = (expOffsetSec: number, refreshAgeDays: number, refreshToken = 'rt_old') =>
      fs.writeFileSync(authPath, JSON.stringify({
        auth_mode: 'chatgpt',
        tokens: { access_token: makeFakeJwt(nowSec + expOffsetSec), refresh_token: refreshToken, account_id: 'acc_1' },
        last_refresh: new Date(Date.now() - refreshAgeDays * 86400_000).toISOString()
      }));

    // 1. Fresh token (9d remaining, refreshed 1h ago) -> no-op
    writeAuth(9 * 86400, 1 / 24, 'rt_fresh');
    let fetchCalls = 0;
    const skipped = await ensureFreshHostCodexAuth(authPath, (async () => {
      fetchCalls++;
      throw new Error('Should not fetch when fresh');
    }) as unknown as typeof fetch);
    assert.strictEqual(skipped, false);
    assert.strictEqual(fetchCalls, 0);

    // 2. Expiring token (12h remaining, refreshed 9d ago) -> refreshes once and updates auth.json
    writeAuth(12 * 3600, 9, 'rt_old');
    const newAccessJwt = makeFakeJwt(nowSec + 10 * 86400);
    const mockFetch = (async (_url: string, init?: RequestInit) => {
      fetchCalls++;
      assert.strictEqual(JSON.parse(String(init?.body)).refresh_token, 'rt_old');
      return new Response(JSON.stringify({ id_token: 'id_new', access_token: newAccessJwt, refresh_token: 'rt_new' }));
    }) as unknown as typeof fetch;

    const [r1, r2] = await Promise.all([
      ensureFreshHostCodexAuth(authPath, mockFetch),
      ensureFreshHostCodexAuth(authPath, mockFetch)
    ]);
    assert.deepStrictEqual([r1, r2, fetchCalls], [true, true, 1]);

    const saved = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    assert.deepStrictEqual(saved.tokens, {
      access_token: newAccessJwt,
      refresh_token: 'rt_new',
      id_token: 'id_new',
      account_id: 'acc_1'
    });
  } finally {
    removeTempDir(tempDir);
  }
});

test('parseCodexTrajectory preserves tools.web__run calls when batched with exec_command', () => {
  const input = [
    'text(await tools.web__run({search_query:[{q:"CSS @supports at-rule() syntax @layer"}],response_length:"short"}));',
    'text(await tools.exec_command({cmd:"git status --short","max_output_tokens":1000}));',
    'text(await tools.web__run({open:[{ref_id:"https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access"}],response_length:"short"}));'
  ].join(' ');

  const item = {
    type: 'response_item',
    payload: {
      type: 'custom_tool_call',
      call_id: 'call_batched_1',
      name: 'exec',
      input
    }
  };

  const webRuns = extractWebRunsFromCodexItem(item);
  assert.deepStrictEqual(webRuns, [
    'tools.web__run({search_query:[{q:"CSS @supports at-rule() syntax @layer"}],response_length:"short"})',
    'tools.web__run({open:[{ref_id:"https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access"}],response_length:"short"})'
  ]);

  const summary = parseCodexTrajectory([item]);
  assert.strictEqual(summary.steps.length, 1);
  assert.strictEqual(summary.steps[0].action?.type, 'run_command');
  assert.strictEqual(summary.steps[0].action?.name, 'git status --short');
  assert.deepStrictEqual(summary.steps[0].action?.params, {
    command: 'git status --short',
    webRuns
  });

  const multiCmdItem = {
    type: 'response_item',
    payload: {
      type: 'custom_tool_call',
      call_id: 'call_batched_2',
      name: 'exec',
      input: [
        'text(await tools.exec_command({cmd:"pwd"}));',
        'text(await tools.exec_command({cmd:"ls -la"}));'
      ].join(' ')
    }
  };
  const multiSummary = parseCodexTrajectory([multiCmdItem]);
  assert.deepStrictEqual(multiSummary.steps[0].action?.params, {
    command: 'pwd',
    commands: ['pwd', 'ls -la']
  });

  // Standalone tools.web__run call (no exec_command) also attaches params.webRuns
  const standaloneWebItem = {
    type: 'response_item',
    payload: {
      type: 'custom_tool_call',
      call_id: 'call_standalone_web',
      name: 'exec',
      input: 'text(await tools.web__run({search_query:[{q:"HTML in canvas"}],response_length:"short"}));\n'
    }
  };
  const standaloneSummary = parseCodexTrajectory([standaloneWebItem]);
  assert.strictEqual(standaloneSummary.steps.length, 1);
  assert.strictEqual(standaloneSummary.steps[0].action?.type, 'other');
  assert.deepStrictEqual(standaloneSummary.steps[0].action?.params, {
    value: 'text(await tools.web__run({search_query:[{q:"HTML in canvas"}],response_length:"short"}));\n',
    webRuns: ['tools.web__run({search_query:[{q:"HTML in canvas"}],response_length:"short"})']
  });

  // Non-code_mode web_search_call items are recorded in trajectory steps
  const webSearchItem = {
    type: 'response_item',
    payload: {
      type: 'web_search_call',
      id: 'ws_1',
      status: 'completed',
      action: {
        type: 'open_page',
        url: 'https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access'
      }
    }
  };
  const wsSummary = parseCodexTrajectory([webSearchItem]);
  assert.strictEqual(wsSummary.steps.length, 1);
  assert.strictEqual(wsSummary.steps[0].action?.name, 'web_search');
  assert.deepStrictEqual(wsSummary.steps[0].action?.params, {
    type: 'open_page',
    url: 'https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access'
  });

  // Failed open calls ("Failed to fetch <url>" or "URL <url> is not accessible") keep action.params intact,
  // record failedOpenUrls, and do not trigger hasTrajectoryGuideLeak end-to-end (including when batched with search_query)
  const failedOpenCall = {
    type: 'response_item',
    payload: {
      type: 'custom_tool_call',
      call_id: 'call_failed_open',
      name: 'exec',
      input: 'text(await tools.web__run({open:[{ref_id:"https://developer.chrome.com/docs/modern-web-guidance/guides/js/support-global-calendar-systems"}],response_length:"long"}));'
    }
  };
  const failedOpenOutput = {
    type: 'response_item',
    payload: {
      type: 'custom_tool_call_output',
      call_id: 'call_failed_open',
      output: [
        {
          type: 'input_text',
          text: 'Internal Error ()\nSource: open({"ref_id":"https://developer.chrome.com/docs/modern-web-guidance/guides/js/support-global-calendar-systems","lineno":null}); \nFailed to fetch https://developer.chrome.com/docs/modern-web-guidance/guides/js/support-global-calendar-systems: Cache miss'
        }
      ]
    }
  };
  const failedOpenSummary = parseCodexTrajectory([failedOpenCall, failedOpenOutput]);
  assert.strictEqual(failedOpenSummary.steps.length, 1);
  assert.deepStrictEqual(failedOpenSummary.steps[0].action?.params?.webRuns, [
    'tools.web__run({open:[{ref_id:"https://developer.chrome.com/docs/modern-web-guidance/guides/js/support-global-calendar-systems"}],response_length:"long"})'
  ]);
  assert.deepStrictEqual(failedOpenSummary.steps[0].action?.params?.failedOpenUrls, [
    'https://developer.chrome.com/docs/modern-web-guidance/guides/js/support-global-calendar-systems'
  ]);

  const tempDir = createTempDir();
  try {
    writeTrajectorySummary(tempDir, failedOpenSummary);
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'support-global-calendar-systems'), false);

    // Batched step combining a search_query with a failed open on the target guide
    const batchedCall = {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call',
        call_id: 'call_batched_failed_open',
        name: 'exec',
        input: [
          'const s = await tools.web__run({search_query:[{q:"Intl Temporal calendars"}]});',
          'const p = await tools.web__run({open:[{ref_id:"https://developer.chrome.com/docs/modern-web-guidance/guides/js/support-global-calendar-systems"}]});',
          'text(s + p);'
        ].join('\n')
      }
    };
    const batchedOutput = {
      type: 'response_item',
      payload: {
        type: 'custom_tool_call_output',
        call_id: 'call_batched_failed_open',
        output: [
          {
            type: 'input_text',
            text: [
              'Support global calendar systems | Modern Web Guidance (https://developer.chrome.com/docs/modern-web-guidance/guides/js/support-global-calendar-systems)\n\uE200cite\uE202turn0search0\uE201Snippet text',
              'Internal Error ()\nSource: open({"ref_id":"https://developer.chrome.com/docs/modern-web-guidance/guides/js/support-global-calendar-systems","lineno":null}); \nURL https://developer.chrome.com/docs/modern-web-guidance/guides/js/support-global-calendar-systems is not accessible'
            ].join('\n')
          }
        ]
      }
    };
    const batchedSummary = parseCodexTrajectory([batchedCall, batchedOutput]);
    writeTrajectorySummary(tempDir, batchedSummary);
    assert.strictEqual(hasTrajectoryGuideLeak(tempDir, 'support-global-calendar-systems'), false);
  } finally {
    removeTempDir(tempDir);
  }
});

test('parseCodexTrajectory extracts observed reasoning_effort from main turn_context and ignores subagent overrides', () => {
  const mainEntries = [
    {
      type: 'turn_context',
      timestamp: '2026-10-01T12:00:00.000Z',
      payload: {
        cwd: '/tmp/work',
        approval_policy: 'never',
        sandbox_policy: 'danger-full-access',
        model: 'gpt-6.1-sol',
        reasoning_effort: 'High',
      },
    },
    {
      type: 'response_item',
      timestamp: '2026-10-01T12:00:01.000Z',
      payload: {
        type: 'function_call',
        call_id: 'call_main_1',
        name: 'exec_command',
        arguments: JSON.stringify({ cmd: 'ls' }),
      },
    },
  ];
  const subagentEntries = [
    {
      type: 'turn_context',
      timestamp: '2026-10-01T12:00:02.000Z',
      payload: {
        cwd: '/tmp/work',
        approval_policy: 'never',
        sandbox_policy: 'danger-full-access',
        model: 'gpt-6.1-mini',
        reasoning_effort: 'low',
      },
    },
    {
      type: 'response_item',
      timestamp: '2026-10-01T12:00:03.000Z',
      payload: {
        type: 'function_call',
        call_id: 'call_sub_1',
        name: 'exec_command',
        arguments: JSON.stringify({ cmd: 'cat README.md' }),
      },
    },
  ];

  const summary = parseCodexTrajectory(mainEntries, { 'worker-1': subagentEntries });
  assert.deepStrictEqual(summary.reasoningEffort, { level: 'high', source: 'observed' });

  // Also supports nested collaboration_mode.settings.reasoning_effort
  const collabSummary = parseCodexTrajectory([
    {
      type: 'turn_context',
      payload: {
        cwd: '/tmp/work',
        approval_policy: 'never',
        sandbox_policy: 'danger-full-access',
        model: 'gpt-6.1-sol',
        collaboration_mode: {
          mode: 'default',
          settings: { reasoning_effort: 'xhigh' },
        },
      },
    },
  ]);
  assert.deepStrictEqual(collabSummary.reasoningEffort, { level: 'xhigh', source: 'observed' });
});

test('extractReasoningEffortFromResults upgrades historical v4 Codex summaries using raw rollout logs', () => {
  const tempDir = createTempDir();
  try {
    writeTrajectorySummary(tempDir, {
      normalizerVersion: 4,
      agent: Agents.CODEX_CLI,
      model: 'gpt-6.1-sol',
      steps: [
        {
          stepNumber: 1,
          action: { type: 'run_command', name: 'ls', params: { command: 'ls' } },
        },
      ],
    });
    fs.writeFileSync(
      path.join(tempDir, 'session-rollout.jsonl'),
      [
        JSON.stringify({
          type: 'turn_context',
          timestamp: '2026-10-01T12:00:00.000Z',
          payload: {
            cwd: '/tmp/work',
            approval_policy: 'never',
            sandbox_policy: 'danger-full-access',
            model: 'gpt-6.1-sol',
            reasoning_effort: 'high',
          },
        }),
        JSON.stringify({
          type: 'response_item',
          timestamp: '2026-10-01T12:00:01.000Z',
          payload: {
            type: 'function_call',
            call_id: 'call_1',
            name: 'exec_command',
            arguments: JSON.stringify({ cmd: 'ls' }),
          },
        }),
      ].join('\n') + '\n',
      'utf8',
    );

    const extracted = extractReasoningEffortFromResults(tempDir);
    assert.deepStrictEqual(extracted, { level: 'high', source: 'observed' });
  } finally {
    removeTempDir(tempDir);
  }
});
