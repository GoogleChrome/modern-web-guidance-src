---
name: sequence-distributed-events
description: Log and sequence operations in distributed microservices or high-throughput tracing environments by recording timestamps with nanosecond resolution.
web-feature-ids:
    - temporal
sources:
  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
---

# Sequence Distributed Events

In high-frequency distributed tracing environments, millisecond-precision timestamps (e.g., `Date.now()`) can lead to sorting collisions when multiple events are emitted back-to-back. The `Temporal` API, specifically `Temporal.Instant`, provides nanosecond-precision timestamps that can prevent these collisions and ensure absolute chronological ordering.

## How to Implement

To implement accurate distributed event sequencing:

1. **Check for native support:** Verify if `Temporal` is available in the environment (`typeof Temporal !== 'undefined'`).
2. **Capture timestamps:** Use `Temporal.Now.instant()` to capture the current time with nanosecond precision.
3. **Compare timestamps:** Use `Temporal.Instant.compare(a, b)` to sort events.
4. **Calculate precision differences:** Use `since` to find the duration between two instants, and `total({ unit: 'nanoseconds' })` to display the difference in nanoseconds.

## Example Code: High-Frequency Tracing

```javascript
/**
 * Capture High-Frequency Events
 * Uses Temporal.Instant for nanosecond precision to avoid collisions.
 */
function captureEvent(eventType, nodeId) {
  // Capture timestamp with nanosecond resolution
  const temporalInstant = Temporal.Now.instant();
  
  return {
    nodeId,
    eventType,
    timestamp: temporalInstant
  };
}

/**
 * Sort Events Accurately
 * Uses Temporal.Instant.compare to ensure chronological order.
 */
function sortEvents(events) {
  return [...events].sort((a, b) => 
    Temporal.Instant.compare(a.timestamp, b.timestamp)
  );
}

/**
 * Calculate Precision Difference
 * Finds the exact nanoseconds difference between two events.
 */
function getEventDiff(currentEvt, prevEvt) {
  const duration = currentEvt.timestamp.since(prevEvt.timestamp);
  // Returns total nanoseconds difference
  return duration.total({ unit: 'nanoseconds' }); 
}
```

## Strategic Implementation & Best Practices

- **DO** use `Temporal.Now.instant()` when resolution higher than 1ms is required for tracing or logging.
- **DO NOT** use `Date.now()` for ordering high-frequency events if collisions are occurring or likely to occur in telemetry.
- **DO** use standard `Temporal` comparisons (`Temporal.Instant.compare`) instead of manual subtraction to avoid overflow or precision loss if applicable.
- **DO NOT** use `Temporal` without checking support if older browser environments are expected.

## Fallback Strategy

{{ BASELINE_STATUS("temporal") }}

For browsers that do not yet support the API, use a fallback that uses `Date.now()` or informative messages. Note that for high-frequency events, you may need a server-side or more precise mechanism if client-side millisecond resolution is insufficient.

```javascript
/**
 * Progressive Enhancement Fallback for Calculating Difference
 */
function getEventDiffFallback(currentEvt, prevEvt) {
  if (typeof Temporal !== 'undefined') {
    const duration = currentEvt.timestamp.since(prevEvt.timestamp);
    return duration.total({ unit: 'nanoseconds' }); 
  } else {
    // Falls back to Date milliseconds converted to nanoseconds
    const msDiff = currentEvt.dateMs - prevEvt.dateMs;
    return msDiff * 1000000; 
  }
}
```