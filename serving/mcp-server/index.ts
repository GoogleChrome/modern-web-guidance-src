import fs from 'fs';
import path from 'path';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MODERN_WEB_LOG_FILE } from "../../constants.ts";

const logDir = process.env.MODERN_WEB_LOG_DIR || process.cwd();
const logPath = path.join(logDir, MODERN_WEB_LOG_FILE);

const originalConsoleError = console.error;
console.error = (...args) => {
  // Basic formatting for the log file
  const message = args.map(a => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  fs.appendFileSync(logPath, message + '\n');
  originalConsoleError(...args);
};

async function main() {
  try {
    const { createServer } = await import("./server.ts");
    const server = createServer();
    const transport = new StdioServerTransport();

    await server.connect(transport);
  } catch (error) {
    console.error("Failed to start MCP Server:", error);
    process.exit(1);
  }
}

main();
