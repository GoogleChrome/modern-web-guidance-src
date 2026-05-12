#!/usr/bin/env node --experimental-strip-types

import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { retrieveUseCase } from "../lib/retrieve.ts";
import { ClearcutLogger } from "../skills-cli/telemetry/ClearcutLogger.ts";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
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
        const searchItems = results.map(r => ({
          guide_id: r.id,
          score: parseFloat((1 - parseFloat(r.distance)).toFixed(4)),
        }));
        await logger.logSearchResult(searchItems, { latencyMs, success: true });

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
      await logger.logRetrieveResult("", { latencyMs: 0, success: false });
      console.error("No IDs provided for retrieve.");
      process.exit(1);
    }
    const ids = arg.split(",").map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      const logger = new ClearcutLogger();
      await logger.logRetrieveResult("", { latencyMs: 0, success: false });
      console.error("No IDs provided for retrieve.");
      process.exit(1);
    }

    const logger = new ClearcutLogger();
    let hasError = false;

    for (const id of ids) {
      const startTime = Date.now();
      try {
        const guide = await retrieveUseCase(id);
        console.log(`\n--- Guide for ${id} ---`);
        console.log(guide);
        await logger.logRetrieveResult(id, { latencyMs: Date.now() - startTime, success: true });
      } catch (error) {
        hasError = true;
        console.error(`Retrieve failed for ${id}:`, error);
        await logger.logRetrieveResult(id, { latencyMs: Date.now() - startTime, success: false });
      }
    }

    if (hasError) {
      process.exit(1);
    }
  } else if (command === "install") {
    const extraArgs = process.argv.slice(3);
    const child = spawn("npx", ["skills", "add", "GoogleChrome/modern-web-guidance", ...extraArgs], {
      stdio: ["inherit", "pipe", "inherit"],
      env: { ...process.env, FORCE_COLOR: "1" }
    });

    let capturedStdout = "";
    child.stdout?.on("data", (data) => {
      capturedStdout += data.toString();
      process.stdout.write(data);
    });

    const status = await new Promise<number>((resolve) => {
      child.on("close", (code) => resolve(code ?? 0));
      child.on("error", (err) => {
        console.error("Install failed:", err);
        resolve(1);
      });
    });

    // Post-process capturedStdout to extract successfully installed skill names and log telemetry.
    const cleanOutput = capturedStdout.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    const skills: string[] = [];
    
    // Scope checkmark extraction strictly inside the "Installed skill(s)" summary box to avoid false matches.
    const installedBoxMatch = cleanOutput.match(/Installed \d+ skill[\s\S]*?├─/);
    if (installedBoxMatch) {
      const boxContent = installedBoxMatch[0];
      const regex = /✓\s*([a-zA-Z0-9_-]+)/g;
      let match;
      while ((match = regex.exec(boxContent)) !== null) {
        skills.push(match[1]);
      }
    }

    const logger = new ClearcutLogger();
    await logger.logInstallation(skills, { success: status === 0 });

    process.exit(status);
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
}

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


main().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
