#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from "util";
import { spawnSync } from "child_process";
import { retrieveUseCase } from "../lib/retrieve.ts";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
  strict: false,
});

function printUsage() {
  console.log(`
Usage: modern-web <command> [args]

Commands:
  search <query>          Search use cases by query
  retrieve <ids>          Retrieve use case(s) by ID(s), comma-separated
  install                 Install skills

Options:
  -h, --help              Show this help
`);
}

async function main() {
  if (values.help || positionals.length === 0) {
    printUsage();
    process.exit(values.help ? 0 : 1);
  }

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
    const extraArgs = process.argv.slice(3);
    const result = spawnSync("npx", ["skills", "add", "GoogleChrome/modern-web-guidance", ...extraArgs], {
      stdio: "inherit",
    });
    if (result.error) {
      console.error("Install failed:", result.error);
      process.exit(1);
    }
    process.exit(result.status ?? 0);
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
