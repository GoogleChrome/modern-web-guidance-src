---
name: conditional-async-dependencies
description: Conditionally load or initialize async dependencies (such as importing polyfills for missing web features) without requiring complex orchestration across all of a page's script dependencies.
web-feature-ids:
    - top-level-await
---

# Conditionally load or initialize async dependencies

Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.

## How to implement

1. Verify that your module is being parsed as an ECMAScript module.
2. Programmatically detect the absence of the required API or feature in the current runtime environment.
3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
6. Export the module's public API only after the environment has been successfully patched and verified.

## Example code

```html
<!-- 1. Ensure the execution environment allows ESM. -->
<script type="module">
  // 2. Check for browser capabilities to avoid running code
  //    in contexts where a feature doesn't require a polyfill
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    try {
      // 3 & 4: Dynamically await the polyfill import
      await import('path/to/polyfill.js');
    } catch (error) {
      // 5: Handle network or loading failures gracefully
      console.error('Failed to load IntersectionObserver polyfill:', error);
    }
  }

  // 6: Export bindings synchronously; downstream consumers are guaranteed the polyfill is evaluated (or handled)
  export const createObserver = (element, callback) => {
    if (!globalThis.IntersectionObserver) return null;
    const observer = new IntersectionObserver(callback);
    observer.observe(element);
    return observer;
  };
</script>
```

## Best practices

* **DO** ensure an ESM execution context. In the browser, top-level await is syntactically invalid in `<script>` blocks that don't use the `type="module"` attribute.
* **DO** implement strict error boundaries. Unhandled Promise rejections using top-level await will abort module evaluation, resulting in missing dependencies or non-execution of application logic.
* **DO NOT** use in shared libraries. Avoid top-level await calls involving network I/O in ubiquitous utility libraries, as the resulting pause will forcefully block execution for every downstream consumer that imports the library.
* **DO** audit for circular dependencies: Carefully manage module imports to avoid cyclical graphs. Two interdependent modules utilizing top-level await will trigger an unrecoverable execution deadlock.
* **DO NOT** excessively delay page initialization. Be aware that a suspended module delays the `DOMContentLoaded` browser event until the Promise fully settles, which can negatively inflate application load performance metrics.[2]
