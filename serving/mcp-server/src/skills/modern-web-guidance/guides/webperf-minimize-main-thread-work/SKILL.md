---
description: Optimize web pages by minimizing the main thread's workload to improve responsiveness and user experience.
filename: minimize-main-thread-work
category: webperf
---

# Minimize Main Thread Work

The browser's main thread is responsible for executing JavaScript, rendering HTML, and handling user interactions. When this thread is overloaded, your web page can become unresponsive, leading to a poor user experience. This guide outlines strategies to reduce the load on the main thread.

## Best Practices

The sections below are organized based on the categories that Lighthouse reports for main thread work.

### Script Evaluation

*   **Optimize third-party JavaScript:** Evaluate and defer or remove third-party scripts that are not essential for your page's core functionality.
*   **Debounce your input handlers:** Limit the rate at which functions are called in response to events like scrolling or resizing.
*   **Use web workers:** Offload computationally intensive JavaScript tasks to background threads so they don't block the main thread.

### Style and Layout

*   **Reduce the scope and complexity of style calculations:** Avoid overly complex CSS selectors and limit the number of elements affected by style changes.
*   **Avoid large, complex layouts and layout thrashing:** Minimize DOM manipulations that cause browsers to recalculate layout, especially in loops.

### Rendering

*   **Stick to compositor-only properties and manage layer count:** Utilize CSS properties that can be handled by the compositor thread, and avoid excessive DOM element layering.
*   **Simplify paint complexity and reduce paint areas:** Optimize how elements are painted to reduce the amount of work the browser needs to do.

### Parsing HTML and CSS

*   **Extract critical CSS:** Inline the CSS necessary for above-the-fold content to render quickly.
*   **Minify CSS:** Remove unnecessary characters from CSS files to reduce their size.
*   **Defer non-critical CSS:** Load CSS that is not immediately needed asynchronously.

### Script Parsing and Compilation

*   **Reduce JavaScript payloads with code splitting:** Break down large JavaScript bundles into smaller chunks that can be loaded on demand.
*   **Remove unused code:** Analyze and eliminate JavaScript code that is never executed.

### Garbage Collection

*   **Monitor your web page's total memory usage with `measureMemory()`:** Track memory allocation and deallocation to identify potential memory leaks.

## Resources

*   [Source code for **Minimize main thread work** audit](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/mainthread-work-breakdown.js)
*   [Main thread (MDN)](https://developer.mozilla.org/docs/Glossary/Main_thread)
*   [Inside look at modern web browser (part 3)](/blog/inside-browser-part3)