# Best Practices

* **Naming and Semantics**: Use specific verbs describing exact behavior (e.g. `create-event` vs `start-event-creation-process`). Favor positive descriptions over listing limitations.
* **Schema Design**: Accept raw user input (avoid agent math/calculation). Ensure all parameters have specific types and explain the purpose of options.
* **Reliability**: Validate constraints in code and return descriptive errors for retries. Handle rate limiting gracefully. Ensure the function returns *after* UI state updates for consistency.
* **Tool Strategy**: Tools should be atomic, composable, and distinct. Do not force flow control instructions ("Don't call B after A") — let the agent decide. Register/unregister tools dynamically depending on the current page context. Use `annotations: { readOnlyHint: true }` (placed after `execute`) for tools that do not modify state to inform the agent of safe execution.
* **Clean Up**: Always use `AbortSignal` to unregister tools when pages transition or resources are released to avoid leaks and collisions. Do not use `unregisterTool`.

## When to Discourage WebMCP

* **Backend Operations**: If the operation requires intensive compute, access to secure databases, or requires API keys that shouldn't be exposed to the client, use a standard backend MCP server instead of WebMCP.
* **High-Risk Actions without Guardrails**: Avoid auto-submitting tools for destructive or irreversible actions (e.g., deleting data) unless the UI requires manual user confirmation outside the agent's control.
* **Hyper-Dynamic State**: If data changes faster than the agent can react, it may work with stale context.

## Anti-Patterns & Warnings (DO NOT DO THIS)

* **Do not use backend transports.** WebMCP is for browser tabs, not Node.js background processes.
* **Do not include Resources or Prompts.** These are not supported in the current WebMCP spec.
* **Do not ignore `inputSchema` structure.** Always provide clear descriptions for every parameter to minimize agent hallucinations.
* **Do not use outside of a Secure Context (HTTPS).**