# Technical Architecture Proposal: Local-First Vector MCP Server

## 1. Executive Summary

This document outlines the transition of the current "Taxonomy-based" Model Context Protocol (MCP) discovery system to a "Semantic Search" architecture. By leveraging a local-first vector stack (LanceDB + Transformers.js), we aim to solve the scalability limitations of intent discovery without sacrificing user privacy or increasing operational costs.

## 2. Problem Statement

The existing prototype relies on two primary tools: list-use-cases and describe-use-case. While effective for small datasets ($<50$ items), this approach faces several "Scaling Walls":

-   **Context Exhaustion:** Large lists of use cases consume the LLM's limited context window.
-   **Lost in the Middle:** AI agents struggle to maintain high recall when choosing from long, flat lists of IDs.
-   **Knowledge Gaps:** The agent is forced to "reason" about which tool matches the user's intent without a high-precision retrieval mechanism.

## 3. The Proposed Stack (TypeScript/Node.js)

To maintain the "local" nature of the MCP server, we will use an embedded stack that runs entirely within the server process:

<table>
  <thead>
    <tr>
      <th><br>
<strong>Component</strong></th>
      <th><br>
<strong>Technology</strong></th>
      <th><br>
<strong>Reasoning</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><br>
<strong>Protocol Layer</strong></td>
      <td><br>
@modelcontextprotocol/sdk</td>
      <td><br>
Standardizes communication with AI clients (Cursor, Claude Desktop).</td>
    </tr>
    <tr>
      <td><br>
<strong>Vector Engine</strong></td>
      <td><br>
@lancedb/lancedb</td>
      <td><br>
An embedded, serverless database that stores data in local .lance files.</td>
    </tr>
    <tr>
      <td><br>
<strong>Embedding Layer</strong></td>
      <td><br>
@huggingface/transformers</td>
      <td><br>
Runs the all-MiniLM-L6-v2 model locally via ONNX Runtime.</td>
    </tr>
    <tr>
      <td><br>
<strong>Data Format</strong></td>
      <td><br>
apache-arrow</td>
      <td><br>
High-performance memory format used by LanceDB for sub-millisecond retrieval.</td>
    </tr>
  </tbody>
</table>

## 4. Architectural Layers

### 4.1 The Knowledge Layer (Local Storage)

Instead of a remote API call, the data resides in a local hidden directory (e.g., ./.mcp-data/).

-   **Vectors:** 384-dimensional embeddings representing the "meaning" of use cases.
-   **Metadata:** JSON payloads containing the Use Case ID, category, and descriptive guidance.

### 4.2 The Semantic Engine (In-Process)

1.  **Vectorization:** User queries are converted into mathematical vectors using local CPU/GPU resources.
1.  Cosine Similarity: The system calculates the distance between the query vector and stored vectors using the formula:\
$$\text{similarity} = \frac{A \cdot B}{\|A\| \|B\|}$$
1.  **Namespacing:** Searches are scoped to specific "Library IDs" (similar to the Context7 approach) to prevent cross-library hallucinations.

## 5. System Workflow

### Step 1: Ingestion (Developer-driven)

When new use cases are added, the server runs an indexing script:

1.  Parse text descriptions.
1.  Chunk content for optimal embedding.
1.  Generate embeddings via transformers.js.
1.  Upsert to LanceDB tables.

### Step 2: Discovery (Agent-driven)

When a user asks a question (e.g., *"How do I handle rate limiting?"*):

1.  **The Agent** detects it needs documentation and calls search_use_cases(query: "rate limiting").
1.  **The Server** turns "rate limiting" into a 384-dim vector.
1.  **LanceDB** performs a K-Nearest Neighbors (KNN) search.
1.  **The Server** returns the Top 3 most relevant Use Case IDs and summaries.
1.  **The Agent** proceeds to call describe_use_case for the top match.

## 6. Key Benefits

### 6.1 Absolute Privacy

Since both the database (LanceDB) and the embedding model (Transformers.js) are local, proprietary source code and documentation never leave the developer's machine. No external API keys are required.

### 6.2 Zero Latency

Eliminating network round-trips to cloud vector providers ensures that semantic discovery happens in $<10ms$. This provides a "lag-free" experience for the user within the AI chat.

### 6.3 Cost Efficiency

There are no recurring costs for embedding APIs or managed database hosting. The only "cost" is a one-time ~80MB download of the embedding model upon first execution.

## 7. Implementation Roadmap

1.  **Phase 1:** Set up package.json with @lancedb/lancedb and @huggingface/transformers.
1.  **Phase 2:** Implement an Embedder singleton class to manage the local model lifecycle.
1.  **Phase 3:** Create the LanceDB schema and an ingestion script for existing taxonomy items.
1.  **Phase 4:** Expose the search_use_cases tool in the MCP server index.ts.
1.  **Phase 5:** Benchmark retrieval accuracy against a set of 100+ simulated use cases.

## 8. Conclusion

Moving to a local-first semantic search model allows the system to scale to thousands of use cases while maintaining the precision and privacy that local MCP servers promise. This architecture provides the technical foundation for a truly "intelligent" assistant that understands intent rather than just matching keywords.