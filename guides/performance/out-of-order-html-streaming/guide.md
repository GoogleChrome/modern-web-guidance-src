---
name: out-of-order-html-streaming
description: Declaratively update a page with content streamed later into the same HTML document or via imperative JavaScript APIs.
web-feature-ids:
  - template-for
  - html-setters
  - html-streaming-setters
  
---

# Out-of-Order (OOO) HTML Streaming

Out-of-Order (OOO) HTML Streaming (also known as Declarative Partial Updates) is an alternative to the traditional "top-to-bottom" linear processing of HTML. It allows developers to define placeholders earlier in a document and "patch" them with content that arrives later in the same network stream, or via new imperative JavaScript streaming APIs.

## Quick Overview

The feature consists of two primary mechanisms:

1.  **Declarative Patching (HTML-based)**: Uses new processing instructions (`<?marker>`, `<?start>`, `<?end>`) and `<template for>` to swap content in the DOM as it streams in from the server.
2.  **Imperative setting and streaming (JS-based)**: A suite of new methods (e.g., `streamHTML()`, `setHTMLUnsafe()`) that allow setting of HTML or piping readable streams directly into DOM elements with native performance and optional script execution.

## Best Practices

*   **Prioritize Above-the-Fold Content**: Stream critical UI (header, hero, primary navigation, primary content) first. Use placeholders for "expensive" or lower priority components like comments, ads, or related content.
*   **Implement Native Loading States**: Use the `<?start>` and `<?end>` markers to wrap fallback content. The browser automatically replaces everything between these markers when the corresponding `<template for>` arrives.
*   **Minimize Cumulative Layout Shift (CLS)**: Always provide stable dimensions for placeholders. If the final content size is unknown, use skeleton screens or CSS `aspect-ratio` to reserve space and prevent jarring shifts.
*   **Accessibility & Focus Management**: Be mindful that out-of-order updates can confuse screen reader users. Use `aria-live` regions for critical updates and ensure that focus isn't lost if a placeholder containing the active element is replaced.


## Implementation Details

### 1. Declarative HTML Markers
The browser looks for specific processing instructions to identify where content should be patched.

```html
<!-- A simple insertion point -->
<div id="sidebar">
  <?marker name="dynamic-comments">
</div>

<!-- A replacement range with loading state -->
<main>
  <?start name="main-content">
    <div class="skeleton">Loading content...</div>
  <?end>
</main>

... (other content) ...

<!-- Later in the same stream, provide the content -->
<template for="dynamic-comments">
  <div class="comments">...</div>
</template>

<template for="main-content">
  <article>
    <h1>The Real Content</h1>
    <p>This replaces the skeleton div automatically.</p>
  </article>
</template>
```

Once a `<template>` replaces an insertion point, that insertion point no longer exists, and can not be reused. However, a `<template>` may contain insertion points that can be used later in the stream.

```html
 <?start name="replaced-content">
  <div class="skeleton">
<?end>
<!-- Later in the same stream, provide initial content -->
<template for="replaced-content">
  <?start name="replaced-content">
    <div>Quickly computed result</div>
  <?end>
</template>
<!-- Later in the same stream, provide full content -->
<template for="replaced-content">
  <?start name="replaced-content">
    <div>Full result</div>
  <?end>
</template>
```

### 2. Imperative JS Streaming
You can now pipe fetch responses directly into the DOM without manual chunk handling.

```javascript
const main = document.querySelector('main');
const response = await fetch('/api/partial-update');

// Pipe the stream directly into the element
await response.body
  .pipeThrough(new TextDecoderStream())
  .pipeTo(main.streamHTMLUnsafe({ runScripts: true }));
```

## Use Case Reference Matrix

*   **Island Architecture**: Hydrate independent interactive components on top of static HTML without a full framework runtime.
*   **Deferred "Expensive" Blocks**: Deliver the shell of a page immediately and stream database-heavy components as they become available.
*   **Single Page Application (SPA) Updates**: Stream large UI transitions in SPAs using `streamHTML()` instead of waiting for a full JSON payload and manual DOM construction.

## Anti-Patterns & Warnings (DO NOT DO THIS)

*   **Do not use OOO streaming for everything.** Over-fragmenting a page can increase the complexity of the stream and potentially delay content if the browser spends too much time patching small nodes.
*   **Do not ignore Trusted Types.** When using `*Unsafe` methods in environments with Trusted Types enforced, ensure you are passing a sanitized policy object if required.
*   **Do not assume script execution order.** Scripts inside a `<template for>` will execute as soon as they are patched into the document. Do not rely on them executing in a specific sequence relative to other deferred templates.
*   **Do not use without a polyfill strategy.** Ensure you have a fallback or use polyfills (`html-setters-polyfill` and `template-for-polyfill`) to support your required browsers until this feature becomes Baseline.

## Fallback strategies

{{ BASELINE_STATUS("template-for") }}
{{ BASELINE_STATUS("html-setters") }}
{{ BASELINE_STATUS("html-streaming-setters") }}

You can use polyfills like `template-for-polyfill` and `html-setters-polyfill` to emulate the API surface for non-supporting browsers
