import fs from 'fs';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const logFileIndex = process.argv.indexOf("--log-file");
if (logFileIndex !== -1 && logFileIndex + 1 < process.argv.length) {
  const logPath = process.argv[logFileIndex + 1];
  
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Basic formatting for the log file
    const message = args.map(a => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    fs.appendFileSync(logPath, message + '\n');
    originalConsoleError(...args);
  };
}

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
