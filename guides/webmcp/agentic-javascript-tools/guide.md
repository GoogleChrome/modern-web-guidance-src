---
name: agentic-javascript-tools
description: Programmatically register client-side JavaScript functions as tools for AI agents using the WebMCP Imperative API.
web-feature-ids:
  - document-modelcontext
---

# Agentic JavaScript Tools

The Imperative API uses `document.modelContext.registerTool()` to programmatically define JavaScript tools. This is ideal for Single Page Applications (SPAs) where tools need to be added or removed based on the current route or user state.

WebMCP operates on a producer/consumer architecture:
* **Web pages are tool producers:** You define and register tools using `document.modelContext.registerTool()`. That is all a web page needs to implement. **You do not need to call `getTools()` or `executeTool()` on the page to expose tools to agents.**
* **Browser and extension agents are the primary consumers:** Agents provided by or through the browser — including the browser's built-in agent, browser extensions, DevTools, and system-level assistants — discover and invoke registered tools out-of-band through internal platform mechanisms.
* **In-page agents and test harnesses:** `getTools()` and `executeTool()` exist specifically for in-page JavaScript assistants (e.g. an embedded chat widget or `<iframe>`) and automated test suites that need to discover and invoke tools directly within the page context.

## Registration and Lifecycle

Tools are registered by passing a tool definition object and an optional options object (`ModelContextRegisterToolOptions`), which supports two optional members:
* `signal`: An `AbortSignal` used to unregister the tool when it is no longer needed.
* `exposedTo`: An array of origin strings controlling which documents in the document tree are allowed to discover and execute the tool across frame boundaries.

### Lifecycle Handling with `AbortController`

WebMCP does not provide an `unregisterTool()` method. To unregister a tool, you must pass an `AbortSignal` during registration and abort that signal when the tool is no longer needed.

```javascript
const controller = new AbortController();

await document.modelContext.registerTool({
  name: "get_user_preferences",
  description: "Retrieves the user's saved preferences.",
  inputSchema: { type: "object", properties: {} },
  execute() {
    const prefs = localStorage.getItem("user_prefs");
    return prefs ? JSON.parse(prefs) : { theme: "light" };
  },
  annotations: { readOnlyHint: true }
}, { signal: controller.signal });

// To unregister the tool (e.g., on component unmount):
controller.abort();
```

Aborting the registration signal only unregisters the tool — it does not cancel executions that are already running. Tools that start long-running work must also honor the per-execution signal described below, or unregistering will leave orphaned requests and stale UI updates behind.

### Controlling cross-origin tool exposure with `exposedTo`

By default, a registered tool is private to the registering document and same-origin frames. When your application is embedded in an `<iframe>` (or embeds third-party widgets) and you need ancestor or sibling frames to discover and invoke the tool, specify the allowed origins using `exposedTo`.

```javascript
const controller = new AbortController();

await document.modelContext.registerTool({
  name: "get_cart_items",
  description: "Retrieves items currently in the user's shopping cart.",
  inputSchema: { type: "object", properties: {} },
  async execute(input, { signal }) {
    return await cartService.getItems({ signal });
  },
  annotations: { readOnlyHint: true },
}, {
  signal: controller.signal,
  exposedTo: ["https://checkout.example.com"],
});
```

* **Mutual opt-in handshake**: Cross-origin tool discovery is a two-way opt-in. The tool provider frame authorizes the consumer origin via `exposedTo`, and the consumer frame must explicitly request that provider origin via `getTools({ fromOrigins: [...] })`. Without `fromOrigins`, `getTools()` queries only same-origin documents.
* **Origin matching**: The registering document's own origin always has access. Origins specified in `exposedTo` are granted permission to discover the tool via `document.modelContext.getTools({ fromOrigins: [...] })` and execute it via `document.modelContext.executeTool()`.
* **Security requirement**: Every origin in `exposedTo` MUST be potentially trustworthy (HTTPS or localhost). Passing an invalid or non-secure origin causes `registerTool()` to reject with a `SecurityError`.
* **Scope**: `exposedTo` controls in-page cross-document discovery across frames in the document tree.

## Defining Parameters

Parameters (params) are defined using the `inputSchema` property. This must be a **JSON Schema** object that describes the structured data the tool expects.

```javascript
await document.modelContext.registerTool({
  name: "calculate_area",
  description: "Calculates the area of a rectangle.",
  inputSchema: {
    type: "object",
    properties: {
      width: { type: "number", description: "The width of the rectangle." },
      height: { type: "number", description: "The height of the rectangle." }
    },
    required: ["width", "height"]
  },
  execute(input) {
    // input is { width: 10, height: 20 }
    return input.width * input.height;
  },
  annotations: { readOnlyHint: true }
});
```

## Execution Patterns

The `execute` callback always receives two arguments: the input object, and an options object carrying an `AbortSignal` — `execute(inputObject, { signal })`.

### When to use `async execute`
Use `async` when the tool involves operations that return a Promise or take time to complete:
- **Network calls**: Fetching data from an API.
- **Asynchronous Storage**: Accessing IndexedDB.
- **External Events**: Waiting for a specific state change or animation to finish.

```javascript
async execute(input, { signal }) {
  const response = await fetch(`/api/data/${input.id}`, { signal });
  return await response.json();
}
```

### When to use `execute` (Synchronous)
Use a standard synchronous function for immediate operations. A synchronous tool runs to completion before cancellation can be observed, so it can ignore the signal:
- **Pure logic**: Math, filtering, or sorting data already in memory.
- **Synchronous state**: Reading from `localStorage` or a synchronous state manager.

```javascript
execute(input) {
  return input.items.filter(item => item.active);
}
```

### Cancelling in-flight executions

Cancellation is initiated by the user or the agent. **MANDATORY:** Any tool that performs network requests or other long-running async work MUST honor `signal`, otherwise cancelled executions keep consuming resources and can write stale data into the UI after the agent has moved on.

* **APIs that accept a signal** (`fetch()`, `addEventListener()`, `ReadableStream` readers): pass `signal` straight through.
* **APIs that do not** (`setTimeout`, `setInterval`, polling loops, `await`-heavy pipelines): call `signal.throwIfAborted()` between steps, and/or reject on `signal.addEventListener('abort', ...)`. Timers accept no signal, so you must clear them yourself in the abort listener.

```javascript
await document.modelContext.registerTool({
  name: "fetch_tool",
  description: "Fetch the text content of a URL and show it on the page.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch" },
      priority: {
        type: "string",
        enum: ["high", "low", "auto"],
        description: "Relative network priority for the request",
      },
    },
    required: ["url"],
  },
  execute: async ({ url, priority }, { signal }) => {
    const output = document.querySelector("pre");
    output.textContent = "Loading…";
    try {
      // Passing `signal` aborts the network request the moment execution is cancelled.
      const response = await fetch(url, { priority, signal });
      const text = await response.text();
      output.textContent = text;
      return text;
    } catch (err) {
      // Roll back the UI state this execution set, so a cancelled run leaves no trace.
      output.textContent = "";
      // Re-throw, including AbortError: it carries the caller's cancellation reason.
      throw err;
    }
  },
  annotations: { readOnlyHint: true }
});
```

## Flagging Consequential Tools

Since Chrome 154, `annotations` supports `consequentialHint`. Set it to `true` for tools that take high-stakes, irreversible, or real-world actions — booking travel, moving money, sending messages, or deleting data. It signals agents to request explicit user confirmation before execution.

```javascript
await document.modelContext.registerTool({
  name: 'book_flight',
  description: 'Book a flight for the user with confirmed flight details.',
  inputSchema: {
    type: 'object',
    properties: {
      flightId: { type: 'string', description: 'ID of the flight to book' },
      passengers: { type: 'number', description: 'Number of tickets to purchase' },
    },
    required: ['flightId', 'passengers'],
  },
  execute: async ({ flightId, passengers }, { signal }) => {
    // Forward `signal` to the transaction API to honor cancellation:
    return await bookFlightReservation({ flightId, passengers }, { signal });
  },
  annotations: {
    readOnlyHint: false,      // This tool mutates state (it makes a booking).
    consequentialHint: true,  // Spends money and is not trivially reversible.
    untrustedContentHint: false, // Output is first-party data, not third-party content.
  }
});
```

**MANDATORY:** Treat `consequentialHint` as a hint, not an enforcement mechanism. It does not block execution on its own, and browsers that predate the hint will not prompt at all. Keep whatever in-app confirmation the action already warrants.

## Flagging Debugging Tools

Since Chrome 156, `annotations` supports `debugging`. Set `annotations.debugging` to `true` for tools built for debugging and developer tooling rather than end-user tasks. Examples: dumping internal app state, toggling feature flags, or seeding test data. This lets agents tell developer-only tools apart from tools meant to act for the user. It defaults to `false`. In-page agents and test harnesses can read it from `RegisteredTool.annotations.debugging` via `getTools()`.

```javascript
await document.modelContext.registerTool({
  name: "dump_app_state",
  description: "Returns a snapshot of the internal application store for debugging.",
  execute() {
    return appStore.getState();
  },
  annotations: {
    readOnlyHint: true, // Only reads state.
    debugging: true,    // Developer tooling, not an end-user action.
  }
});
```

## In-Page Agents and Testing (`getTools` and `executeTool`)

**Web pages do not need `getTools()` or `executeTool()` to expose tools to AI agents.** Simply calling `document.modelContext.registerTool()` is all that is required for browser agents, browser extensions, DevTools, and system-level assistants to discover and execute your tools out-of-band.

The `getTools()` and `executeTool()` methods exist specifically for consumers running inside the JavaScript environment:
1. **In-page JavaScript agents:** An AI assistant, copilot widget, or chat interface embedded directly in the page (or running inside an `<iframe>`) that needs to discover what tools the surrounding page or accessible frames in the document tree offer, and invoke them on behalf of the user.
2. **Automated testing and debugging:** Test suites (such as Playwright, Vitest, or in-browser unit tests) that inspect registered tool metadata and simulate agent tool invocations without requiring a live external LLM harness.

### Discovering available tools with `getTools()`

In-page agents call `document.modelContext.getTools()` to retrieve an array of `RegisteredTool` objects from the current document and any accessible frames in the document tree.

Since Chrome 155, `RegisteredTool.inputSchema` is returned directly as a JavaScript object (a deep copy of the schema supplied at registration). Mutating this object does not alter the registered tool's actual schema.

```javascript
// Example: An in-page AI assistant discovering tools available on the page:
const tools = await document.modelContext.getTools();

// In-page agents can listen for tools being registered or unregistered dynamically:
document.modelContext.addEventListener("toolchange", async () => {
  const updatedTools = await document.modelContext.getTools();
  console.log(`Active tools updated: ${updatedTools.map((t) => t.name).join(", ")}`);
});
```

To discover tools registered inside cross-origin descendant iframes (which must explicitly grant access via `exposedTo` during registration), pass `fromOrigins` in the options dictionary:

```javascript
// Query tools registered in the embedded cart frame that exposed them to this checkout origin:
const cartTools = await document.modelContext.getTools({
  fromOrigins: ["https://cart.example.com"],
});
```

### Invoking tools with `executeTool()`

In-page agents and test scripts call `document.modelContext.executeTool(tool, inputObject, options)` to execute a registered tool. The tool runs on the document where it was registered, and the promise resolves to the stringified result returned by the tool's `execute` callback.

Since Chrome 155, `executeTool()` accepts a plain JavaScript object directly for `inputObject`, matching the input format your tool's `execute` callback receives.

```javascript
// 1. Discover the tool (typically done during agent initialization or test setup):
const tools = await document.modelContext.getTools();
const areaTool = tools.find((t) => t.name === "calculate_area");

if (areaTool) {
  const controller = new AbortController();
  // Example input payload matching the tool's inputSchema:
  const inputObject = { width: 10, height: 20 };
  const options = { signal: controller.signal };

  // 2. Pass input arguments as a JavaScript object, with a JSON string fallback for Chrome <155:
  let resultString;
  try {
    resultString = await document.modelContext.executeTool(areaTool, inputObject, options);
  } catch (err) {
    if (err?.message?.startsWith("Failed to parse input")) {
      resultString = await document.modelContext.executeTool(
        areaTool,
        JSON.stringify(inputObject),
        options
      );
    } else {
      // Re-throw real tool execution or cancellation errors:
      throw err;
    }
  }

  console.log("Execution output string:", resultString);
}
```

The returned promise rejects if:
* `inputObject` is not an object or cannot be serialized to a JSON string (e.g. circular references or `BigInt` values). Note that values omitted by JSON serialization (such as functions and `undefined`) will be omitted from the object received by the tool rather than causing a rejection.
* The execution is aborted via `options.signal`.
* The tool was unregistered prior to execution or encounters an unhandled runtime error.

## Tool Factory Pattern

To pass context (like stores or application instances) to your tools, use factory functions.

```javascript
export function createInventoryTool(inventoryManager) {
  return {
    name: "get_inventory",
    description: "Lists items in the inventory.",
    inputSchema: { type: "object", properties: {} },
    execute() {
      return inventoryManager.getItems();
    },
    annotations: { readOnlyHint: true }
  };
}
```

## API Notes

*   **annotations**: (Optional) A dictionary for tool metadata.
    *   **readOnlyHint**: (Optional) Set to `true` if the tool does not modify any state and only reads data. This helps agents decide when it is safe to call the tool.
    *   **consequentialHint**: (Optional, Chrome 154+) Set to `true` for high-stakes, irreversible, or real-world actions so agents request user confirmation first.
    *   **untrustedContentHint**: (Optional) Set to `true` when the tool returns content your site does not control, such as user-generated text or third-party API responses.
    *   **debugging**: (Optional, Chrome 156+) Set to `true` when the tool is meant for debugging and developer tooling, not end-user tasks. Defaults to `false`.
*   **Registration Options**:
    *   **signal**: (Optional) An `AbortSignal` used to unregister the tool when it is no longer needed.
    *   **exposedTo**: (Optional) An array of secure origin strings controlling which documents in the document tree are allowed to discover and execute the tool across frame boundaries.
*   **Tool Discovery Options (`ModelContextGetToolOptions`)**:
    *   **fromOrigins**: (Optional) An array of secure origin strings to query in accessible frames. Calling `getTools()` without `fromOrigins` queries only same-origin documents.
*   **Return Format**: The `execute` function can return any value (object, array, string, number, boolean). Select a structure that best serves your specific use case while ensuring the content is optimized for the LLM to process. The output may encompass raw data, specific error logs, or direct instructions to influence the agent's next action.
*   **Secure Context**: WebMCP requires HTTPS. All origins in `exposedTo` and `fromOrigins` must also be potentially trustworthy.
*   **Deprecated/Removed**: `navigator.modelContext` (deprecated in Chromium 150), `unregisterTool()`, `provideContext()`, and `clearContext()` are no longer supported.

## Fallback strategies

{{ BASELINE_STATUS("document-modelcontext") }}

The WebMCP Imperative API should be used with feature detection to ensure compatibility with browsers that do not yet support WebMCP.

```javascript
if ('modelContext' in document) {
  // Register tools
}
```
