/**
 * @license
 * Copyright 2025 Vercel, Inc.
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vendored and adapted from @vercel/detect-agent@1.2.7
 * Upstream: https://github.com/vercel/vercel/tree/main/packages/detect-agent
 *
 * Checks environment variables and known runtime indicators to detect what AI
 * agent or automated development environment is executing the CLI.
 */

import { accessSync, constants } from 'node:fs';

const DEVIN_LOCAL_PATH = '/opt/.devin';
export const PI_AGENT_PATH_PATTERN = /(?:^|[\\/:;])\.pi[\\/]agent(?:$|[\\/:;])/;
const CLAUDE_ENV_VARS = ['CLAUDECODE', 'CLAUDE_CODE', 'CLAUDE_CODE_CHILD_SESSION'] as const;

export const KNOWN_AGENTS = {
  CURSOR: 'cursor',
  CURSOR_CLI: 'cursor-cli',
  CLAUDE: 'claude',
  COWORK: 'cowork',
  DEVIN: 'devin',
  REPLIT: 'replit',
  GEMINI: 'gemini',
  CODEX: 'codex',
  ANTIGRAVITY: 'antigravity',
  AUGMENT_CLI: 'augment-cli',
  OPENCODE: 'opencode',
  GITHUB_COPILOT: 'github-copilot',
  V0: 'v0',
  FX: 'fx',
  EVE: 'eve',
  AMP: 'amp',
  KIMI: 'kimi',
  GROK: 'grok',
  CLINE: 'cline',
  GOOSE: 'goose',
  JUNIE: 'junie',
  PI: 'pi',
  KIRO: 'kiro',
} as const;

export type KnownAgentNames = typeof KNOWN_AGENTS[keyof typeof KNOWN_AGENTS];

const AI_AGENT_ALIASES: Readonly<Record<string, KnownAgentNames>> = {
  github_copilot: KNOWN_AGENTS.GITHUB_COPILOT,
  copilot: KNOWN_AGENTS.GITHUB_COPILOT,
  open_code: KNOWN_AGENTS.OPENCODE,
  auggie: KNOWN_AGENTS.AUGMENT_CLI,
};

const KNOWN_AGENT_PREFIXES = [
  ...Object.values(KNOWN_AGENTS),
  ...Object.keys(AI_AGENT_ALIASES),
].sort((a, b) => b.length - a.length);

export interface AgentResult {
  isAgent: boolean;
  agent?: {
    name: string;
  };
}

interface AgentRule {
  name: KnownAgentNames;
  envVars?: readonly string[];
  envEquals?: Readonly<Record<string, string>>;
  nonTtyOnly?: boolean;
  matches?: (env: NodeJS.ProcessEnv, exists: (path: string) => boolean) => boolean;
}

const hasEnv = (env: NodeJS.ProcessEnv, key: string): boolean => Boolean(env[key]?.trim());

// Ordered from most-specific to generic: e.g. Grok/Amp before Claude, Cowork before Claude,
// strong vendor markers before !isTTY IDE/shell markers, and local Devin path last.
const AGENT_RULES: readonly AgentRule[] = [
  // Cursor IDE integrated terminals set CURSOR_TRACE_ID for human shells; require strong agent signals.
  { name: KNOWN_AGENTS.CURSOR_CLI, envVars: ['CURSOR_AGENT'], envEquals: { CURSOR_EXTENSION_HOST_ROLE: 'agent-exec' } },
  { name: KNOWN_AGENTS.KIMI, envVars: ['KIMI_PLUGIN_ROOT'] },
  { name: KNOWN_AGENTS.GROK, envVars: ['GROK_PLUGIN_ROOT', 'GROK_PLUGIN_DATA'] },
  { name: KNOWN_AGENTS.AMP, envVars: ['AMP_CURRENT_THREAD_ID'], envEquals: { AGENT: 'amp' } },
  { name: KNOWN_AGENTS.GEMINI, envVars: ['GEMINI_CLI'] },
  { name: KNOWN_AGENTS.CLINE, envVars: ['CLINE_ACTIVE'] },
  { name: KNOWN_AGENTS.CODEX, envVars: ['CODEX_SANDBOX', 'CODEX_CI', 'CODEX_THREAD_ID', 'CODEX_SANDBOX_NETWORK_DISABLED'] },
  { name: KNOWN_AGENTS.ANTIGRAVITY, envVars: ['ANTIGRAVITY_AGENT', 'ANTIGRAVITY_CLI_ALIAS'] },
  { name: KNOWN_AGENTS.AUGMENT_CLI, envVars: ['AUGMENT_AGENT'] },
  { name: KNOWN_AGENTS.OPENCODE, envVars: ['OPENCODE_CLIENT'], envEquals: { OPENCODE: '1' } },
  { name: KNOWN_AGENTS.GOOSE, envVars: ['GOOSE_TERMINAL'], envEquals: { AGENT: 'goose' } },
  { name: KNOWN_AGENTS.JUNIE, envVars: ['JUNIE_DATA', 'JUNIE_SHIM_PATH'] },
  {
    name: KNOWN_AGENTS.PI,
    envVars: ['PI_CODING_AGENT'],
    matches: (env) => PI_AGENT_PATH_PATTERN.test(env.PATH || env.Path || ''),
  },
  { name: KNOWN_AGENTS.KIRO, envVars: ['AGENT_CONTEXT_OUT'] },
  {
    name: KNOWN_AGENTS.GITHUB_COPILOT,
    envVars: ['COPILOT_MODEL', 'COPILOT_ALLOW_ALL', 'COPILOT_GITHUB_TOKEN', 'COPILOT_CLI', 'COPILOT_AGENT'],
  },
  {
    name: KNOWN_AGENTS.COWORK,
    matches: (env) => hasEnv(env, 'CLAUDE_CODE_IS_COWORK') && CLAUDE_ENV_VARS.some((k) => hasEnv(env, k)),
  },
  { name: KNOWN_AGENTS.CLAUDE, envVars: CLAUDE_ENV_VARS },
  // Shared IDE/shell markers are gated on !isTTY so human integrated terminals aren't misdetected.
  { name: KNOWN_AGENTS.REPLIT, envVars: ['REPL_ID'], nonTtyOnly: true },
  {
    name: KNOWN_AGENTS.KIRO,
    nonTtyOnly: true,
    matches: (env) => Boolean(env.TERM_PROGRAM && /kiro/i.test(env.TERM_PROGRAM)),
  },
  { name: KNOWN_AGENTS.GOOSE, envVars: ['GOOSE_PROVIDER'], nonTtyOnly: true },
  { name: KNOWN_AGENTS.DEVIN, matches: (_env, exists) => exists(DEVIN_LOCAL_PATH) },
];

export const DETECTED_AGENT_ENV_VARS: ReadonlySet<string> = new Set([
  'AI_AGENT',
  'AGENT',
  'CLAUDE_CODE_IS_COWORK',
  ...AGENT_RULES.flatMap((rule) => [
    ...(rule.envVars ?? []),
    ...Object.keys(rule.envEquals ?? {}),
  ]),
]);

function pathExists(path: string): boolean {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeAiAgent(name: string): string {
  const lower = name.toLowerCase();
  for (const prefix of KNOWN_AGENT_PREFIXES) {
    if (!lower.startsWith(prefix)) continue;
    const nextChar = lower.charAt(prefix.length);
    if (nextChar === '' || !/[a-z0-9]/.test(nextChar)) {
      return AI_AGENT_ALIASES[prefix] ?? prefix;
    }
  }
  return name;
}

/**
 * Synchronously determine the agent executing the current process based on
 * environment variables and well-known filesystem markers.
 */
export function determineAgent(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = pathExists,
  isTTY: boolean = Boolean(process.stdin?.isTTY || process.stdout?.isTTY),
): AgentResult {
  const aiAgent = env.AI_AGENT?.trim();
  if (aiAgent) {
    return { isAgent: true, agent: { name: normalizeAiAgent(aiAgent) } };
  }

  for (const rule of AGENT_RULES) {
    if (rule.nonTtyOnly && isTTY) continue;
    const matched =
      rule.envVars?.some((key) => hasEnv(env, key)) ||
      Object.entries(rule.envEquals ?? {}).some(
        ([key, expected]) => env[key]?.trim().toLowerCase() === expected,
      ) ||
      rule.matches?.(env, exists);
    if (matched) {
      return { isAgent: true, agent: { name: rule.name } };
    }
  }

  return { isAgent: false, agent: undefined };
}
