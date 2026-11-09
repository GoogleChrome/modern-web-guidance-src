import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Agents } from '../config.ts';
import {
  defaultLevelFromModelId,
  EFFORT_ADAPTERS,
  pickHigherPrecedenceEffort,
  resolveEffortCliArgs,
  resolveReasoningEffort,
  sanitizeReasoningEffort,
} from './reasoning-effort.ts';

describe('defaultLevelFromModelId', () => {
  test('extracts trailing -<level>, :<level>, and balanced (<level>) tier suffixes case-insensitively', () => {
    assert.strictEqual(defaultLevelFromModelId('gemini-3.8-flash-medium'), 'medium');
    assert.strictEqual(defaultLevelFromModelId('openrouter/deepseek/deepseek-v4.1-flash:low'), 'low');
    assert.strictEqual(defaultLevelFromModelId('openrouter/qwen/qwen3.8-flash:off'), 'off');
    assert.strictEqual(defaultLevelFromModelId('opus-5.5-high'), 'high');
    assert.strictEqual(defaultLevelFromModelId('fable-5.1-max'), 'max');
    assert.strictEqual(defaultLevelFromModelId('gpt-6-XHIGH'), 'xhigh');
    assert.strictEqual(defaultLevelFromModelId('o4-mini-minimal'), 'minimal');
    assert.strictEqual(defaultLevelFromModelId('qwen/qwen3:none'), 'none');
    assert.strictEqual(defaultLevelFromModelId('Gemini 3.8 Flash (Medium)'), 'medium');
    assert.strictEqual(defaultLevelFromModelId('Claude Opus 5.5 (Max)'), 'max');
  });

  test('ignores mid-string size tokens, non-effort suffixes, unbalanced parens, and level-less models', () => {
    assert.strictEqual(defaultLevelFromModelId('openrouter/mistralai/mistral-medium-3.1'), undefined);
    assert.strictEqual(defaultLevelFromModelId('gemini-3.5-flash-lite'), undefined);
    assert.strictEqual(defaultLevelFromModelId('gemini-3.8-flash-tiered'), undefined);
    assert.strictEqual(defaultLevelFromModelId('gemini-4-argon'), undefined);
    assert.strictEqual(defaultLevelFromModelId('claude-sonnet-5-5'), undefined);
    assert.strictEqual(defaultLevelFromModelId('gpt-6.1-sol'), undefined);
    assert.strictEqual(defaultLevelFromModelId('Gemini (Medium'), undefined);
    assert.strictEqual(defaultLevelFromModelId('Gemini Medium)'), undefined);
    assert.strictEqual(defaultLevelFromModelId('(Medium)'), undefined);
    assert.strictEqual(defaultLevelFromModelId('unknown'), undefined);
    assert.strictEqual(defaultLevelFromModelId(''), undefined);
    assert.strictEqual(defaultLevelFromModelId('-high'), undefined);
    assert.strictEqual(defaultLevelFromModelId(':low'), undefined);
  });
});

describe('EFFORT_ADAPTERS & resolveEffortCliArgs', () => {
  test('maps <AGENT>_EFFORT env vars to normalized CLI flags for each agent', () => {
    assert.ok(EFFORT_ADAPTERS[Agents.ANTIGRAVITY_CLI]);
    assert.ok(EFFORT_ADAPTERS[Agents.JETSKI_CLI]);
    assert.ok(EFFORT_ADAPTERS[Agents.CLAUDE_CODE]);
    assert.ok(EFFORT_ADAPTERS[Agents.CODEX_CLI]);
    assert.deepStrictEqual(EFFORT_ADAPTERS[Agents.PI], {});

    assert.deepStrictEqual(
      resolveEffortCliArgs(Agents.ANTIGRAVITY_CLI, 'gemini-4-argon', { ANTIGRAVITY_EFFORT: '  HIGH ' }),
      ['--effort', 'high'],
    );
    assert.deepStrictEqual(
      resolveEffortCliArgs(Agents.JETSKI_CLI, 'gemini-4-argon', { JETSKI_EFFORT: 'Medium' }),
      ['--effort', 'medium'],
    );
    assert.deepStrictEqual(
      resolveEffortCliArgs(Agents.CLAUDE_CODE, 'claude-sonnet-5-5', { CLAUDE_EFFORT: 'max' }),
      ['--effort', 'max'],
    );
    assert.deepStrictEqual(
      resolveEffortCliArgs(Agents.CODEX_CLI, 'gpt-6.1-sol', { CODEX_EFFORT: 'XHigh' }),
      ['-c', 'model_reasoning_effort=xhigh'],
    );
    assert.deepStrictEqual(
      resolveEffortCliArgs(Agents.PI, 'openrouter/deepseek/deepseek-v4.1-flash:low', {
        PI_MODEL: 'openrouter/deepseek/deepseek-v4.1-flash:low',
      }),
      [],
    );
  });

  test('returns empty args when effort env var is unset or whitespace-only', () => {
    assert.deepStrictEqual(resolveEffortCliArgs(Agents.ANTIGRAVITY_CLI, 'gemini-3.8-flash-medium', {}), []);
    assert.deepStrictEqual(
      resolveEffortCliArgs(Agents.CODEX_CLI, 'gpt-6.1-sol', { CODEX_EFFORT: '   ' }),
      [],
    );
  });

  test('throws a descriptive conflict error when <AGENT>_EFFORT is combined with a tiered model ID', () => {
    assert.throws(
      () =>
        resolveEffortCliArgs(Agents.ANTIGRAVITY_CLI, 'gemini-3.8-flash-medium', {
          ANTIGRAVITY_EFFORT: 'high',
        }),
      /ANTIGRAVITY_EFFORT=high conflicts with model 'gemini-3\.8-flash-medium'.*'medium'/,
    );
    assert.throws(
      () => resolveEffortCliArgs(Agents.CLAUDE_CODE, 'opus-5.5-high', { CLAUDE_EFFORT: 'low' }),
      /CLAUDE_EFFORT=low conflicts with model 'opus-5\.5-high'.*'high'/,
    );
    assert.throws(
      () => resolveEffortCliArgs(Agents.JETSKI_CLI, 'fable-5.1-max', { JETSKI_EFFORT: 'medium' }),
      /JETSKI_EFFORT=medium conflicts with model 'fable-5\.1-max'.*'max'/,
    );
    assert.throws(
      () =>
        resolveEffortCliArgs(Agents.JETSKI_CLI, 'Gemini 3.8 Flash (Medium)', {
          JETSKI_EFFORT: 'high',
        }),
      /JETSKI_EFFORT=high conflicts with model 'Gemini 3\.8 Flash \(Medium\)'.*'medium'/,
    );
  });
});

describe('resolveReasoningEffort', () => {
  test('enforces strict precedence: observed > configured > model-id > agent-default', () => {
    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.CLAUDE_CODE,
        model: 'claude-sonnet-5-5',
        env: {},
      }),
      { source: 'agent-default' },
    );

    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.ANTIGRAVITY_CLI,
        model: 'gemini-3.8-flash-medium',
        env: {},
      }),
      { level: 'medium', source: 'model-id' },
    );

    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.CLAUDE_CODE,
        model: 'claude-sonnet-5-5',
        env: { CLAUDE_EFFORT: 'High' },
      }),
      { level: 'high', source: 'configured' },
    );

    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.CODEX_CLI,
        model: 'gpt-6.1-sol',
        observed: 'XHigh',
        env: { CODEX_EFFORT: 'high' },
      }),
      { level: 'xhigh', source: 'observed' },
    );
  });

  test('silently records observed when configured and observed disagree (no warning)', () => {
    const warnings: unknown[][] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      const resolved = resolveReasoningEffort({
        agent: Agents.CODEX_CLI,
        model: 'gpt-6.1-sol',
        observed: 'low',
        env: { CODEX_EFFORT: 'high' },
      });
      assert.deepStrictEqual(resolved, { level: 'low', source: 'observed' });
      assert.strictEqual(warnings.length, 0);
    } finally {
      console.warn = origWarn;
    }
  });

  test('extracts Pi :<level> suffix from PI_MODEL when logged model stripped the suffix, without leaking across models', () => {
    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.PI,
        model: 'deepseek/deepseek-v4.1-flash',
        env: { PI_MODEL: 'openrouter/deepseek/deepseek-v4.1-flash:low' },
      }),
      { level: 'low', source: 'model-id' },
    );

    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.PI,
        model: 'unknown',
        env: { PROMPT_MODEL: 'openrouter/qwen/qwen3.8-flash:off' },
      }),
      { level: 'off', source: 'model-id' },
    );

    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.PI,
        model: 'claude-sonnet-4-5',
        env: { PI_MODEL: 'openrouter/deepseek/deepseek-v4.1-flash:low' },
      }),
      { source: 'agent-default' },
    );
  });

  test('preserves fallback configured and model-id efforts during offline re-normalization', () => {
    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.CLAUDE_CODE,
        model: 'claude-sonnet-5-5',
        fallback: { level: 'high', source: 'configured' },
        env: {},
      }),
      { level: 'high', source: 'configured' },
    );

    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.PI,
        model: 'deepseek/deepseek-v4.1-flash',
        fallback: { level: 'low', source: 'model-id' },
        env: {},
      }),
      { level: 'low', source: 'model-id' },
    );

    // Newly extracted observed effort still wins over a prior configured fallback.
    assert.deepStrictEqual(
      resolveReasoningEffort({
        agent: Agents.CODEX_CLI,
        model: 'gpt-6.1-sol',
        observed: 'xhigh',
        fallback: { level: 'medium', source: 'configured' },
        env: {},
      }),
      { level: 'xhigh', source: 'observed' },
    );
  });
});

describe('sanitizeReasoningEffort & pickHigherPrecedenceEffort', () => {
  test('validates source and level tokens strictly', () => {
    assert.deepStrictEqual(
      sanitizeReasoningEffort({ level: 'high', source: 'observed', extraSecret: 'drop-me' }),
      { level: 'high', source: 'observed' },
    );
    assert.deepStrictEqual(sanitizeReasoningEffort({ source: 'agent-default' }), {
      source: 'agent-default',
    });
    assert.strictEqual(sanitizeReasoningEffort({ source: 'observed' }), undefined);
    assert.strictEqual(sanitizeReasoningEffort({ level: 'HIGH', source: 'observed' }), undefined);
    assert.strictEqual(sanitizeReasoningEffort({ level: 'bad token!', source: 'observed' }), undefined);
    assert.strictEqual(sanitizeReasoningEffort({ level: 'high', source: 'invalid' }), undefined);
    assert.strictEqual(sanitizeReasoningEffort(null), undefined);
  });

  test('prefers higher-precedence sources when aggregating runs', () => {
    const def = { source: 'agent-default' as const };
    const mod = { level: 'medium', source: 'model-id' as const };
    const cfg = { level: 'high', source: 'configured' as const };
    const obs = { level: 'xhigh', source: 'observed' as const };

    assert.deepStrictEqual(pickHigherPrecedenceEffort(undefined, def), def);
    assert.deepStrictEqual(pickHigherPrecedenceEffort(def, mod), mod);
    assert.deepStrictEqual(pickHigherPrecedenceEffort(mod, cfg), cfg);
    assert.deepStrictEqual(pickHigherPrecedenceEffort(cfg, obs), obs);
    assert.deepStrictEqual(pickHigherPrecedenceEffort(obs, cfg), obs);
  });
});
