/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { writeMwgrc } from "../rag/mwgrc.ts";

export interface SetAllowOriginTrialsOptions {
  isAgent: boolean;
  isTTY: boolean;
  askConfirmation: () => Promise<boolean>;
  cwd?: string;
}

export async function handleSetAllowOriginTrials(opts: SetAllowOriginTrialsOptions): Promise<number> {
  if (opts.isAgent || !opts.isTTY) {
    console.error(
      "Error: `set-allow-origin-trials` must be run interactively by a human developer, not an AI agent.\n" +
      "Ask the developer to run `npx modern-web-guidance set-allow-origin-trials` in their own terminal."
    );
    return 1;
  }

  const confirmed = await opts.askConfirmation();
  if (confirmed) {
    const targetPath = writeMwgrc({ allowOriginTrials: true }, opts.cwd);
    console.log(`Enabled Origin Trial guidance for project in ${targetPath}`);
    return 0;
  }

  console.log("Aborted.");
  return 1;
}
