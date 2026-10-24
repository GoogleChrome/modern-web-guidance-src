/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as readline from "node:readline/promises";
import { writeMwgrc } from "../rag/mwgrc.ts";
import { determineAgent } from "./telemetry/detect-agent.ts";

export interface SetAllowOriginTrialsOptions {
  isAgent?: boolean;
  isTTY?: boolean;
  askConfirmation?: () => Promise<boolean>;
  cwd?: string;
}

async function defaultAskConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await rl.question("Enable experimental Origin Trial guidance for this project? [y/N] ");
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export async function handleSetAllowOriginTrials(opts: SetAllowOriginTrialsOptions = {}): Promise<number> {
  const isAgent = opts.isAgent ?? determineAgent().isAgent;
  const isTTY = opts.isTTY ?? Boolean(process.stdin.isTTY);

  if (isAgent || !isTTY) {
    console.error(
      "Error: `set-allow-origin-trials` must be run interactively by a human developer, not an AI agent.\n" +
      "Ask the developer to run `npx modern-web-guidance set-allow-origin-trials` in their own terminal."
    );
    return 1;
  }

  const ask = opts.askConfirmation ?? defaultAskConfirmation;
  const confirmed = await ask();
  if (!confirmed) {
    console.log("Aborted.");
    return 1;
  }

  const targetPath = writeMwgrc({ allowOriginTrials: true }, opts.cwd);
  console.log(`Enabled Origin Trial guidance for project in ${targetPath}`);
  return 0;
}
