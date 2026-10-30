/**
 * @license
 * Copyright 2025 Vercel, Inc.
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vendored and adapted from @vercel/detect-agent@1.2.5
 * Upstream: https://github.com/vercel/vercel/tree/main/packages/detect-agent
 *
 * Checks environment variables and known runtime indicators to detect what AI
 * agent or automated development environment is executing the CLI.
 */

import { accessSync, constants } from 'node:fs';

const DEVIN_LOCAL_PATH = '/opt/.devin';

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
} as const;

export type KnownAgentNames = typeof KNOWN_AGENTS[keyof typeof KNOWN_AGENTS];

export interface AgentResult {
  isAgent: boolean;
  agent?: {
    name: string;
  };
}

function pathExists(path: string): boolean {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Synchronously determine the agent executing the current process based on
 * environment variables and well-known filesystem markers.
 */
export function determineAgent(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = pathExists,
): AgentResult {
  if (env.AI_AGENT) {
    const name = env.AI_AGENT.trim();
    if (name) {
      if (name.startsWith('github_copilot')) {
        return {
          isAgent: true,
          agent: { name: KNOWN_AGENTS.GITHUB_COPILOT },
        };
      }
      const known = Object.values(KNOWN_AGENTS)
        .sort((a, b) => b.length - a.length)
        .find((a) => name.startsWith(a));
      return {
        isAgent: true,
        agent: { name: known ?? name },
      };
    }
  }

  if (env.CURSOR_TRACE_ID) {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.CURSOR } };
  }

  if (env.CURSOR_AGENT || env.CURSOR_EXTENSION_HOST_ROLE === 'agent-exec') {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.CURSOR_CLI } };
  }

  if (env.GEMINI_CLI) {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.GEMINI } };
  }

  if (env.CODEX_SANDBOX || env.CODEX_CI || env.CODEX_THREAD_ID) {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.CODEX } };
  }

  if (env.ANTIGRAVITY_AGENT) {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.ANTIGRAVITY } };
  }

  if (env.AUGMENT_AGENT) {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.AUGMENT_CLI } };
  }

  if (env.OPENCODE_CLIENT) {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.OPENCODE } };
  }

  if (env.CLAUDECODE || env.CLAUDE_CODE) {
    if (env.CLAUDE_CODE_IS_COWORK) {
      return { isAgent: true, agent: { name: KNOWN_AGENTS.COWORK } };
    }
    return { isAgent: true, agent: { name: KNOWN_AGENTS.CLAUDE } };
  }

  if (env.REPL_ID) {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.REPLIT } };
  }

  if (env.COPILOT_MODEL || env.COPILOT_ALLOW_ALL || env.COPILOT_GITHUB_TOKEN) {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.GITHUB_COPILOT } };
  }

  if (exists(DEVIN_LOCAL_PATH)) {
    return { isAgent: true, agent: { name: KNOWN_AGENTS.DEVIN } };
  }

  return { isAgent: false, agent: undefined };
}
