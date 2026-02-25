# Guidance

A unified repository for modern web development guidance, containing both an MCP server for AI-assisted development and an evaluation suite for measuring AI adoption of modern web APIs.

## Project Structure

- **`serving/`**: The Modern Web MCP server. This provides semantic search over curated web development guides and browser support data.
- **`harness/`**: The Guidance eval harness for executing and scoring tests.
- **`eval-view/`**: A static dashboard for visualizing and analyzing evaluation results.

## Getting Started

This project is managed as a **pnpm workspace**. You can install all dependencies for all projects with a single command from the root:

```bash
pnpm install
pnpm setup:playwright
```

### 1. Serving

#### modern-web

The MCP server allows AI agents to access high-quality implementation patterns and browser compatibility data.

```bash
cd serving
pnpm start
```

For more details, see the [Serving README](./serving/mcp-server/README.md).

This server can be enabled in the [`harness/config.ts`](./harness/config.ts) file by adding it to the `mcpServersToEnable` list.

#### google-developer-knowledge

The [Developer Knowledge MCP server](https://developers.google.com/knowledge/mcp) can be enabled in the [`harness/config.ts`](./harness/config.ts) file by adding it to the `mcpServersToEnable` list.

It requires the `MCP_API_KEY` to be set to a GCP API key with access enabled for the Developer Knowledge API.

#### Skills

Skills live in the `skills/` directory, and they are copied directly into the agent harness working directory when the `enableSkills` flag is set to true in the [`harness/config.ts`](./harness/config.ts) file.

### 2. Eval Harness & Dashboard

The evaluation suite measures how effectively AI models use modern web APIs.

```bash
# To run the full evaluation suite
pnpm suite

# To run a single isolated task
pnpm task <task_name>
# Example: pnpm task content-vis

# To generate reports from results
pnpm report

# To view the results in the dashboard
pnpm dashboard
```

## Configuration

All configuration is centralized in [`harness/config.ts`](./harness/config.ts). This file controls:

-   **Environment**: Paths to binaries (Jetski, Gemini CLI, Claude Code), API keys, and server locations.
-   **Suite**: Agent selection, number of runs, base apps, enabled MCP servers, and skills.
-   **Evaluation**: Target suite name and specific guides to run evaluation for.

All settings must be adjusted in `harness/config.ts` or via environment variables in `harness/.env`.

### Agents

Supported agents are defined in the `Agents` object in [`harness/config.ts`](./harness/config.ts).

#### Jetski

Jetski is the default agent that will be used. When running, be sure to update the settings of the Jetski automation window so that the "Review Policy" is set to "Always Proceed".

#### Gemini CLI

When using Gemini CLI, set the `GEMINI_API_KEY` environment variable with your API key.

Set the Gemini model with the environment variable (e.g. `GEMINI_MODEL='gemini-3-pro-preview'`).

#### Claude

Implemented with [Claude Code on Vertex AI](https://code.claude.com/docs/en/google-vertex-ai).

Log in with `gcloud` and set project ID with `gcloud config set project <YOUR-GCP-PROJECT-ID>`.
The GCP project must enable the Vertex AI API and `Claude Opus 4.6` in the Model Garden.

Set the following environment variables:

```
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=global
ANTHROPIC_VERTEX_PROJECT_ID=<YOUR-GCP-PROJECT-ID>
ANTHROPIC_MODEL='claude-opus-4-6'
```

## Adding Guides

Guides specific to agent tasks can be added from the `use-cases` directory to either the `skills` folder or the MCP server, depending on your architecture.

1.  **Select a Guide**: Choose a guide from the `use-cases` folder.
2.  **Add to Architecture**:
    *   **Skills**: Add the guide to the relevant `skills/` folder, and update the `SKILL.md` file to include the new guide.
    *   **MCP Server**: Add the guide to `serving/mcp-server/guides/`. **Important**: Run `pnpm build:mcp` after adding to update the server.
3.  **Enable Evaluation**:
    *   Ensure the guide has an associated `.grader.js` file for scoring.
    *   Add the guide name to the `guidesToTest` array in the `EvalConfig` object in [`harness/config.ts`](./harness/config.ts) to run the grader during suite evaluation.

For details on running tests independently for the specific use cases, see the [Use Cases README](./use-cases/README.md).

## Quality Control

Run the full preflight suite (typechecking, linting, and tests) from the root:

```bash
pnpm preflight
```

## Development

- Add implementation guides to `serving/mcp-server/guides/`.
- Add evaluation scenarios or checks to `harness/setup/` and `harness/checks/`.
- Build-free TypeScript is supported in `serving` (requires Node 24+).

## License

Google LLC
