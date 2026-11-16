import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DETECTED_AGENT_ENV_VARS, determineAgent, KNOWN_AGENTS } from './detect-agent.ts';

const noFs = () => false;

describe('determineAgent', () => {
  test('returns isAgent: false when no signals are set', () => {
    assert.deepStrictEqual(determineAgent({}, noFs, false), { isAgent: false, agent: undefined });
    assert.deepStrictEqual(
      determineAgent({ CLAUDE_CODE: '', GEMINI_CLI: '   ' }, noFs, false),
      { isAgent: false, agent: undefined },
    );
  });

  test('ignores Cursor IDE terminal trace id unless strong Cursor agent markers are present', () => {
    for (const isTTY of [true, false]) {
      assert.deepStrictEqual(
        determineAgent({ CURSOR_TRACE_ID: 'xyz-123' }, noFs, isTTY),
        { isAgent: false, agent: undefined },
      );
    }

    assert.strictEqual(
      determineAgent({ CURSOR_TRACE_ID: 'xyz-123', CURSOR_EXTENSION_HOST_ROLE: 'agent-exec' }, noFs, true).agent?.name,
      KNOWN_AGENTS.CURSOR_CLI,
    );
    assert.deepStrictEqual(
      determineAgent({ CURSOR_EXTENSION_HOST_ROLE: 'worker' }, noFs, false),
      { isAgent: false, agent: undefined },
    );
    assert.strictEqual(
      determineAgent({ CURSOR_AGENT: '1' }, noFs, true).agent?.name,
      KNOWN_AGENTS.CURSOR_CLI,
    );
    assert.strictEqual(
      determineAgent({ CURSOR_TRACE_ID: 'xyz-123', CLAUDECODE: '1' }, noFs, true).agent?.name,
      KNOWN_AGENTS.CLAUDE,
    );
  });

  test('detects strong agent environment markers with expected precedence', () => {
    const cases: Array<[NodeJS.ProcessEnv, string]> = [
      [{ CLAUDECODE: '1' }, KNOWN_AGENTS.CLAUDE],
      [{ CLAUDE_CODE: '1' }, KNOWN_AGENTS.CLAUDE],
      [{ CLAUDE_CODE_CHILD_SESSION: '1' }, KNOWN_AGENTS.CLAUDE],
      [{ CLAUDE_CODE: '1', CLAUDE_CODE_IS_COWORK: '1' }, KNOWN_AGENTS.COWORK],
      [{ KIMI_PLUGIN_ROOT: '/tmp/kimi' }, KNOWN_AGENTS.KIMI],
      [{ GROK_PLUGIN_ROOT: '/tmp/grok', CLAUDECODE: '1' }, KNOWN_AGENTS.GROK],
      [{ GROK_PLUGIN_DATA: '/tmp/grok-data' }, KNOWN_AGENTS.GROK],
      [{ AMP_CURRENT_THREAD_ID: 't-1' }, KNOWN_AGENTS.AMP],
      [{ AGENT: 'amp', CLAUDECODE: '1' }, KNOWN_AGENTS.AMP],
      [{ GEMINI_CLI: '1' }, KNOWN_AGENTS.GEMINI],
      [{ CLINE_ACTIVE: 'true' }, KNOWN_AGENTS.CLINE],
      [{ CODEX_SANDBOX: 'seatbelt' }, KNOWN_AGENTS.CODEX],
      [{ CODEX_CI: '1' }, KNOWN_AGENTS.CODEX],
      [{ CODEX_THREAD_ID: 'thread-456' }, KNOWN_AGENTS.CODEX],
      [{ CODEX_SANDBOX_NETWORK_DISABLED: '1' }, KNOWN_AGENTS.CODEX],
      [{ ANTIGRAVITY_AGENT: 'true' }, KNOWN_AGENTS.ANTIGRAVITY],
      [{ ANTIGRAVITY_CLI_ALIAS: 'agy' }, KNOWN_AGENTS.ANTIGRAVITY],
      [{ AUGMENT_AGENT: '1' }, KNOWN_AGENTS.AUGMENT_CLI],
      [{ OPENCODE: '1' }, KNOWN_AGENTS.OPENCODE],
      [{ OPENCODE_CLIENT: 'cli' }, KNOWN_AGENTS.OPENCODE],
      [{ GOOSE_TERMINAL: '1' }, KNOWN_AGENTS.GOOSE],
      [{ AGENT: 'GOOSE' }, KNOWN_AGENTS.GOOSE],
      [{ JUNIE_DATA: '/tmp/junie' }, KNOWN_AGENTS.JUNIE],
      [{ JUNIE_SHIM_PATH: '/tmp/junie-shim' }, KNOWN_AGENTS.JUNIE],
      [{ PI_CODING_AGENT: 'true' }, KNOWN_AGENTS.PI],
      [{ PATH: '/Users/dev/.pi/agent/bin:/usr/bin' }, KNOWN_AGENTS.PI],
      [{ Path: 'C:\\Users\\dev\\.pi\\agent' }, KNOWN_AGENTS.PI],
      [{ AGENT_CONTEXT_OUT: '/tmp/ctx' }, KNOWN_AGENTS.KIRO],
      [{ COPILOT_MODEL: 'gpt-5' }, KNOWN_AGENTS.GITHUB_COPILOT],
      [{ COPILOT_ALLOW_ALL: '1' }, KNOWN_AGENTS.GITHUB_COPILOT],
      [{ COPILOT_GITHUB_TOKEN: 'gho_123' }, KNOWN_AGENTS.GITHUB_COPILOT],
      [{ COPILOT_CLI: '1' }, KNOWN_AGENTS.GITHUB_COPILOT],
      [{ COPILOT_AGENT: '1' }, KNOWN_AGENTS.GITHUB_COPILOT],
    ];

    for (const [env, expected] of cases) {
      assert.strictEqual(
        determineAgent(env, noFs, true).agent?.name,
        expected,
        `Expected ${JSON.stringify(env)} -> ${expected}`,
      );
    }

    assert.deepStrictEqual(determineAgent({ OPENCODE: '0' }, noFs, false), { isAgent: false, agent: undefined });
    assert.deepStrictEqual(
      determineAgent({ CLAUDE_CODE_IS_COWORK: '1' }, noFs, false),
      { isAgent: false, agent: undefined },
    );
    assert.deepStrictEqual(
      determineAgent({ PATH: '/Users/dev/not.pi/agentic:/usr/bin' }, noFs, false),
      { isAgent: false, agent: undefined },
    );
  });

  test('gates shared IDE and shell markers on !isTTY', () => {
    const ttyGated: Array<[NodeJS.ProcessEnv, string]> = [
      [{ REPL_ID: 'repl-123' }, KNOWN_AGENTS.REPLIT],
      [{ TERM_PROGRAM: 'kiro' }, KNOWN_AGENTS.KIRO],
      [{ GOOSE_PROVIDER: 'anthropic' }, KNOWN_AGENTS.GOOSE],
    ];

    for (const [env, expected] of ttyGated) {
      assert.deepStrictEqual(determineAgent(env, noFs, true), { isAgent: false, agent: undefined });
      assert.strictEqual(determineAgent(env, noFs, false).agent?.name, expected);
    }

    assert.strictEqual(
      determineAgent({ REPL_ID: 'repl-123', TERM_PROGRAM: 'kiro', CLAUDECODE: '1' }, noFs, true).agent?.name,
      KNOWN_AGENTS.CLAUDE,
    );
  });

  test('detects Devin via /opt/.devin path after env markers', () => {
    const hasDevinPath = (p: string) => p === '/opt/.devin';
    assert.strictEqual(determineAgent({}, hasDevinPath, true).agent?.name, KNOWN_AGENTS.DEVIN);
    assert.strictEqual(determineAgent({ GEMINI_CLI: '1' }, hasDevinPath, true).agent?.name, KNOWN_AGENTS.GEMINI);
  });

  test('normalizes AI_AGENT prefixes and aliases at word boundaries', () => {
    const aiAgentCases: Array<[string, string]> = [
      ['claude-code', KNOWN_AGENTS.CLAUDE],
      ['codex-cli', KNOWN_AGENTS.CODEX],
      ['cursor-cli-1.0', KNOWN_AGENTS.CURSOR_CLI],
      ['cursor', KNOWN_AGENTS.CURSOR],
      ['github_copilot', KNOWN_AGENTS.GITHUB_COPILOT],
      ['copilot-cli', KNOWN_AGENTS.GITHUB_COPILOT],
      ['open_code', KNOWN_AGENTS.OPENCODE],
      ['auggie', KNOWN_AGENTS.AUGMENT_CLI],
      ['v0-agent', KNOWN_AGENTS.V0],
      ['fx-runner', KNOWN_AGENTS.FX],
      ['eve', KNOWN_AGENTS.EVE],
      ['fxapp', 'fxapp'],
      ['cursors', 'cursors'],
      ['  custom-agent  ', 'custom-agent'],
      ['kilocode', 'kilocode'],
      ['0', '0'],
    ];

    for (const [raw, expected] of aiAgentCases) {
      assert.strictEqual(
        determineAgent({ AI_AGENT: raw }, noFs, true).agent?.name,
        expected,
        `Expected AI_AGENT=${JSON.stringify(raw)} -> ${expected}`,
      );
    }
  });

  test('does not match pruned speculative markers', () => {
    for (const env of [
      { VTCODE: '1' },
      { TRAE_AI_SHELL_ID: 'shell-1' },
      { OPENCLAW_SHELL: '1' },
      { HERMES_SESSION_ID: 'sess-1' },
      { CRUSH: '1' },
      { AGENT: 'crush' },
      { QWEN_CODE: '1' },
      { KILO: '1' },
      { KILOCODE_FEATURE: '1' },
    ]) {
      assert.deepStrictEqual(
        determineAgent(env, noFs, false),
        { isAgent: false, agent: undefined },
        `Expected pruned marker ${JSON.stringify(env)} to be ignored`,
      );
    }
    assert.ok(DETECTED_AGENT_ENV_VARS.has('CLAUDECODE'));
  });
});
