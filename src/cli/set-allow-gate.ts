/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as readline from "node:readline/promises";
import { resolveMwgrcPath, writeMwgrc } from "../core/mwgrc.ts";
import { determineAgent } from "./telemetry/detect-agent.ts";
import { FEATURE_GATES, type FeatureGateSpec } from "../core/feature-gates.ts";

export interface SetAllowGateOptions {
  isAgent?: boolean;
  isTTY?: boolean;
  askConfirmation?: (targetPath: string) => Promise<boolean>;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export async function handleSetAllowOriginTrials(opts?: SetAllowGateOptions): Promise<number> {
  return handleSetAllowGate(FEATURE_GATES["origin-trials"], opts);
}

export async function handleSetAllowVolatileFeatures(opts?: SetAllowGateOptions): Promise<number> {
  return handleSetAllowGate(FEATURE_GATES["volatile-features"], opts);
}

async function defaultAskConfirmation(promptText: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(promptText);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export async function handleSetAllowGate(
  gate: FeatureGateSpec<any>,
  opts: SetAllowGateOptions = {},
): Promise<number> {
  const isTTY = opts.isTTY ?? Boolean(process.stdin.isTTY);
  const detected = opts.isAgent === false ? undefined : determineAgent(opts.env, undefined, isTTY);
  const isAgent = opts.isAgent ?? Boolean(detected?.isAgent);

  if (isAgent || !isTTY) {
    const reason = isAgent
      ? `detected agent environment${detected?.agent?.name ? `: ${detected.agent.name}` : ''}`
      : 'non-interactive stdin';
    console.error(
      `Error: \`${gate.cliCommand}\` must be run interactively by a human developer, not an AI agent (${reason}).\n` +
      `Ask the developer to run \`npx modern-web-guidance@latest ${gate.cliCommand}\` in their own terminal.\n` +
      `If your IDE terminal sets agent environment variables, run the command in an external terminal.`
    );
    return 1;
  }

  const targetPath = resolveMwgrcPath(opts.cwd);
  const ask = opts.askConfirmation ?? ((target: string) =>
    defaultAskConfirmation(`Enable ${gate.promptLabel} for this project (${target})? [y/N] `)
  );
  const confirmed = await ask(targetPath);
  if (!confirmed) {
    console.log("Aborted.");
    return 1;
  }

  writeMwgrc({ [gate.optInKey]: true }, opts.cwd);
  console.log(`Enabled ${gate.headingLabel} in ${targetPath}. Commit this file to share the opt-in.`);
  return 0;
}
