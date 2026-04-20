# Best Practices

* **Naming and Semantics**: Use specific verbs describing exact behavior (e.g. `create-event` vs `start-event-creation-process`). Favor positive descriptions over listing limitations.
* **Schema Design**: Accept raw user input (avoid agent math/calculation). Ensure all parameters have specific types and explain the purpose of options.
* **Reliability**: Validate constraints in code and return descriptive errors for retries. Handle rate limiting gracefully. Ensure the function returns *after* UI state updates for consistency.
* **Tool Strategy**: Tools should be atomic, composable, and distinct. Do not force flow control instructions ("Don't call B after A") — let the agent decide. Register/unregister tools dynamically depending on the current page context.
* **Clean Up**: Always use `AbortSignal` to unregister tools when pages transition or resources are released to avoid leaks and collisions. Do not use `unregisterTool`.

## Anti-Patterns & Warnings (DO NOT DO THIS)

* **Do not use backend transports.** WebMCP is for browser tabs, not Node.js background processes.
* **Do not include Resources or Prompts.** These are not supported in the current WebMCP spec.
* **Do not ignore `inputSchema` structure.** Always provide clear descriptions for every parameter to minimize agent hallucinations.
* **Do not use outside of a Secure Context (HTTPS).**