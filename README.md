# Guidance

A unified repository for modern web development guidance, containing both an MCP server for AI-assisted development and an evaluation suite for measuring AI adoption of modern web APIs.

## Project Structure

- **`serving/`**: The Modern Web MCP server. This provides semantic search over curated web development guides and browser support data.
- **`evaluator/`**: The Spike Runner evaluation suite. This is used to test and score AI-generated code against modern web standards and best practices.

## Getting Started

### 1. Modern Web MCP (Serving)

The MCP server allows AI agents to access high-quality implementation patterns and browser compatibility data.

```bash
cd serving
pnpm install
pnpm run build  # Generates the vector database and compiles code
pnpm start
```

For more details, see the [Serving README](./serving/mcp-server/README.md).

### 2. Spike Runner (Evaluator)

The evaluator suite measures how effectively AI models use modern web APIs in various scenarios (Greenfield, Brownfield, Redfield).

```bash
cd evaluator
pnpm install
pnpm run autorun  # Runs the full test suite and evaluation
pnpm run dashboard # Starts a local server to view results
```

## Development

This repository is managed as a monorepo. When contributing:
- Add new implementation guides to `serving/mcp-server/src/guides/`.
- Add new evaluation scenarios or checks to `evaluator/setup/` and `evaluator/checks/`.

## License

Google LLC
