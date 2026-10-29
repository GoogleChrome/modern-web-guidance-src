/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as readline from "node:readline/promises";
import { resolveMwgrcPath, writeMwgrc } from "../core/mwgrc.ts";
import { determineAgent } from "./telemetry/detect-agent.ts";

export interface SetAllowOriginTrialsOptions {
  isAgent?: boolean;
  isTTY?: boolean;
  askConfirmation?: (targetPath: string) => Promise<boolean>;
  cwd?: string;
}

async function defaultAskConfirmation(targetPath: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question(`Enable experimental Origin Trial guidance for this project (${targetPath})? [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export async function handleSetAllowOriginTrials(opts: SetAllowOriginTrialsOptions = {}): Promise<number> {
  const detected = determineAgent();
  const isAgent = opts.isAgent ?? detected.isAgent;
  const isTTY = opts.isTTY ?? Boolean(process.stdin.isTTY);

  if (isAgent || !isTTY) {
    const reason = isAgent
      ? `detected agent environment${detected.agent?.name ? `: ${detected.agent.name}` : ''}`
      : 'non-interactive stdin';
    console.error(
      `Error: \`set-allow-origin-trials\` must be run interactively by a human developer, not an AI agent (${reason}).\n` +
      `Ask the developer to run \`npx modern-web-guidance@latest set-allow-origin-trials\` in their own terminal.\n` +
      `If your IDE terminal sets agent environment variables, run the command in an external terminal.`
    );
    return 1;
  }

  const targetPath = resolveMwgrcPath(opts.cwd);
  const ask = opts.askConfirmation ?? defaultAskConfirmation;
  const confirmed = await ask(targetPath);
  if (!confirmed) {
    console.log("Aborted.");
    return 1;
  }

  writeMwgrc({ allowOriginTrials: true }, opts.cwd);
  console.log(`Enabled Origin Trial guidance in ${targetPath}. Commit this file to share the opt-in.`);
  return 0;
}
