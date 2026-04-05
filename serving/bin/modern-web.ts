#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from "util";
import { searchUseCases } from "../lib/search.ts";
import { retrieveUseCase } from "../lib/retrieve.ts";
import { getFeatureStatus, checkBaseline } from "../mcp-server/data/baseline.ts";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    search: { type: "string", short: "s" },
    retrieve: { type: "string", short: "r" },
    help: { type: "boolean", short: "h" },
    target: { type: "string" },
    feature: { type: "string" },
    'baseline-lookup': { type: "boolean" },
    'baseline-satisfies': { type: "boolean" },
  },
  allowPositionals: false,
});

function printUsage() {
  console.log(`
Usage: modern-web [options]

Options:
  -s, --search <query>          Search use cases by query
  -r, --retrieve <ids>          Retrieve use case(s) by ID(s), comma-separated
  --baseline-lookup             Look up Baseline status (requires --feature)
  --baseline-satisfies          Check if feature meets target (requires --feature and --target)
  -h, --help                    Show this help
`);
}

async function main() {
  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (values['baseline-lookup']) {
    const featureId = values.feature;
    if (!featureId) {
      console.error("--feature required for --baseline-lookup.");
      process.exit(1);
    }
    const status = getFeatureStatus(featureId);
    if (!status) {
      console.error(`Feature '${featureId}' not found.`);
      process.exit(1);
    }
    console.log(JSON.stringify(status, null, 2));
    process.exit(0);
  }

  if (values['baseline-satisfies']) {
    const target = values.target;
    const featureId = values.feature;
    if (!target || !featureId) {
      console.error("--target and --feature required for --baseline-satisfies.");
      process.exit(1);
    }
    
    try {
      const result = checkBaseline(target, featureId);
      console.log(JSON.stringify({ result }, null, 2));
      process.exit(0);
    } catch (error: any) {
      console.error(error.message);
      process.exit(1);
    }
  }

  if (values.search) {
    try {
      const results = await searchUseCases(values.search);
      console.log(JSON.stringify(results, null, 2));
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
