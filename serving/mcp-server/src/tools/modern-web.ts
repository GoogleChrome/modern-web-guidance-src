import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGuide } from "../data/modern-practices.js";

export function registerModernWebTools(server: McpServer) {
  server.registerTool(
    "search_use_cases",
    {
      description: "MANDATORY: Execute this FIRST for ANY request involving web development, UI creation, or modernizing web code. Returns use case IDs. You MUST subsequently call 'get_best_practices' with the most relevant ID to get the implementation guide.",
      inputSchema: {
        query: z.string().describe("Action-oriented description of the desired use case (e.g., 'lazy load images' or 'create a tooltip'). Avoid 'how to' questions and single-keyword queries (e.g. 'images')."),
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
      description: "MANDATORY: After finding a relevant 'use_case_id' from 'search_use_cases', call this tool to retrieve the complete, actionable implementation guide. Do not guess or hallucinate APIs; you must use the patterns in this guide.",
      inputSchema: {
        use_case_id: z.string().describe("The exact 'id' from the search_use_cases result (e.g. 'tooltip')."),
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
