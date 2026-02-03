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
pnpm --filter eval-view exec playwright install
```

### 1. Modern Web MCP (Serving)

The MCP server allows AI agents to access high-quality implementation patterns and browser compatibility data.

```bash
cd serving
pnpm start
```

For more details, see the [Serving README](./serving/mcp-server/README.md).

### 2. Eval Harness & Dashboard

The evaluation suite measures how effectively AI models use modern web APIs.

```bash
# To run the evaluation harness
pnpm --filter harness run autorun

# To view the results in the dashboard
pnpm run dashboard
```

## Quality Control

Run the full preflight suite (typechecking, linting, and tests) from the root:

```bash
pnpm run preflight
```

## Development

- Add implementation guides to `serving/mcp-server/guides/`.
- Add evaluation scenarios or checks to `harness/setup/` and `harness/checks/`.
- Build-free TypeScript is supported in `serving` (requires Node 24+).

## License

Google LLC
