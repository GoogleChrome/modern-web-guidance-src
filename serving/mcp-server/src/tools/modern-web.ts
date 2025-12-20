import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUseCasesByCategory, getGuide } from "../data/modern-practices.js";

export function registerModernWebTools(server: McpServer) {
  server.registerTool(
    "list_use_cases",
    {
      description: "MANDATORY: Execute this FIRST for each and every web development use case, especially for writing modern web code. Returns use case IDs. You MUST subsequently call 'get_best_practices' with the most relevant ID to get the implementation guide.",
      inputSchema: {
        category: z.string().optional().describe("Category to filter by (e.g., 'webperf', 'ui')"),
      },
    },
    async ({ category }) => {
      const useCases = getUseCasesByCategory(category);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(useCases, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_best_practices",
    {
      description: "MANDATORY: After finding a relevant 'use_case_id' from 'list_use_cases', call this tool to retrieve the complete, actionable implementation guide. Do not guess or hallucinate APIs; you must use the patterns in this guide.",
      inputSchema: {
        use_case_id: z.string().describe("The exact 'id' from the list_use_cases result (e.g. 'tooltip')."),
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
