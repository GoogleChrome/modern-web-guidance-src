#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from "util";
import { retrieveUseCase } from "../lib/retrieve.ts";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    search: { type: "string", short: "s" },
    retrieve: { type: "string", short: "r" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: false,
});

function printUsage() {
  console.log(`
Usage: modern-web [options]

Options:
  -s, --search <query>          Search use cases by query
  -r, --retrieve <ids>          Retrieve use case(s) by ID(s), comma-separated
  -h, --help                    Show this help
`);
}

async function main() {
  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (values.search) {
    try {
      // Dynamic import to keep the CLI loading fast -- only load the embedder if needed.
      const { searchUseCases } = await import("../lib/search.ts");
      const results = await searchUseCases(values.search);
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
  } else if (values.retrieve) {
    const ids = values.retrieve.split(",").map(id => id.trim()).filter(Boolean);
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
  } else {
    printUsage();
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
