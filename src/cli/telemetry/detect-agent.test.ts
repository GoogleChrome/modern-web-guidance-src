import { describe, it } from 'node:test';
import assert from 'node:assert';
import { determineAgent, KNOWN_AGENTS } from './detect-agent.ts';

describe('determineAgent', () => {
  it('returns false when no agent environment variables are present', () => {
    const result = determineAgent({}, () => false);
    assert.strictEqual(result.isAgent, false);
    assert.strictEqual(result.agent, undefined);
  });

  it('detects Claude Code', () => {
    const result = determineAgent({ CLAUDE_CODE: '1' }, () => false);
    assert.strictEqual(result.isAgent, true);
    assert.strictEqual(result.agent?.name, KNOWN_AGENTS.CLAUDE);
  });

  it('detects Claude Cowork via CLAUDE_CODE_IS_COWORK', () => {
    const result = determineAgent({ CLAUDE_CODE: '1', CLAUDE_CODE_IS_COWORK: '1' }, () => false);
    assert.strictEqual(result.isAgent, true);
    assert.strictEqual(result.agent?.name, KNOWN_AGENTS.COWORK);
  });

  it('detects Cursor and Cursor CLI', () => {
    const cursorResult = determineAgent({ CURSOR_TRACE_ID: 'xyz-123' }, () => false);
    assert.strictEqual(cursorResult.isAgent, true);
    assert.strictEqual(cursorResult.agent?.name, KNOWN_AGENTS.CURSOR);

    const cliResult = determineAgent({ CURSOR_EXTENSION_HOST_ROLE: 'agent-exec' }, () => false);
    assert.strictEqual(cliResult.isAgent, true);
    assert.strictEqual(cliResult.agent?.name, KNOWN_AGENTS.CURSOR_CLI);
  });

  it('detects Gemini CLI', () => {
    const result = determineAgent({ GEMINI_CLI: '1' }, () => false);
    assert.strictEqual(result.isAgent, true);
    assert.strictEqual(result.agent?.name, KNOWN_AGENTS.GEMINI);
  });

  it('detects Codex sandbox/threads', () => {
    const result = determineAgent({ CODEX_THREAD_ID: 'thread-456' }, () => false);
    assert.strictEqual(result.isAgent, true);
    assert.strictEqual(result.agent?.name, KNOWN_AGENTS.CODEX);
  });

  it('detects Antigravity', () => {
    const result = determineAgent({ ANTIGRAVITY_AGENT: 'true' }, () => false);
    assert.strictEqual(result.isAgent, true);
    assert.strictEqual(result.agent?.name, KNOWN_AGENTS.ANTIGRAVITY);
  });

  it('detects Devin via /opt/.devin marker', () => {
    const result = determineAgent({}, (p) => p === '/opt/.devin');
    assert.strictEqual(result.isAgent, true);
    assert.strictEqual(result.agent?.name, KNOWN_AGENTS.DEVIN);
  });

  it('detects custom AI_AGENT override', () => {
    const result = determineAgent({ AI_AGENT: 'my-custom-agent' }, () => false);
    assert.strictEqual(result.isAgent, true);
    assert.strictEqual(result.agent?.name, 'my-custom-agent');
  });

  it('matches known agents in AI_AGENT', () => {
    const result = determineAgent({ AI_AGENT: 'v0' }, () => false);
    assert.strictEqual(result.isAgent, true);
    assert.strictEqual(result.agent?.name, KNOWN_AGENTS.V0);
  });

  it('normalizes GitHub Copilot variants in AI_AGENT', () => {
    const cliResult = determineAgent({ AI_AGENT: 'github-copilot-cli' }, () => false);
    assert.strictEqual(cliResult.isAgent, true);
    assert.strictEqual(cliResult.agent?.name, KNOWN_AGENTS.GITHUB_COPILOT);

    const vscodeResult = determineAgent({ AI_AGENT: 'github_copilot_vscode_agent' }, () => false);
    assert.strictEqual(vscodeResult.isAgent, true);
    assert.strictEqual(vscodeResult.agent?.name, KNOWN_AGENTS.GITHUB_COPILOT);
  });

  it('normalizes versioned Claude Code strings in AI_AGENT', () => {
    const result = determineAgent({ AI_AGENT: 'claude-code_2-1-292_agent' }, () => false);
    assert.strictEqual(result.isAgent, true);
    assert.strictEqual(result.agent?.name, KNOWN_AGENTS.CLAUDE);
  });
});
