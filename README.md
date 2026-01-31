# Guidance

A unified repository for modern web development guidance, containing both an MCP server for AI-assisted development and an evaluation suite for measuring AI adoption of modern web APIs.

## Project Structure

- **`serving/`**: The Modern Web MCP server. This provides semantic search over curated web development guides and browser support data.
- **`harness/`**: The Spike Runner evaluation harness.
- **`eval-view/`**: The dashboard for viewing evaluation results. The Spike Runner evaluation suite. This is used to test and score AI-generated code against modern web standards and best practices.

## Getting Started

This project is managed as a **pnpm workspace**. You can install all dependencies for both the MCP server and the evaluator with a single command from the root:

```bash
pnpm install
```

### 1. Modern Web MCP (Serving)

The MCP server allows AI agents to access high-quality implementation patterns and browser compatibility data.

```bash
cd serving
pnpm run build  # Generates the vector database and compiles code
pnpm start
```

For more details, see the [Serving README](./serving/mcp-server/README.md).

### 2. Spike Runner (Evaluator)

The evaluator suite measures how effectively AI models use modern web APIs in various scenarios (Greenfield, Brownfield, Redfield).

```bash
cd evaluator
pnpm run autorun  # Runs the full test suite and evaluation
pnpm run dashboard # Starts a local server to view results
```

## Development

This repository is managed as a monorepo. When contributing:
- Add new implementation guides to `serving/mcp-server/guides/`.
- Add new evaluation scenarios or checks to `harness/setup/` and `harness/checks/`.

## License

Google LLC
