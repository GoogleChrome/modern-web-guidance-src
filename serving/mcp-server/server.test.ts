import { describe, it, expect, vi } from "vitest";

// Mocking McpServer to verify registration
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", async () => {
  const actual = await vi.importActual("@modelcontextprotocol/sdk/server/mcp.js");
  const McpServer = vi.fn().mockImplementation(function () {
    return {
      tool: vi.fn(),
      resource: vi.fn(),
      registerResource: vi.fn(),
      registerTool: vi.fn(),
      registerPrompt: vi.fn(),
      connect: vi.fn(),
    };
  });
  return { ...actual as object, McpServer };
});

describe("Server Registration", () => {
  it("should register search_use_cases and get_best_practices tools", async () => {
    const { createServer } = await import("./server.ts");
    const server = createServer();

    // Verify search_use_cases is registered
    expect(server.registerTool).toHaveBeenCalledWith(
      "search_use_cases",
      expect.objectContaining({
        description: expect.stringContaining("web development use case"),
      }),
      expect.any(Function)
    );

    // Verify get_best_practices is registered
    expect(server.registerTool).toHaveBeenCalledWith(
      "get_best_practices",
      expect.objectContaining({
        description: expect.stringContaining("implementation guide"),
      }),
      expect.any(Function)
    );
  });

  describe("Tool Handlers Functional Tests", () => {
    it("search_use_cases should return results", async () => {
      const { createServer } = await import("./server.ts");
      const server = createServer();

      const searchCall = (server.registerTool as any).mock.calls.find(
        (call: any[]) => call[0] === "search_use_cases"
      );
      const handler = searchCall[2];

      const result = await handler({ query: "tooltip" });
      expect(result.content[0].type).toBe("text");
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data)).toBe(true);
    });

    it("get_best_practices should return guide content", async () => {
      const { createServer } = await import("./server.ts");
      const server = createServer();

      const getPracticesCall = (server.registerTool as any).mock.calls.find(
        (call: any[]) => call[0] === "get_best_practices"
      );
      const handler = getPracticesCall[2];

      const result = await handler({ use_case_id: "tooltip" });
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Tooltip");
    });
  });
});
