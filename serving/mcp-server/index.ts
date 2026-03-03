import fs from 'fs';
import path from 'path';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MCP_LOG_FILE } from "../../constants.ts";

const logDir = process.env.MCP_LOG_DIR || process.cwd();
const logPath = path.join(logDir, MCP_LOG_FILE);

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
    console.error("MCP Server running on stdio");
  } catch (error) {
    console.error("Failed to start MCP Server:", error);
    process.exit(1);
  }
}

main();
