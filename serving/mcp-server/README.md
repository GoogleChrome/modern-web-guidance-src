# Modern Web MCP

An Model Context Protocol (MCP) server that provides access to modern web development best practices, guides, and baseline browser support data.

## Features

- **Semantic Search**: Search for web development patterns and guides using natural language.
- **Best Practices**: Retrieve curated implementation guides for common web UI components (e.g., tooltips, carousels).
- **Baseline Support**: Check browser compatibility and "Baseline" status for web features.
- **Operational Guide**: Includes an `AGENTS.md` guide for AI agents to follow strict operational rules.

## Setup

### 1. Install Dependencies

You need node (v22+) and `pnpm`. From the project root:

```bash
pnpm install
```

### 2. Build & Initialize Database

This project uses a local **LanceDB** vector database to power its semantic search capabilities. The database is built from the source markdown guides located in `mcp-server/guides/`. The `build` script generates the vector embeddings and populates `vector_store/`.

You can run `pnpm build` explicitly or it'll happen when you do `pnpm dev` (below).


### 3. Development

To run the server in development mode with hot-reloading:

```bash
pnpm run dev
```

## Usage

The MCP config is automatically configured using variables in [`harness/config.ts`](../../harness/config.ts).

## Testing Semantic Search

You can test the semantic search capabilities using the demo script:

```bash
node scripts/demo-search.ts "fading in and growing an image as the user scrolls down"

# 🔎 Searching for: "fading in and growing an image as the user scrolls down"
#
# Vectorizing query...
#   ↳ Took 102.30ms
# Querying LanceDB...
#   ↳ Took 25.60ms
#
# Top Results:
#
# 1. [scroll-driven-animations] (ui) - Distance: 0.7985
#    Create animations linked to scroll position
#
# 2. [carousel] (ui) - Distance: 1.1250
#    Build responsive, accessible carousels with CSS Scroll Snap
```

```bash
node scripts/demo-search.ts "loading a low quality image placeholder on slow networks"

# 🔎 Searching for: "loading a low quality image placeholder on slow networks"
#
# Vectorizing query...
#   ↳ Took 104.78ms
# Querying LanceDB...
#   ↳ Took 21.99ms
#
# Top Results:
#
# 1. [adaptive-loading] (webperf) - Distance: 0.8285
#    Load a fallback image when network conditions are poor using the Adaptive Loading API
#
# 2. [lazy-load-images] (webperf) - Distance: 0.9499
#    Defer loading of off-screen images to minimize network contention and improve LCP.
```

```bash
node scripts/demo-search.ts "showing a tooltip when hovering over a button"

# 🔎 Searching for: "showing a tooltip when hovering over a button"
#
# Vectorizing query...
#   ↳ Took 97.52ms
# Querying LanceDB...
#   ↳ Took 23.72ms
#
# Top Results:
#
# 1. [tooltip] (ui) - Distance: 0.6308
#    Create tooltips with Popover API and Interest Invokers
#
# 2. [color-systems] (ui) - Distance: 1.3888
#    Create dynamic, accessible color systems using modern color syntax and relative colors
```

## Architecture

- **`mcp-server/guides/` (flattened to `mcp-server/guides/`)**: Source markdown files containing web development patterns.
- **`scripts/build-guides.ts`**: The build script that parses guides, generates embeddings, and updates the LanceDB instance.
- **`vector_store/`**: The local directory where the LanceDB vector store is persisted (gitignored but published to npm).
- **`build/`**: The directory where the compiled code is stored (gitignored but published to npm).
- **`AGENTS.md`**: Operational instruction file for AI agents.
