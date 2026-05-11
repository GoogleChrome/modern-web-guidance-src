1. `LanguageModel.create()` should be called using the `window.LanguageModel` API.
1. The deprecated `window.ai.languageModel` API must not be used.
1. `LanguageModel.availability()` should be called before attempting to create a session. It returns one of `"available"`, `"downloadable"`, `"downloading"`, or `"unavailable"`.
1. The deprecated `capabilities()` method must not be used.
1. If `LanguageModel.availability()` returns `"unavailable"`, the code must not attempt to call `LanguageModel.create()`.
1. `LanguageModel.create()` should register a `downloadprogress` listener via the `monitor` option to handle the case where the model needs to be downloaded.
1. `session.promptStreaming()` should be used when a streaming, incremental response is needed.
1. `session.prompt()` should be used for one-shot responses.
1. Output from `session.prompt()` or `session.promptStreaming()` must never be set via `innerHTML`. Instead, use an HTML sanitizer like the native Sanitizer API or the DOMPurify library, or `textContent` or equivalent safe DOM APIs to prevent XSS from untrusted model output.
1. For structured output, the `responseConstraint` option should be passed a JSON Schema object to `session.prompt()`.
1. The result of `session.prompt()` with `responseConstraint` should be parsed with `JSON.parse()`.
1. A separate `JSON.stringify()` call to convert the schema to a string is not needed — the schema is passed as a plain object.
1. `session.destroy()` should be called when a session is no longer needed, to free device memory.
1. When using `AbortController` to cancel a prompt, the same signal should be passed to the `prompt()` or `promptStreaming()` call, not to `LanguageModel.create()`.
1. Session clones created with `session.clone()` share the base session's initial context but accumulate their own separate conversation history afterwards. The base session should be destroyed after cloning if it will not be used further.
1. `session.contextUsage` and `session.contextWindow` reflect the current token count and maximum respectively. Code should not assume a fixed token limit.
