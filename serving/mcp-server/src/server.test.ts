import { describe, it, expect, vi } from "vitest";
import { createServer } from "./server.js";

// Mocking McpServer to verify registration
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", async () => {
  const actual = await vi.importActual("@modelcontextprotocol/sdk/server/mcp.js");
  const McpServer = vi.fn().mockImplementation(() => ({
    tool: vi.fn(),
    resource: vi.fn(),
    registerResource: vi.fn(),
    registerTool: vi.fn(),
    registerPrompt: vi.fn(),
    connect: vi.fn(),
  }));
  return { ...actual, McpServer };
});

describe("Server Resource Registration", () => {
  it("should register agents-guide resource", async () => {
    // Re-import to ensure mock is used
    const { createServer } = await import("./server.js");
    const server = createServer();

    let resourceTemplate: any;
    expect(server.registerResource).toHaveBeenCalledWith(
      "agents-guide",
      expect.anything(),
      expect.anything(),
      expect.anything()
    );

    // Capture the second argument (ResourceTemplate)
    resourceTemplate = (server.registerResource as any).mock.calls.find(
      (call: any[]) => call[0] === "agents-guide"
    )[1];

    expect(resourceTemplate).toBeDefined();

    // Verify list callback
    const listResult = await resourceTemplate.listCallback();
    expect(listResult).toEqual({
      resources: [
        {
          uri: "modern-web://agents-guide",
          name: "Agents Guide",
          mimeType: "text/markdown",
        },
      ],
    });
  });


  it("should register get_usage_guide tool", async () => {
    const { createServer } = await import("./server.js");
    const server = createServer();

    // Verify get_usage_guide is registered
    expect(server.registerTool).toHaveBeenCalledWith(
      "get_usage_guide",
      expect.objectContaining({
        description: "Get the usage guide for this MCP server (AGENTS.md)",
        inputSchema: {},
      }),
      expect.any(Function)
    );

    // Verify search_use_cases is registered
    expect(server.registerTool).toHaveBeenCalledWith(
      "search_use_cases",
      expect.objectContaining({
        description: "MANDATORY: Execute this FIRST for each and every web development use case, even if you're implementing that use case in a framework like React, especially for writing modern web code. Returns use case IDs and descriptions. You MUST subsequently call 'get_best_practices' with the most relevant ID to get the implementation guide.",
      }),
      expect.any(Function)
    );

    // Verify get_best_practices is registered
    expect(server.registerTool).toHaveBeenCalledWith(
      "get_best_practices",
      expect.objectContaining({
        description: "MANDATORY: After finding a relevant 'use_case_id' from 'search_use_cases', call this tool to retrieve the complete, actionable implementation guide. This guidance is framework-agnostic; adapt it to whatever library or framework is being used. Do not guess or hallucinate APIs; you must use the patterns in this guide.",
      }),
      expect.any(Function)
    );
  });

  it("should register setup_agents_guide prompt", async () => {
    const { createServer } = await import("./server.js");
    const server = createServer();

    // Verify setup_agents_guide is registered
    expect(server.registerPrompt).toHaveBeenCalledWith(
      "setup_agents_guide",
      expect.objectContaining({
        description: "Get instructions for setting up the agents guide in a project",
      }),
      expect.any(Function)
    );
  });
});
