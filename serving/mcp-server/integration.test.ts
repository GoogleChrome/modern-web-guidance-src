import { describe, it } from "node:test";
import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

describe("MCP Server Integration (Functional)", () => {
  it("should respond to search_use_cases tool call in a real node process", { timeout: 30000 }, async () => {
    // We cannot easily set individual test timeout inside `it` args for node:test like Vitest did (it took (name, fn, timeout)), but we can use `timeout` option in `it` or use a timer if needed. 
    // In Node:test, `it('name', { timeout: 30000 }, async () => { ... })` is supported!
    
    const transport = new StdioClientTransport({
      command: "node",
      args: [path.resolve(import.meta.dirname, "index.ts")],
      env: { ...process.env, MCP_LOG_DIR: (await import("os")).tmpdir() }
    });

    const client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} }
    );

    try {
      await client.connect(transport);

      const result = await client.callTool({
        name: "search_use_cases",
        arguments: { query: "lazy load images" },
      });

      if (!result.content || !Array.isArray(result.content)) {
        throw new Error("Expected content array in result");
      }

      const textContent = result.content[0];
      if (!textContent || textContent.type !== "text") {
        throw new Error("Expected text content");
      }

      const data = JSON.parse(textContent.text);
      assert.ok(Array.isArray(data));
      assert.ok(data.length > 0);
      assert.ok(data[0].id !== undefined);
      assert.ok(data[0].tokenCount > 0);
    } finally {
      // Ensure we always try to close the transport to avoid leaking processes
      try {
        await transport.close();
      } catch {
        // Ignore close errors
      }
    }
  }); // 30s timeout for cold start and embedding
});
