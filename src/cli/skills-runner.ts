/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface SkillsRunner {
  readonly cmd: string;
  readonly prefixArgs: readonly string[];
}

const NPX: SkillsRunner = { cmd: "npx", prefixArgs: ["-y"] };
const PNPX: SkillsRunner = { cmd: "pnpx", prefixArgs: [] };
const YARN_DLX: SkillsRunner = { cmd: "yarn", prefixArgs: ["dlx"] };

function parseMajor(version: unknown): number | null {
  if (typeof version !== "string") return null;
  const match = version.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function runnerForManager(name: string, version: unknown, defaultYarnToV2: boolean): SkillsRunner | null {
  const pm = name.trim().toLowerCase();
  if (pm === "pnpm") return PNPX;
  if (pm === "yarn") {
    const major = parseMajor(version);
    const useDlx = major !== null ? major >= 2 : defaultYarnToV2;
    return useDlx ? YARN_DLX : NPX;
  }
  return pm === "npm" ? NPX : null;
}

function readDevEnginesRunner(cwd: string, isNpmUa: boolean): SkillsRunner | null {
  let dir = resolve(cwd);
  while (true) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          devEngines?: { packageManager?: unknown };
        };
        const spec = pkg.devEngines?.packageManager;
        const entries = (Array.isArray(spec) ? spec : [spec]).filter(
          (e): e is { name?: unknown; version?: unknown; onFail?: unknown } => Boolean(e && typeof e === "object"),
        );
        if (isNpmUa && entries.some((e) => typeof e.name === "string" && e.name.trim().toLowerCase() === "npm")) {
          return NPX;
        }
        for (const { name, version, onFail } of entries) {
          if (onFail !== undefined && onFail !== "error" && onFail !== "download") continue;
          // Treat unversioned devEngines yarn as Yarn 2+ (`yarn dlx` does not exist in Yarn 1).
          const runner = typeof name === "string" ? runnerForManager(name, version, true) : null;
          if (runner) return runner;
        }
      } catch {
        // Ignore unreadable or malformed nearest package.json.
      }
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Selects `pnpx`, `yarn dlx`, or `npx -y` for invoking `skills`, avoiding EBADDEVENGINES. */
export function getSkillsRunner(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): SkillsRunner {
  const firstToken = env.npm_config_user_agent?.trim().split(/\s+/)[0] ?? "";
  const slashIdx = firstToken.indexOf("/");
  const uaName = slashIdx > 0 ? firstToken.slice(0, slashIdx).toLowerCase() : "";
  if (slashIdx > 0) {
    const uaRunner = runnerForManager(uaName, firstToken.slice(slashIdx + 1), false);
    // Explicit non-npm UAs (pnpm, yarn 1/2+) take precedence; npm and unknown UAs fall through to devEngines.
    if (uaRunner && uaName !== "npm") return uaRunner;
  }
  return readDevEnginesRunner(cwd, uaName === "npm") ?? NPX;
}
