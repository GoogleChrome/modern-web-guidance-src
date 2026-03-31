import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
describe("MCP Server Integration (Functional)", () => {
  it("should respond to search_use_cases tool call in a real node process", async () => {
    // This test runs the actual server using the same 'node' command that users use.
    // This catches issues that unit tests with mocks might miss, such as:
    // 1. Missing .ts extensions in dynamic imports
    // 2. Runtime environment issues (Node version compatibility)
    // 3. Actual dependency resolution (LanceDB, Transformers, etc.)

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
        arguments: { query: "performance" },
      });

      if (!result.content || !Array.isArray(result.content)) {
        throw new Error("Expected content array in result");
      }

      const textContent = result.content[0];
      if (!textContent || textContent.type !== "text") {
        throw new Error("Expected text content");
      }

      const data = JSON.parse(textContent.text);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].id).toBeDefined();
    } finally {
      // Ensure we always try to close the transport to avoid leaking processes
      try {
        await transport.close();
      } catch {
        // Ignore close errors
      }
    }
  }, 30000); // 30s timeout for cold start and embedding
});
