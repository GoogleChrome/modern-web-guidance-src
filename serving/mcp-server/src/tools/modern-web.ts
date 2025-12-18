import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUseCasesByCategory, getGuide } from "../data/modern-practices.js";

export function registerModernWebTools(server: McpServer) {
  server.registerTool(
    "search_use_cases",
    {
      description: "Search for modern web use cases using semantic search",
      inputSchema: {
        query: z.string().describe("The search query (e.g., 'how to improve capability')"),
      },
    },
    async ({ query }) => {
      const { Store } = await import("../lib/store.js");
      const { Embedder } = await import("../lib/embedder.js");

      const store = new Store();
      const embedder = Embedder.getInstance();

      const vector = await embedder.embed(query);
      const results = await store.search(vector);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_best_practices",
    {
      description: "Get the best practices guide for a specific use case",
      inputSchema: {
        use_case_id: z.string().describe("The ID of the use case to get the guide for"),
      },
    },
    async ({ use_case_id }) => {
      const guide = await getGuide(use_case_id);
      if (!guide) {
        return {
          content: [
            {
              type: "text",
              text: `No guide found for use case: ${use_case_id}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: guide,
          },
        ],
      };
    }
  );
}
