#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from "util";
import { retrieveUseCase } from "../lib/retrieve.ts";
import { ClearcutLogger } from "../skills-cli/telemetry/ClearcutLogger.ts";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

function printUsage() {
  console.log(`
Usage: modern-web <command> [args]

Commands:
  search <query>          Search use cases by query
  retrieve <ids>          Retrieve use case(s) by ID(s), comma-separated

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
      const logger = new ClearcutLogger();
      await logger.logSearchResult([], { latencyMs: 0, success: false });
      console.error("No search query provided.");
      process.exit(1);
    }
    const startTime = Date.now();
    try {
      // Dynamic import to keep the CLI loading fast -- only load the embedder if needed.
      const { searchUseCases } = await import("../lib/search.ts");
      const results = await searchUseCases(arg);
      const latencyMs = Date.now() - startTime;

      if (results.length === 0) {
        const logger = new ClearcutLogger();
        await logger.logSearchResult([], { latencyMs, success: true });
        console.log("[]");
      } else {
        // Instantiate logger
        const logger = new ClearcutLogger();
        // Log search results
        await logger.logSearchResult(results.map(r => r.id), { latencyMs, success: true });

        // Do a ~compressed output so users can see some of the results in their coding agent.
        // Also fewer tokens. :p
        const jsonLines = results.map(r => JSON.stringify(r));
        console.log("[" + jsonLines.join(",\n") + "]");
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const logger = new ClearcutLogger();
      await logger.logSearchResult([], { latencyMs, success: false });
      console.error("Search failed:", error);
      process.exit(1);
    }
  } else if (command === "retrieve") {
    if (!arg) {
      const logger = new ClearcutLogger();
      await logger.logRetrieveResult([], { latencyMs: 0, success: false });
      console.error("No IDs provided for retrieve.");
      process.exit(1);
    }
    const ids = arg.split(",").map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      const logger = new ClearcutLogger();
      await logger.logRetrieveResult([], { latencyMs: 0, success: false });
      console.error("No IDs provided for retrieve.");
      process.exit(1);
    }

    const startTime = Date.now();
    let retrieveErrorObj: any = undefined;

    for (const id of ids) {
      try {
        const guide = await retrieveUseCase(id);
        console.log(`\n--- Guide for ${id} ---`);
        console.log(guide);
      } catch (error) {
        retrieveErrorObj = error;
        console.error(`Retrieve failed for ${id}:`, error);
      }
    }

    // Instantiate logger
    const logger = new ClearcutLogger();
    // Log retrieve results
    await logger.logRetrieveResult(ids, { latencyMs: Date.now() - startTime, success: !retrieveErrorObj });

    if (retrieveErrorObj) {
      process.exit(1);
    }
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
