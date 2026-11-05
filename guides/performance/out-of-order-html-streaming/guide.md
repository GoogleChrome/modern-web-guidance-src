---
name: out-of-order-html-streaming
description: Declaratively update a page with content streamed later into the same HTML document or via imperative JavaScript APIs.
web-feature-ids:
  - template-for
  - html-setters
  - html-streaming-setters
  - html-processing-instructions
  
---

# Out-of-Order (OOO) HTML Streaming

Out-of-Order (OOO) HTML Streaming (also known as Declarative Partial Updates) is an alternative to the traditional "top-to-bottom" linear processing of HTML. It allows developers to define placeholders earlier in a document and "patch" them with content that arrives later in the same network stream, or via new imperative JavaScript streaming APIs.

## Quick Overview

The feature consists of two primary mechanisms:

1. **Declarative Patching (HTML-based)**: Uses new processing instructions (`<?marker>`, `<?start>`, `<?end>`) and `<template for>` to swap content in the DOM as it streams in from the server.
2. **Imperative setting and streaming (JS-based)**: A suite of new methods (e.g., `streamHTML()`, `setHTMLUnsafe()`) that allow setting of HTML or piping readable streams directly into DOM elements with native performance and optional script execution.

## Best Practices

* **Prioritize Above-the-Fold Content**: Stream critical UI (header, hero, primary navigation, primary content) first. Use placeholders for "expensive" or lower priority components like comments, ads, or related content.
* **Implement Native Loading States**: Use the `<?start>` and `<?end>` markers to wrap fallback content. The browser automatically replaces everything between these markers when the corresponding `<template for>` arrives.
* **Minimize Cumulative Layout Shift (CLS)**: Always provide stable dimensions for placeholders. If the final content size is unknown, use skeleton screens or CSS `aspect-ratio` to reserve space and prevent jarring shifts.

## Accessibility Considerations

* **Indicate progress information in text**: Always provide visible text updates, such as "Loading..." or "Processing...", to notify users when content is being streamed. Do not rely on non-text visual effects alone, such as animations or faded backgrounds, as they won't be conveyed by screen readers without an equivalent text description, while people with cognitive impairments may not understand their purpose and may think the content is "broken".
* **Distinguish between content in text**: If multiple areas of content on the page are being streamed at any one time, indicate the name of each area in text so that it can more easily be identified by screen reader users. For example, "Loading comments...", "Loading latest updates...".
* **Use live regions for text updates**: Always apply `role="status"` or `aria-live="polite"` to the container element for text updates so that the text is conveyed by screen readers when it appears on the page. Make sure to "prime" the live region by including the empty container element with the live region markup on page load, and then populating it with the text update.
* **Use the `aria-busy` attribute**: Always apply the `aria-busy` attribute to the container element for the affected content. Set the value of the attribute to `true` when the content is being streamed, and change the value to `false` when streaming is complete.
* **Communicate when streaming is complete**: Populate the same live region that you used for conveying progress information with an appropriate confirmation message, such as "Loading complete". De-populate the live region once the content is replaced.
* **Use streaming sparingly**: Minimize the number of page sections that are subject to streaming, as too many notifications can confuse and overwhelm screen reader users. Be mindful that screen readers can struggle to deal with multiple live regions on a single page, so they may not announce progress information in a timely or consistent manner.
* **Manage focus correctly**: Make sure that focus isn't lost when a placeholder containing the active content is replaced. Additionally, do not automatically move focus to another part of the page when the related content is updated, as this change of context is disorienting.
* **Do not use `role="alert"` for text updates**: Some screen readers such as NVDA will announce the term "Alert" before announcing the live region text, which can be irritating for screen reader users when the related content doesn't represent an alert.
* **Do not wrap the entire content in a live region**: Doing so will cause screen readers to announce the full "patched" content when streaming is complete, which can overwhelm screen reader users.

## Implementation Details

### 1. Declarative HTML Markers

The browser looks for specific processing instructions to identify where content should be patched.

```html
<!-- A simple insertion point -->
<div id="sidebar" aria-busy="true">
  <?marker name="dynamic-comments">
</div>

<!-- A replacement range with loading state -->
<main aria-busy="true">
  <?start name="main-content">
    <div class="skeleton" role="status">Loading main content...</div>
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

The browser provides a suite of 24 methods (6 actions, each with 4 variations) to update the DOM either statically (from a string) or via a stream.

#### API Reference Matrix

| Action | Static (Safe) | Streaming (Safe) | Static (Unsafe) | Streaming (Unsafe) |
| :--- | :--- | :--- | :--- | :--- |
| **Set** | `setHTML()` | `streamHTML()` | `setHTMLUnsafe()` | `streamHTMLUnsafe()` |
| **Replace** | `replaceWithHTML()` | `streamReplaceWithHTML()` | `replaceWithHTMLUnsafe()` | `streamReplaceWithHTMLUnsafe()` |
| **Before** | `beforeHTML()` | `streamBeforeHTML()` | `beforeHTMLUnsafe()` | `streamBeforeHTMLUnsafe()` |
| **Prepend** | `prependHTML()` | `streamPrependHTML()` | `prependHTMLUnsafe()` | `streamPrependHTMLUnsafe()` |
| **Append** | `appendHTML()` | `streamAppendHTML()` | `appendHTMLUnsafe()` | `streamAppendHTMLUnsafe()` |
| **After** | `afterHTML()` | `streamAfterHTML()` | `afterHTMLUnsafe()` | `streamAfterHTMLUnsafe()` |

#### Key Concepts

* **Safe vs. Unsafe**: 
  * **Safe** methods (e.g., `setHTML()`) use a built-in sanitizer by default to strip potentially dangerous content like `<script>` tags. You can pass a custom `Sanitizer` object in the options to apply in addition to the default sanitizer.
  * **Unsafe** methods (e.g., `setHTMLUnsafe()`) do not sanitize by default, but you can still pass a custom `Sanitizer`. To allow scripts to execute in the new content, you must explicitly pass `{ runScripts: true }` in the options. **IMPORTANT**: Only use unsafe methods with trusted content where safe methods would not work.
  * **Static vs. Streaming**:
  * **Static** methods take a string (or `TrustedHTML`) and apply it immediately.
  * **Streaming** methods return a `WritableStream`. This allows you to pipe content (e.g., from a `fetch` response) directly into the DOM, and the browser will render it incrementally as chunks arrive.

#### Example: Streaming a Fetch Response

You can pipe fetch responses directly into the DOM without manual chunk handling.

```javascript
const main = document.querySelector('main');
const response = await fetch('/api/partial-update');

// Pipe the stream directly into the element
await response.body
  .pipeThrough(new TextDecoderStream())
  .pipeTo(main.streamHTMLUnsafe({ runScripts: true }));

// Or use the `textStream()` convenience method which streams directly without needing the intermediate `TextDecoderStream()` step
await response
  .textStream()
  .pipeTo(main.streamHTMLUnsafe({ runScripts: true }))
```

## Use Case Reference Matrix

* **Island Architecture**: Hydrate independent interactive components on top of static HTML without a full framework runtime.
* **Deferred "Expensive" Blocks**: Deliver the shell of a page immediately and stream database-heavy components as they become available.
* **Single Page Application (SPA) Updates**: Stream large UI transitions in SPAs using `streamHTML()` instead of waiting for a full JSON payload and manual DOM construction.

## Anti-Patterns & Warnings (DO NOT DO THIS)

* **Do not use OOO streaming for everything.** Over-fragmenting a page can increase the complexity of the stream and potentially delay content if the browser spends too much time patching small nodes.
* **Do not ignore Trusted Types.** When using `*Unsafe` methods in environments with Trusted Types enforced, ensure you are passing a sanitized policy object if required.
* **Do not assume script execution order.** Scripts inside a `<template for>` will execute as soon as they are patched into the document. Do not rely on them executing in a specific sequence relative to other deferred templates.
* **Do not use without a polyfill strategy.** Ensure you have a fallback or use polyfills (`html-setters-polyfill` and `template-for-polyfill`) to support your required browsers until this feature becomes Baseline.

## Fallback strategies

{{ BASELINE_STATUS("template-for") }}
{{ BASELINE_STATUS("html-setters") }}
{{ BASELINE_STATUS("html-streaming-setters") }}
{{ BASELINE_STATUS("html-processing-instructions") }}

You can use polyfills like `template-for-polyfill` and `html-setters-polyfill` to emulate the API surface for non-supporting browsers.

Browsers without `html-processing-instructions` support parse `<?marker>`, `<?start>`, and `<?end>` as comments. `template-for-polyfill` still recognizes these comments as markers, so keep the same processing instruction syntax for all browsers. Do not rewrite the markers as HTML comments or elements for non-supporting browsers.
