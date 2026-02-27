import fs from 'fs';
import path from 'path';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.ts";

const logDir = process.env.MCP_LOG_DIR || process.cwd();
const logPath = path.join(logDir, "mcp-server-error.log");

const originalConsoleError = console.error;
console.error = (...args) => {
  // Basic formatting for the log file
  const message = args.map(a => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  fs.appendFileSync(logPath, message + '\n');
  originalConsoleError(...args);
};

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
