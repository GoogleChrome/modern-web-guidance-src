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
# To run the full evaluation suite
pnpm suite

# To run a single isolated task
pnpm task <directory> "<prompt>"

# To generate reports from results
pnpm report

# To view the results in the dashboard
pnpm dashboard
```

## Configuration

Configuration variables are defined in [`harness/config.ts`](./harness/config.ts), and environment variables can be set in [`harness/.env`](./harness/.env).

### Flags

Flags for the agent harness reside in [`harness/run_suite.ts`](./harness/run_suite.ts).

```
# Specify agent and test dir name
pnpm suite --agent=gemini_cli --name=my_test_run
# OR
pnpm task <directory> "<prompt>" --agent=gemini_cli --name=my_test_run
```

Flags for the report reside in [`harness/evaluate.ts`](./harness/evaluate.ts).

```
# Specify test dir name to evaluate
pnpm report --test_dir=my_test_run
```

### Agents

Jetski is the default agent that will be used. When running, be sure to update the settings of the Jetski automation window so that the "Review Policy" is set to "Always Proceed".

When using Gemini CLI, set the `GEMINI_API_KEY` environment variable with your API key.

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
