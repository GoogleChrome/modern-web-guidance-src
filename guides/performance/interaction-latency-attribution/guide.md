---
name: interaction-latency-attribution
description: Identify slow user interactions, and attribute them for diagnostic purposes (e.g. determining the target element of an interaction or decomposing its phases into input delay, processing duration, and presentation delay).
web-feature-ids:
  - event-timing
sources:
  - https://web.dev/articles/optimize-inp
  - https://web.dev/articles/find-slow-interactions-in-the-field
  - https://developer.chrome.com/docs/performance/insights/inp-breakdown
  - https://web.dev/blog/better-responsiveness-metric#capture_the_full_event_duration
---

### Overview

Interaction to Next Paint (INP) measures the time from a user interaction until the browser presents the next frame. To effectively debug slow interactions, it is crucial to decompose the total latency into three distinct phases:

1. **Input Delay:** The wait time from the user's action to when the event handler begins executing. Because this is caused by other tasks blocking the main thread, input delay is largely outside the control of the interaction handler itself.
2. **Processing Duration:** The time spent executing the event handlers, including any associated microtasks and promises.
3. **Presentation Delay:** The time the browser takes to recalculate style, perform layout, and paint the frame after the event handlers complete. A high presentation delay often points to large, complex layouts, layout thrashing, or computationally expensive DOM updates.

The Event Timing API (`PerformanceEventTiming`) provides these metrics automatically. Note that all timestamps and durations are rounded to the nearest 8ms (for security).

### Capturing Interaction Latency

Use a `PerformanceObserver` to capture interactions.

```javascript
// MANDATORY: Always use 'event' as the type to capture discrete user interactions.
const observer = new PerformanceObserver((list) => {
  // list.getEntries() returns PerformanceEventTiming objects
  for (const entry of list.getEntries()) {
    // MANDATORY: Calculate the three phases using the event timing timestamps.
    // Use Math.max(0, ...) to avoid negative values due to timing imprecision or rounding.
    const inputDelay = Math.max(0, entry.processingStart - entry.startTime);
    const processingDuration = Math.max(0, entry.processingEnd - entry.processingStart);
    const presentationDelay = Math.max(0, entry.duration - (entry.processingEnd - entry.startTime));

    // MANDATORY: Attribute the interaction using interactionId and target.
    // The primary reason to use the raw Event Timing API over a library (like web-vitals) is to capture custom, application-specific context.
    // Go beyond basic DOM nodes by extracting dataset attributes (e.g., data-component, data-action).
    let componentName = 'unknown-component';
    if (entry.target && entry.target.closest) {
      const componentEl = entry.target.closest('[data-component]');
      componentName = componentEl ? componentEl.dataset.component : entry.target.tagName.toLowerCase();
    }
    const targetInfo = entry.target ? `${componentName} (${entry.target.id ? '#' + entry.target.id : 'no-id'})` : 'detached-element';

    // In SPAs, the URL may have changed by the time the observer callback runs. 
    // Use `entry.processingStart` to map the interaction back to the correct route/state.
    
    console.group(`Interaction Attribution: ${entry.name} (${entry.interactionId})`);
    console.log(`Target: ${targetInfo}`);
    console.log(`Total duration: ${entry.duration}ms`);
    
    // Log the decomposed phases to identify the specific bottleneck.
    console.log(`Input delay: ${inputDelay}ms`);
    console.log(`Processing duration: ${processingDuration}ms`);
    console.log(`Presentation delay: ${presentationDelay}ms`);
    console.groupEnd();
  }
});

// MANDATORY: buffered: true ensures you get events that happened before the observer started.
// durationThreshold filters out fast events. The default is 104ms, but 16ms is recommended for development to observe a wider range of interactions.
observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
```

### Mitigating Phase Bottlenecks

Once you have attributed the latency to a specific phase, use the following strategies to optimize it:

*   **High Input Delay:** This occurs when the main thread is busy with other work (like long tasks) when the user interacts. 
    *   Ensure that background tasks or large data processing loops frequently yield to the main thread using `scheduler.yield()` or a `setTimeout` polyfill so the browser can respond to inputs.
    *   **Mobile Tap Delay:** If the delay is exactly ~300ms on mobile devices, the browser may be waiting to see if the user is double-tapping. Eliminate this by applying `touch-action: manipulation` in CSS to interactive elements.
*   **High Processing Duration:** The event handler itself is doing too much work. 
    *   Defer secondary, non-critical work (like analytics tracking) to a separate task. To guarantee the browser paints *before* the deferred work begins, use a "double-yield" pattern: wrap your `setTimeout(..., 0)` inside a `requestAnimationFrame()`.
    *   If a user triggers a new interaction while the previous one is still processing (e.g., rapid typing in an autocomplete field), use an `AbortController` to cancel the stale work eagerly rather than relying solely on debouncing.
*   **High Presentation Delay:** The browser is taking too long to render the frame after your code finishes.
    *   **Avoid layout thrashing (forced synchronous layout):** Never read layout properties (like `offsetHeight` or `getComputedStyle`) immediately after modifying DOM styles. Always batch your DOM reads first, and then perform your DOM writes.
    *   **Reduce DOM Size Impact:** For pages with large DOMs, apply `content-visibility: auto` to large, off-screen components. This allows the browser to skip styling and layout work for those elements, dramatically reducing presentation delay.

### Fallback strategies

{{ BASELINE_STATUS("event-timing") }}

This feature should be implemented as a progressive enhancement. If the Event Timing API is not supported, diagnostic performance data will simply not be collected, but the core application functionality will remain completely unaffected.

**MANDATORY**: Use feature detection before attempting to initialize the `PerformanceObserver` for events.

```javascript
// Detect support for PerformanceObserver and the 'event' entry type
if (
  typeof PerformanceObserver !== 'undefined' && 
  PerformanceObserver.supportedEntryTypes && 
  PerformanceObserver.supportedEntryTypes.includes('event')
) {
  // Initialize the observer
} else {
  // Graceful degradation: no-op, as this is purely for diagnostics
}
```