---
description: Use await at the module top level to initialize resources or handle async imports
web-feature-ids:
  - top-level-await
  - modules
  - async-await
---

# Top-Level Await

Reference docs:

- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#top_level_await
- https://v8.dev/features/top-level-await
- https://github.com/tc39/proposal-top-level-await

## Best Practices

Top-Level Await enables modules to act as async initialization primitives. This is powerful but can block module graph execution.

**DO** use Top-Level Await for:

- **Dynamic Imports**: Conditionally importing modules based on runtime environment.
- **Resource Initialization**: awaiting a database connection or WebAssembly compilation before the module exports functionality.
- **Dependency Fallbacks**: Attempting to load a CDN version and falling back to a local version.

```javascript
// dynamic-dependency.js
let dependency;
try {
  dependency = await import("https://example.com/cdn/lib.js");
} catch {
  dependency = await import("./local-lib.js");
}
export { dependency };
```

**DO NOT** abuse it for long-running operations (like large fetches) that aren't critical for initialization, as this pauses the execution of the entire application graph until resolved.

## Baseline Status

Baseline: **Limited Availability**

- **Status**: Limited availability across major browsers.
- **Documentation**: [Web Platform Status](https://webstatus.dev/features/top-level-await)
- **Reason**: While supported in Chrome, Edge, and Firefox since 2021, extensive bugs in Safari's implementation (causing module graph failures) have excluded it from Baseline 2023/2024.
- **Caveats**: Safari 15+ supports it nominally, but complex usage often fails.

## Fallback Strategies

If you need to support environments like IE11 or older Node.js versions:

### IIFE Wrapper (Async Main)

Wrap your async logic in an Immediately Invoked Async Function Expression (IIFE). This is the traditional pattern before TLA.

```javascript
// legacy-init.js
(async () => {
  const response = await fetch("/config.json");
  const config = await response.json();
  console.log("App initialized with:", config);
})();
```

### Transpilers

Tools like **Rollup** and **Webpack 5+** support Top-Level Await out of the box in their output formats (e.g. `es` or `system`). If targeting older environments, you may need a bundler that wraps the module logic for you.

- **Vite**: Supports it natively.
- **Webpack 5**: Needs `experiments.topLevelAwait = true` in older versions (enabled by default in recent ones).

### Module Types

Ensure your script is loaded as a module, or TLA will fail with a syntax error.

```html
<!-- Correct -->
<script type="module" src="app.js"></script>

<!-- Incorrect (Syntax Error) -->
<script src="app.js"></script>
```
