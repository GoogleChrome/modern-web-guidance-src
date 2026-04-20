---
name: webmcp
description: Instructions for implementing and interacting with WebMCP on websites using both declarative and imperative APIs. Use this when asked to implement WebMCP tools or fix WebMCP integration.
---

# WebMCP (Web Model Context Protocol)

WebMCP is a browser-native JavaScript API that allows web pages to expose their client-side functionality as structured "tools" to AI agents, browser assistants, and assistive technologies. 

> [!IMPORTANT]
> WebMCP is currently **Chrome-only** (Early Preview). It requires Chrome `146.0.7672.0` or higher and the `#enable-webmcp-testing` flag. See [implementation-status.md](references/implementation-status.md) for details.

**Crucial Distinction:** WebMCP runs entirely **client-side** in the browser tab. It is *not* a backend server, and it does *not* use HTTP, Server-Sent Events (SSE), or `stdio` transports. The web page itself acts as the tool registry.

Currently, WebMCP **only supports Tools**. It does not support the "Resources" or "Prompts" primitives found in the backend Model Context Protocol.

## Quick Overview

- **Imperative API**: Use `navigator.modelContext.registerTool()` for complex logic and dynamic interactions.
- **Declarative API**: Annotate standard HTML `<form>` elements with `toolname` and `tooldescription` to turn them into tools.

## Progressive Disclosure

- **Imperative API Details**: See [imperative.md](references/imperative.md) for `ToolRegistry` patterns and lifecycle handling using `AbortController`.
- **Declarative API Details**: See [declarative.md](references/declarative.md) for HTML attributes, `SubmitEvent` interception (`agentInvoked`, `respondWith()`), and visual feedback CSS.
- **Implementation Status**: See [implementation-status.md](references/implementation-status.md) for implementation status and browser requirements.
- **Best Practices**: See [best-practices.md](references/best-practices.md) for naming and schema design, reliability, and anti-patterns.
