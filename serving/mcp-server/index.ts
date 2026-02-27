import fs from 'fs';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.ts";

const logFileIndex = process.argv.indexOf("--log-file");
if (logFileIndex !== -1 && logFileIndex + 1 < process.argv.length) {
  const logPath = process.argv[logFileIndex + 1];
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Basic formatting for the log file
    const message = args.map(a => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logStream.write(message + '\n');
    originalConsoleError(...args);
  };
}

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
