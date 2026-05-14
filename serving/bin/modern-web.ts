#!/usr/bin/env -S node --experimental-strip-types

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { retrieveUseCase } from "../lib/retrieve.ts";
import { USE_CASES } from "../lib/use-cases.gen.ts";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    choose: { type: "boolean" },
    "skill-version": { type: "string" },
  },
  allowPositionals: true,
  strict: false,
});

function printUsage() {
  console.log(`
Usage: modern-web <command> [args]

Commands:
  search <query>          Search use cases by query
  list                    List all available use cases
  retrieve <ids>          Retrieve use case(s) by ID(s), comma-separated
  install [options]       Install the modern-web-guidance skill
  update                  Update skills

Options:
  --skill-version <version> Internal use: version of the skill being executed
  --choose                Choose specific skills from the repository interactively
  -h, --help              Show this help
  -v, --version           Show version
`);
}

async function main() {
  if (values.version) {
    console.log(getVersion());
    process.exit(0);
  }

  if (values.help || positionals.length === 0) {
    printUsage();
    process.exit(values.help ? 0 : 1);
  }

  maybeEmitUpdateMessage(typeof values["skill-version"] === 'string' ? values["skill-version"] : null);

  const command = positionals[0];
  const arg = positionals.slice(1).join(" ");

  if (command === "search") {
    if (!arg) {
      console.error("No search query provided.");
      process.exit(1);
    }
    try {
      // Dynamic import to keep the CLI loading fast -- only load the embedder if needed.
      const { searchUseCases } = await import("../lib/search.ts");
      const results = await searchUseCases(arg);
      if (results.length === 0) {
        console.log("[]");
      } else {
        // Do a ~compressed output so users can see some of the results in their coding agent.
        // Also fewer tokens. :p
        const jsonLines = results.map(r => JSON.stringify(r));
        console.log("[" + jsonLines.join(",\n") + "]");
      }
    } catch (error) {
      console.error("Search failed:", error);
      process.exit(1);
    }
  } else if (command === "list") {
    const catalog = USE_CASES.map(u => ({
      id: u.id,
      category: u.category,
      description: u.description,
    }));
    console.log(JSON.stringify(catalog, null, 2));
  } else if (command === "retrieve") {
    if (!arg) {
      console.error("No IDs provided for retrieve.");
      process.exit(1);
    }
    const ids = arg.split(",").map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      console.error("No IDs provided for retrieve.");
      process.exit(1);
    }

    for (const id of ids) {
      try {
        const guide = await retrieveUseCase(id);
        console.log(`\n--- Guide for ${id} ---`);
        console.log(guide);
      } catch (error) {
        console.error(`Retrieve failed for ${id}:`, error);
        process.exit(1);
      }
    }
  } else if (command === "install") {
    const installArgs = `-y skills add GoogleChrome/modern-web-guidance ${values.choose ? "" : "--skill modern-web-guidance"}`
      .split(" ")
      .filter(Boolean);

    const result = spawnSync("npx", installArgs, { stdio: "inherit", shell: process.platform === "win32" });

    if (result.error) {
      console.error("Install failed:", result.error);
      process.exit(1);
    }
    process.exit(result.status ?? 0);
  } else if (command === "update") {
    const skills = getOurCLIAdjacentSkillIDs();
    const result = spawnSync("npx", ["-y", "skills", "update", ...skills], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.error) {
      console.error("Update failed:", result.error);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
}

// This returns the npm version.
function getVersion(): string {
  try {
    // Resolves to serving/package.json in dev, or dist/skills-cli/package.json in prod bundles
    const pkgPath = join(import.meta.dirname, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return pkg.version || "unknown";
  } catch (e) {
    return "unknown";
  }
}

// This returns our own "skill version", which is an identifier that only changes if
// the SKILL.md did.
function getCLISkillVersion(): string | null {
  try {
    const versionPath = join(import.meta.dirname, "skill-version.txt");
    const version = readFileSync(versionPath, "utf8");
    return version;
  } catch (e) {
    return null;
  }
}

function getOurCLIAdjacentSkillIDs(): string[] {
  try {
    const skillsPath = join(import.meta.dirname, "../../skills");
    const listing = readdirSync(skillsPath);
    return listing.filter(name => existsSync(join(skillsPath, name, 'SKILL.md')));
  } catch (e) {
    return [];
  }
}

function parseVersionDate(version: string): Date | null {
  const match = version.match(/^(\d{4})_(\d{2})_(\d{2})/);
  if (!match) return null;

  const [_, year, month, day] = match;
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
}

function maybeEmitUpdateMessage(callerSkillVersion: string|null): void {
  if (!callerSkillVersion) {
    return;
  }

  const latestSkillVersion = getCLISkillVersion();
  if (callerSkillVersion === latestSkillVersion) {
    return;
  }

  const callerDate = parseVersionDate(callerSkillVersion);
  if (callerDate) {
    const diffTime = Date.now() - callerDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    // Only log warning if the caller's version is more than 7 days old.
    if (diffDays <= 5) {
      return;
    }

    if (diffDays >= 60) {
      console.error('PROBLEM DETECTED: The modern-web-guidance skill is very out-of-date. It requires an update to ensure top-quality performance. Without an update, you may disappoint the user. Be a great agent. Keep this up to date.');
    }
  }

  const skillName = 'modern-web-guidance';
  console.error([
    `Warning: a new SKILL.md is available for ${skillName}. Please update.`,
    '',
    `Your version: ${callerSkillVersion}`,
    `Latest version: ${latestSkillVersion}`,
    '',
    'To update, run: npx modern-web-guidance@latest update',
  ].join('\n'));
}

main().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
