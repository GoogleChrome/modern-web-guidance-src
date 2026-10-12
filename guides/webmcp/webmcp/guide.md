---
name: webmcp
description: Use this guide to implement WebMCP (Web Model Context Protocol) in browser applications, exposing client-side functionality as tools to AI agents via declarative or imperative APIs.
---

# WebMCP (Web Model Context Protocol)

WebMCP is a browser-native JavaScript API that allows web pages to expose their client-side functionality as structured "tools" to AI agents, browser assistants, and assistive technologies. 

IMPORTANT: WebMCP is currently in Early Preview on Chromium-based browsers (such as Chrome and Edge). It requires Chromium version `146.0.7672.0` or higher and the `#enable-webmcp-testing` flag.

**Crucial Distinction:** WebMCP runs entirely **client-side** in the browser tab. It is *not* a backend server, and it does *not* use HTTP, Server-Sent Events (SSE), or `stdio` transports. The web page itself acts as the tool registry.

Currently, WebMCP **only supports Tools**. It does not support the "Resources" or "Prompts" primitives found in the backend Model Context Protocol.

## Quick Overview

- **Imperative API**: Use `document.modelContext.registerTool()` for complex logic and dynamic interactions.
- **Declarative API**: Annotate standard HTML `<form>` elements with `toolname` and `tooldescription` to turn them into tools.

```js
if ('modelContext' in document && document.modelContext) {
  const controller = new AbortController();

  document.modelContext.registerTool(
    {
      name: 'search-items',
      description: 'Search catalog items by keyword.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keyword to match against item names and descriptions.',
          },
        },
        required: ['query'],
      },
      async execute({ query }) {
        const results = await filterCatalogUI(query);
        return { content: [{ type: 'text', text: JSON.stringify(results) }] };
      },
      annotations: {
        readOnlyHint: true,
      },
    },
    { signal: controller.signal },
  );

  // Clean up on teardown or navigation via AbortController (never call unregisterTool directly)
  window.addEventListener('pagehide', () => controller.abort(), { once: true });
}
```

```html
<form toolname="subscribe-newsletter" tooldescription="Subscribe an email address to the newsletter">
  <input type="email" name="email" required toolparamdescription="Subscriber email address" />
  <button type="submit">Subscribe</button>
</form>
```

## Best Practices

* **Naming and Semantics**: Use specific verbs describing exact behavior (e.g. `create-event` vs `start-event-creation-process`). Favor positive descriptions over listing limitations.
* **Schema Design**: Accept raw user input (avoid agent math/calculation). Ensure all parameters in `inputSchema.properties` have an explicit `type` and descriptive `description`.
* **Reliability**: Validate constraints in code and return descriptive errors for retries. Handle rate limiting gracefully. Ensure the `execute` function resolves only *after* corresponding UI state updates have completed.
* **Tool Strategy & Annotations**: Tools should be atomic, composable, and distinct. Do not force flow control instructions ("Don't call B after A") — let the agent decide. Register/unregister tools dynamically depending on the current page context. Include appropriate `annotations` on tool definitions:
  * `annotations: { readOnlyHint: true }` on tools that read or query state without mutating application data.
  * `annotations: { consequentialHint: true }` on tools that perform high-stakes or irreversible actions.
  * `annotations: { untrustedContentHint: true }` on tools whose results can contain user-generated or third-party content.
* **Clean Up**: Always pass `{ signal: controller.signal }` from an `AbortController` to `document.modelContext.registerTool()` and call `controller.abort()` to unregister tools when pages transition or resources are released. Do not call `unregisterTool()` directly.
* **Web Development Best Practices**: WebMCP tools run as client-side JavaScript in the browser tab. They must adhere to regular web development best practices (e.g., keeping secrets out of client-side code, accessing backend databases through secure API layers, and using Web Workers, WASM, or WebGPU for heavy compute).

### When to Discourage WebMCP
* **High-Risk Actions without Guardrails**: Avoid auto-submitting tools for destructive or irreversible actions (e.g., deleting data) unless the UI requires manual user confirmation outside the agent's control.
* **Hyper-Dynamic State**: If data changes faster than the agent can react, it may work with stale context.

### Anti-Patterns & Warnings (DO NOT DO THIS)

* **Do not use backend transports.** WebMCP is for browser tabs, not Node.js background processes.
* **Do not include Resources or Prompts.** These are not supported in the current WebMCP spec.
* **Do not ignore `inputSchema` structure.** Always provide clear descriptions for every parameter to minimize agent hallucinations.
* **Do not use outside of a Secure Context (HTTPS).**

## Implementation Status

WebMCP is currently in early preview in Chromium-based browsers (e.g., Chrome, Edge):

* **Current Status**: Early preview.
* **Required Version**: Chromium `146.0.7672.0` or higher.
* **Activation**: Requires enabling the flag `chrome://flags/#enable-webmcp-testing` or `edge://flags/#enable-webmcp-testing`.
* **Specification**: Evolving [Draft Community Group specification](https://webmachinelearning.github.io/webmcp/); not yet a standards-track recommendation.
