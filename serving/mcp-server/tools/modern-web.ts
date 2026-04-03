import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGuide } from "../../lib/practices.ts";
import { logToolResult } from "../../lib/logger.ts";

export function registerModernWebTools(server: McpServer) {
  server.registerTool(
    "search_use_cases",
    {
      description: `IMPORTANT: This is a search tool that will help you find the most modern and recommended way to implement any web development use case.

      MANDATORY: You MUST execute this FIRST for each and every web development use case, even if you're implementing that use case in a framework like React, especially for writing modern web code. No matter the complexity, you MUST call this tool for ALL web development tasks touching HTML, CSS, or JavaScript.

      Do NOT skip this step even if you already know how to implement the use case — web platform APIs evolve rapidly and your training data may recommend outdated approaches. This tool ensures you use the current best practice.

      Returns use case IDs and descriptions. You MUST subsequently call 'get_best_practices' with the most relevant ID to get the implementation guide.`,
      inputSchema: {
        query: z.string().describe("Action-oriented description of the desired use case (e.g., 'lazy load images' or 'show a tooltip on hover'). Avoid 'how to' questions and single-keyword queries (e.g. 'images'). Capture the abstract, high-level use case, while avoiding content-specific details (e.g. 'display a carousel of images' instead of 'swipe through historical portraits')."),
      },
    },
    async ({ query }) => {
      const { Store } = await import("../../lib/store.ts");
      const { Embedder } = await import("../lib/embedder.ts");

      const store = new Store();
      const embedder = Embedder.getInstance();

      const vector = await embedder.embed(query);
      const results = await store.search(vector);

      logToolResult("search_use_cases", results.map(r => ({ id: r.id, distance: r.distance })));

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
      description: `This is a retrieval tool that returns the complete, actionable implementation guide for a given web development use case.

      MANDATORY: After finding a relevant 'use_case_id' from 'search_use_cases', call this tool to retrieve the complete, actionable implementation guide. This guidance is framework-agnostic; adapt it to whatever library or framework is being used. Do not guess or hallucinate APIs; you must use the patterns in this guide.`,
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

      logToolResult("get_best_practices", [{ id: use_case_id }]);

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
