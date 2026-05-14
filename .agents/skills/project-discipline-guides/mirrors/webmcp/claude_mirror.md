# WebMCP Common Knowledge Guide

A reference of default conventions, APIs, and best practices I would apply by default when writing WebMCP integrations in a browser context. This is intentionally exhaustive (no prioritization, no omissions for brevity).

---

## 1. What WebMCP Is

- WebMCP brings the Model Context Protocol (MCP) into the browser, letting a web page expose **tools**, **resources**, and **prompts** to an in-browser AI agent (or external client through a browser bridge).
- The page is the *server*; the user agent (browser/extension/embedded model) is the *client*.
- The core surface is `navigator.modelContext` (sometimes proposed under `window.ai.mcp` / `navigator.ai` in earlier drafts). Treat the entry point as feature-detected.
- WebMCP is a progressive enhancement: pages should function fully without it.

---

## 2. Feature Detection & Initialization

Always feature-detect before touching the API. Never assume presence.

```js
if ('modelContext' in navigator) {
  const mc = navigator.modelContext;
  // register tools/resources/prompts
}
```

- Detect *capabilities*, not user agents.
- Wrap registration in a try/catch — APIs may exist but throw on unsupported options.
- Defer registration until DOM is ready when tools depend on DOM state:

```js
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', register, { once: true });
} else {
  register();
}
```

- Listen for the `modelcontextchange` (or equivalent) event if the runtime can be enabled/disabled mid-session.

---

## 3. Tool Registration

A **tool** is a callable function exposed to the agent. The standard registration shape:

```js
navigator.modelContext.registerTool({
  name: 'add_to_cart',
  description: 'Adds a product to the user\'s shopping cart.',
  inputSchema: {
    type: 'object',
    properties: {
      productId: { type: 'string', description: 'SKU of the product' },
      quantity: { type: 'integer', minimum: 1, default: 1 },
    },
    required: ['productId'],
    additionalProperties: false,
  },
  async execute({ productId, quantity }) {
    const result = await cart.add(productId, quantity);
    return { content: [{ type: 'text', text: `Added ${quantity}× ${productId}` }] };
  },
});
```

### Naming
- `snake_case` for tool names — matches MCP convention and is friendlier for LLM tool-call decoding.
- Verbs first: `search_products`, `open_dialog`, `submit_form`.
- Namespace when collisions are possible: `cart.add_item`, `nav.go_to`.
- Names should be stable; renaming a tool is a breaking change for any persisted agent context.

### Descriptions
- Write descriptions for the *model*, not the developer. State purpose, side effects, and constraints in plain English.
- Mention preconditions (“user must be logged in”), idempotency, and what the agent should *not* use the tool for.
- Keep under ~1–2 sentences when possible; the description is part of every prompt.

### Lifetime
- `registerTool` typically returns an unregister handle (function or `Disposable`). Hold it and clean up on SPA route change or component unmount.
- Re-register tools when the page state that backs them changes (e.g., after login, the `logout` tool becomes available).

---

## 4. Input Schema (JSON Schema) Design

Tools use **JSON Schema Draft 2020-12** for their input shape. This is the model’s contract.

### Defaults
- Always set `type: 'object'` at the top level.
- Always set `additionalProperties: false` — prevents the model from passing junk and tightens validation.
- Always list `required` explicitly; don’t rely on truthiness.
- Use `description` on *every* property — the model reads them.
- Use `enum` for closed sets; use `format` for `date-time`, `email`, `uri`, etc.
- Prefer `integer` over `number` when fractional values are nonsensical.
- Use `minimum`/`maximum`/`minLength`/`maxLength`/`pattern` to constrain. The model will follow these.

### Schema patterns

```js
inputSchema: {
  type: 'object',
  additionalProperties: false,
  required: ['query'],
  properties: {
    query: { type: 'string', minLength: 1, description: 'Search terms' },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
    sort: { type: 'string', enum: ['relevance', 'price_asc', 'price_desc'] },
    filters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        inStock: { type: 'boolean' },
        priceRange: {
          type: 'object',
          additionalProperties: false,
          properties: {
            min: { type: 'number', minimum: 0 },
            max: { type: 'number', minimum: 0 },
          },
        },
      },
    },
  },
}
```

### Anti-patterns
- Free-form `object` with no properties (`{ type: 'object' }` alone) — the model has no signal.
- `oneOf`/`anyOf` at the top level — split into separate tools instead. One tool, one job.
- Embedding entire data structures in the schema (use resources for that).
- Schemas that allow ambiguous combinations (e.g., both `userId` and `userEmail` optional with no `oneOf`).

---

## 5. Tool Handlers

```js
async execute(args, { signal, requestId } = {}) {
  // ...
}
```

- Handlers should be `async` by default. Avoid blocking the main thread.
- Validate inputs even if the schema does — the runtime *may* not enforce strict mode.
- Honor the `AbortSignal` from the second argument: pass it to `fetch`, listen for `abort`, and throw `DOMException('Aborted', 'AbortError')` promptly.
- Never trust input — sanitize before injecting into the DOM, URLs, or storage.

```js
async execute({ id }, { signal }) {
  const res = await fetch(`/api/items/${encodeURIComponent(id)}`, { signal });
  if (!res.ok) throw new Error(`Failed (${res.status})`);
  return { content: [{ type: 'text', text: await res.text() }] };
}
```

### Side effects
- Tools that mutate state (POST/PUT/DELETE) should be marked appropriately if the API supports `annotations` (e.g., `{ destructiveHint: true, idempotentHint: false }`). MCP-aligned clients use these for confirmation UX.
- Read-only tools should set `readOnlyHint: true`.

---

## 6. Returning Results

The standard return shape is `{ content: ContentBlock[], isError?: boolean }`:

```js
return {
  content: [
    { type: 'text', text: 'Order #1234 created.' },
  ],
};
```

Content block types you can use natively:
- `{ type: 'text', text: string }` — primary channel.
- `{ type: 'image', data: base64, mimeType: 'image/png' }` — for screenshots, charts.
- `{ type: 'resource', resource: { uri, mimeType, text? | blob? } }` — references a registered resource.
- `{ type: 'audio', data, mimeType }` — for voice tools.

### Conventions
- Return the **smallest useful** payload. The model will quote/summarize it; large blobs cost tokens.
- Prefer structured `text` (JSON or short prose) over images when the agent only needs facts.
- For long results, return a *resource reference* and let the agent request it on demand.
- Set `isError: true` for *recoverable* errors so the model can react; `throw` for truly exceptional failures.

```js
return { content: [{ type: 'text', text: 'Item not found' }], isError: true };
```

---

## 7. Error Handling

- Throw `Error` subclasses with informative messages — the runtime serializes these to the client.
- Surface validation failures as `isError: true` results, not exceptions, when the agent could retry with corrected input.
- Use `AbortError` for cancellations; do not log or report them as failures.
- Never leak stack traces with sensitive info to the model.
- Wrap `fetch` calls and check `response.ok` — `fetch` only rejects on network failure, not HTTP errors.

```js
try {
  const r = await fetch(url, { signal });
  if (!r.ok) {
    return {
      isError: true,
      content: [{ type: 'text', text: `HTTP ${r.status}: ${r.statusText}` }],
    };
  }
} catch (err) {
  if (err.name === 'AbortError') throw err;
  return { isError: true, content: [{ type: 'text', text: 'Network error' }] };
}
```

---

## 8. Resources

Resources expose **data** (not actions) the agent can read.

```js
navigator.modelContext.registerResource({
  uri: 'app://cart/current',
  name: 'Current shopping cart',
  description: 'Live contents of the user\'s cart',
  mimeType: 'application/json',
  async read() {
    return { contents: [{ uri: 'app://cart/current', mimeType: 'application/json', text: JSON.stringify(cart.toJSON()) }] };
  },
});
```

### Conventions
- URIs use a custom scheme (`app://`, `page://`, or your domain). Stable across reads.
- `mimeType` should be accurate — agents use it to decide how to render.
- Resources can be **subscribable**; emit `notifications/resources/updated` (or use the runtime helper) when the underlying data changes. Throttle updates.
- Prefer **resource templates** (URI templates per RFC 6570) for parameterized data: `app://orders/{orderId}`.

---

## 9. Prompts

Prompts are reusable templates the user (or agent) can invoke.

```js
navigator.modelContext.registerPrompt({
  name: 'summarize_page',
  description: 'Summarize the current page in 3 bullet points.',
  arguments: [
    { name: 'tone', description: 'casual | formal', required: false },
  ],
  async get({ tone = 'casual' }) {
    return {
      messages: [
        { role: 'user', content: { type: 'text', text: `Summarize in ${tone} tone:\n\n${document.body.innerText}` } },
      ],
    };
  },
});
```

- Keep prompts small and parameter-driven; don’t hardcode user data.
- Prefer prompts over tools for *templated text generation* with no side effects.

---

## 10. Lifecycle, Cleanup, SPAs

- Register on mount, unregister on unmount. Memory leaks here mean stale tools that throw or operate on detached DOM.
- For frameworks: register inside `useEffect` (React), `onMount` (Svelte/Solid), `mounted` (Vue), and return the disposer.
- On SPA route changes, swap registrations — don’t leave product-detail tools alive on the checkout page.
- Use `AbortController` per page/component to cancel any in-flight tool calls when navigating away.

```js
useEffect(() => {
  const dispose = navigator.modelContext.registerTool({ /* ... */ });
  return () => dispose();
}, [productId]);
```

---

## 11. Permissions & User Consent

- Treat tool execution as a **user-initiated** action wherever it has side effects. The runtime will typically ask for confirmation, but the page should also be defensive.
- Never auto-execute privileged operations (purchases, deletions, sends) without an in-page confirmation step *in addition* to the runtime’s consent UI.
- Surface a clear, in-page indicator when the agent is acting on the user’s behalf (e.g., a banner, an aria-live region announcement).
- Respect `Permissions-Policy` and same-origin restrictions.

---

## 12. Security

- **Origin discipline**: only register tools that operate on data the origin owns. Don’t expose third-party iframes’ DOM through tools you control.
- **Input sanitization**: always escape into the DOM with `textContent`, not `innerHTML`. Use `DOMPurify` or the Trusted Types API when HTML is unavoidable.
- **URL construction**: use `new URL(input, base)` and validate `protocol` against an allowlist (`https:`, `http:`).
- **Avoid prompt injection**: when echoing user/server data into a tool description or prompt template, treat it as untrusted. Never let user-controlled strings define new tools.
- **CSRF**: tool handlers that POST should still respect your CSRF token strategy; the agent does not bypass it.
- **Secrets**: never expose API keys via tool inputs/outputs. The agent log will see them.
- **Rate limit** tool execution at the handler level — a runaway model can call a tool in a tight loop.

---

## 13. Async Patterns

- Always `await` and surface errors. Unhandled rejections silently break tool calls.
- Use `AbortController` and pass `signal` through to `fetch`, `addEventListener`, and any custom async APIs.
- Use `Promise.all` for parallel reads; never serialize independent fetches.
- Use `queueMicrotask` for scheduling DOM-coupled follow-ups; use `requestIdleCallback` for low-priority cleanup.
- Use `AbortSignal.timeout(ms)` for per-call deadlines — supported in all current major browsers.
- Use `AbortSignal.any([a, b])` to combine the runtime signal with your own timeout.

```js
const signal = AbortSignal.any([opts.signal, AbortSignal.timeout(5000)]);
```

---

## 14. Progressive Enhancement & Fallbacks

- The page must work without WebMCP. WebMCP is *additive*.
- Gate registration entirely behind feature detection — no top-level imports that throw.
- For cutting-edge features (subscribable resources, streaming results), check capability flags exposed by the runtime; fall back to one-shot reads.
- Polyfill MCP types via `@modelcontextprotocol/sdk` if you need the type defs in TypeScript.

---

## 15. Testing

- Unit-test handlers in isolation by calling `execute(args)` directly with mocked DOM / fetch.
- Use `MSW` (Mock Service Worker) to mock network calls in tool handlers.
- Mock `navigator.modelContext` in tests:

```js
beforeEach(() => {
  globalThis.navigator.modelContext = {
    registerTool: vi.fn(() => () => {}),
    registerResource: vi.fn(() => () => {}),
  };
});
```

- Validate every tool’s `inputSchema` against `ajv` in a test — schema typos otherwise only surface at runtime.
- Snapshot the registered tool list per route to catch accidental tool leakage between pages.
- Run an end-to-end test where a real (or mocked) MCP client invokes each tool with synthetic inputs.

---

## 16. Performance

- Keep `inputSchema` and `description` payloads small; the entire registry is sent on every model turn.
- Don’t register hundreds of tools — the prompt budget can’t absorb it. Group related actions or use parameters.
- Memoize expensive setup outside the handler:

```js
const indexPromise = buildSearchIndex();
navigator.modelContext.registerTool({
  name: 'search',
  async execute({ q }) {
    const idx = await indexPromise;
    return { content: [{ type: 'text', text: idx.search(q).join('\n') }] };
  },
});
```

- Stream long results when supported; otherwise paginate via tool arguments (`offset`, `limit`).
- Use `structuredClone` (built-in everywhere modern) instead of `JSON.parse(JSON.stringify(...))`.

---

## 17. Accessibility & UX of Agent Actions

- Reflect agent-driven changes via `aria-live="polite"` regions so screen readers announce them.
- Ensure focus management when the agent opens dialogs or navigates — set focus to the new context.
- Don’t hijack focus mid-typing if the user is interacting.
- Honor `prefers-reduced-motion` for any UI feedback the agent triggers.

---

## 18. Code Organization

- One file per tool (or per feature area) — `tools/cart.js`, `tools/search.js`.
- Central `registerAll()` that the app calls once after auth/state is ready.
- Co-locate the schema with the handler; never define them in separate files.
- Type schemas with `as const satisfies JSONSchema` (TypeScript) and derive the handler arg type via a `FromSchema` helper (`json-schema-to-ts` or `zod-to-json-schema`).
- For Zod-first projects: define a `z.object(...)`, derive both the JSON Schema (via `zod-to-json-schema`) and the TS type from it.

```ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const Input = z.object({ id: z.string().uuid() });

navigator.modelContext.registerTool({
  name: 'get_user',
  description: '...',
  inputSchema: zodToJsonSchema(Input),
  async execute(raw) {
    const { id } = Input.parse(raw); // runtime validation
    // ...
  },
});
```

---

## 19. TypeScript Conventions

- Import types from `@modelcontextprotocol/sdk/types.js` when they exist; otherwise declare a minimal `Tool`, `Resource`, `Prompt` interface locally.
- Avoid `any` in handlers; derive arg types from the schema.
- Use `unknown` for the raw input and narrow with the validator (Zod / Ajv).
- Mark side-effect tools with a branded type if your codebase distinguishes read-only vs mutating.

---

## 20. Common JavaScript / Web Platform Defaults Used Inside Tools

These are baseline platform features I would use without comment:

- `fetch` with `AbortSignal` (never `XMLHttpRequest`).
- `URL` and `URLSearchParams` for URL construction.
- `structuredClone` for deep copies.
- `Object.hasOwn(obj, key)` over `hasOwnProperty.call`.
- `Array.prototype.at(-1)` for last element.
- `Array.prototype.flat`, `flatMap`, `findLast`, `findLastIndex`, `group`/`groupBy` (where shipped).
- `Promise.allSettled`, `Promise.any`, `Promise.withResolvers`.
- `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.ListFormat`, `Intl.RelativeTimeFormat` for locale-aware output.
- `crypto.randomUUID()` for IDs (don’t hand-roll).
- `crypto.subtle` for hashing.
- Optional chaining (`?.`), nullish coalescing (`??`), logical assignment (`??=`, `&&=`, `||=`).
- Top-level `await` in modules.
- `import.meta` for module-relative URLs.
- ES modules (`type="module"`) over IIFEs/UMD.
- `const` by default, `let` only when reassigned, never `var`.
- `for...of` over `forEach` when `await` is needed inside the loop.
- `Map`/`Set` over object/array when keys aren’t static strings.
- `WeakRef` / `FinalizationRegistry` only when there’s a clear reason; otherwise let GC do its job.
- `EventTarget` subclasses for custom event emitters (no third-party `EventEmitter`).
- `customElements.define` for any reusable widget; Shadow DOM for style isolation.
- `dialog` element for modals; `popover` attribute for popovers (where shipped).
- `:has()`, `:is()`, `:where()` selectors in CSS-related tool output.
- View Transitions API (`document.startViewTransition`) when navigating in response to a tool call (Chromium-shipped, gracefully degrades).

---

## 21. Clean Code Principles I Apply by Default

- Small functions; one tool = one job. Decompose multi-step workflows into multiple tools the agent can compose.
- Pure functions where possible; isolate side effects in handlers.
- Early returns over nested conditionals.
- Prefer immutability; use spread/`structuredClone` rather than mutating shared state.
- Name things for the *reader*: `productId`, not `pid`; `cancelOrder`, not `co`.
- Avoid magic numbers; lift to named constants at module top.
- No comments restating code; only comments explaining *why*.
- No dead code, no commented-out blocks.
- Fail fast: validate at the boundary, trust internally.
- One source of truth for shared state (a store, not duplicated module-level vars).
- Co-locate tests with code (`tool.ts` / `tool.test.ts`).

---

## 22. Versioning & Compatibility

- Treat tool *names* and *required input fields* as a public API. Removing or renaming is a breaking change.
- Add new optional fields freely; never repurpose an existing field.
- If a tool’s semantics change materially, register a new tool name and deprecate the old one with an updated description (`'(Deprecated: use search_v2)'`).
- Pin `@modelcontextprotocol/sdk` to a known-good version; check the changelog before upgrading.

---

## 23. Observability

- Log tool invocations with `requestId`, name, arg hash (not full args — PII), duration, and outcome.
- Use `performance.mark` / `performance.measure` around handlers for client-side timing.
- Send anonymized metrics (count, p50/p95 duration, error rate) per tool for capacity planning.
- Never log raw arguments containing user content without redaction.

---

## 24. Things Not To Do (Defaults to Avoid)

- Don’t register tools at module top-level outside a feature check — it crashes on unsupported browsers.
- Don’t expose tools that bypass auth or rate limits the rest of the app enforces.
- Don’t use `eval` / `new Function` on tool inputs — ever.
- Don’t make tools that *return* HTML strings; return text or structured data and let the page render.
- Don’t conflate tools and resources: actions are tools, data is resources.
- Don’t build tools that wrap *other* tools (no “meta tools”) — let the agent compose.
- Don’t depend on the agent reading a previous tool’s output verbatim; design each tool’s output to stand alone.
- Don’t mutate `navigator.modelContext` itself or monkey-patch the API surface.

---

This is the baseline I would write to without explicit project guidance. Anything in a project guide that restates these defaults is redundant; anything that *contradicts* them is the value-add the project guide should keep.
