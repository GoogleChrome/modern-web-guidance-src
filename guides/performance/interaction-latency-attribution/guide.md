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

1.  **Input Delay:** The time from the user's action to when the event handler begins executing. High input delay usually means the main thread was blocked by other tasks.
2.  **Processing Time:** The time spent executing the event handlers.
3.  **Presentation Delay:** The time the browser takes to recalculate layout, paint, and composite the frame after the event handlers complete.

The Event Timing API (`PerformanceEventTiming`) provides these metrics automatically.

### Capturing Interaction Latency

Use a `PerformanceObserver` to capture interactions.

```javascript
// MANDATORY: Always use 'event' as the type to capture discrete user interactions.
const observer = new PerformanceObserver((list) => {
  // list.getEntries() returns PerformanceEventTiming objects
  for (const entry of list.getEntries()) {
    // Only capture events with a target element (ignores some synthetic events)
    if (!entry.target) continue;

    // MANDATORY: Calculate the three phases using the event timing timestamps.
    const inputDelay = entry.processingStart - entry.startTime;
    const processingTime = entry.processingEnd - entry.processingStart;
    const presentationDelay = entry.duration - (entry.processingEnd - entry.startTime);

    // Provide the target element to understand which component caused the interaction
    const elementTag = entry.target.tagName.toLowerCase();
    const elementId = entry.target.id ? `#${entry.target.id}` : '';

    console.log(`Slow interaction on ${elementTag}${elementId}`);
    console.log(`Total duration: ${entry.duration}ms`);
    console.log(`Input delay: ${inputDelay}ms`);
    console.log(`Processing time: ${processingTime}ms`);
    console.log(`Presentation delay: ${presentationDelay}ms`);
  }
});

// MANDATORY: buffered: true ensures you get events that happened before the observer started.
// durationThreshold filters out fast events. The default is 104ms, but lower values like 16ms are useful for detailed debugging.
observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
```

### Fallback strategies

{{ BASELINE_STATUS("event-timing") }}

This feature should be implemented as a progressive enhancement. If the Event Timing API is not supported, diagnostic performance data simply won't be collected, but the core application functionality will remain unaffected.

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
  // Graceful degradation: no-op
}
```
