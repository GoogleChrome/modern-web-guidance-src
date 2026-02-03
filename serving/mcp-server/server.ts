import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerModernWebTools } from "./tools/modern-web.ts";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const server = new McpServer({
    name: "modern-web-mcp",
    version: "1.0.0",
  });

  registerModernWebTools(server);

  server.registerResource(
    "agents-guide",
    new ResourceTemplate("modern-web://agents-guide", {
      list: async () => {
        return {
          resources: [
            {
              uri: "modern-web://agents-guide",
              name: "Agents Guide",
              mimeType: "text/markdown",
            },
          ],
        };
      },
    }),
    { mimeType: "text/markdown" },
    async (uri, { _request }) => {
      const possiblePaths = [
        path.resolve(__dirname, "AGENTS.md"), // In build/
        path.resolve(__dirname, "../AGENTS.md"), // In root (dev fallback)
      ];

      let content: string | null = null;
      for (const p of possiblePaths) {
        try {
          content = await fs.readFile(p, "utf-8");
          break;
        } catch {
          // Ignore and try next
        }
      }

      if (!content) {
        throw new Error("Failed to find AGENTS.md");
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: content,
            mimeType: "text/markdown",
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_usage_guide",
    {
      description: "Get the usage guide for this MCP server (AGENTS.md)",
      inputSchema: {},
    },
    async () => {
      const possiblePaths = [
        path.resolve(__dirname, "AGENTS.md"), // In build/
        path.resolve(__dirname, "../AGENTS.md"), // In root (dev fallback)
      ];

      let content: string | null = null;
      for (const p of possiblePaths) {
        try {
          content = await fs.readFile(p, "utf-8");
          break;
        } catch {
          // Ignore and try next
        }
      }

      if (!content) {
        throw new Error("Failed to find AGENTS.md");
      }

      return {
        content: [
          {
            type: "text",
            text: content,
          },
        ],
      };
    }
  );

  server.registerPrompt(
    "setup_agents_guide",
    {
      description: "Get instructions for setting up the agents guide in a project",
    },
    async () => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You are an agent helper. Your goal is to help the user set up their project with modern web best practices.

Please read the operational guide using the \`get_usage_guide\` tool.
Then, check if a file named \`AGENTS.md\` exists in the root of the user's project.
- If it does NOT exist, create it with the exact contents of the guide.
- If it DOES exist, append the guide contents to the end of the existing file, ensuring there is a new line before appending.`,
            },
          },
        ],
      };
    }
  );

  return server;
}
