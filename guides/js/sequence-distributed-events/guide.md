---
name: sequence-distributed-events
description: Sort timestamped events collected from servers, databases, or log files and measure the intervals between them.
web-feature-ids:
    - temporal
---


# Sequencing Distributed Events

Tracing dashboards, audit logs, and telemetry viewers often receive events from many services, each stamped by a central source such as a database, message broker, or log pipeline. Those timestamps are frequently recorded with microsecond or nanosecond precision (for example, `2026-04-01T12:00:00.000123456Z`). The legacy `Date` object can only represent milliseconds, so parsing such strings with `new Date()` silently truncates the fractional seconds, causing events that occurred at different times to appear simultaneous and sort in an unstable order.

`Temporal.Instant` represents an exact point on the UTC timeline with nanosecond precision and no attached time zone. That makes it the right type for events that were all measured against the same clock: it preserves the full precision of the recorded timestamp, sorts unambiguously, and yields an exact `Temporal.Duration` between any two events.

## How to Implement

To sequence events that arrive with high-precision timestamps:

1. **Parse the recorded timestamps as `Temporal.Instant`**: Use `Temporal.Instant.from(isoString)` on the timestamp string supplied by the server, database, or log line. Keep the timestamp the source recorded; do not replace it with a timestamp captured in the browser.
2. **Sort events chronologically**: Use `Temporal.Instant.compare(a, b)` as the comparator passed to `Array.prototype.sort()`. It compares the full nanosecond value, so sub-millisecond ordering is preserved.
3. **Calculate intervals**: Use `instant.since(previousInstant)` to get a `Temporal.Duration` between consecutive events. Use `a.equals(b)` to detect events with identical timestamps.
4. **Display intervals with `toLocaleString()`**: Format the `Temporal.Duration` for users with `duration.toLocaleString()`, which uses `Intl.DurationFormat` under the hood. Do not convert to a single `Number` of nanoseconds for display.
5. **Serialize for transmission**: Use `Temporal.Instant.prototype.toString()` to emit a standard ISO 8601 string (always in UTC with a `Z` suffix) when sending events onward.

## Example Code: Sequencing a Server-Side Trace

```javascript
// Events as received from a central source (for example, a tracing backend).
// The timestamps were all recorded against the same clock, so they can be
// ordered and compared with each other exactly.
const rawEvents = [
  { nodeId: 'api-2', eventType: 'db.query', ts: '2026-04-01T12:00:00.000123456Z' },
  { nodeId: 'api-1', eventType: 'request.start', ts: '2026-04-01T12:00:00.000120000Z' },
  { nodeId: 'api-2', eventType: 'request.end', ts: '2026-04-01T12:00:00.000987654Z' },
];

// 1. Parse recorded timestamps as Temporal.Instant (never `new Date(ts)`,
// which drops everything below the millisecond).
const events = rawEvents.map(evt => ({
  ...evt,
  timestamp: Temporal.Instant.from(evt.ts),
}));

// 2. Sort chronologically with the static compare() method
function sequenceEvents(events) {
  // Instant.compare returns -1, 0, or 1, which is exactly what sort() expects.
  return [...events].sort((a, b) => Temporal.Instant.compare(a.timestamp, b.timestamp));
}

// 3. Calculate and display the interval between consecutive events
function analyzeTrace(sortedEvents) {
  for (let i = 1; i < sortedEvents.length; i++) {
    const prev = sortedEvents[i - 1];
    const curr = sortedEvents[i];

    // since() returns a Temporal.Duration that retains nanosecond precision.
    const gap = curr.timestamp.since(prev.timestamp);

    // 4. toLocaleString() formats the duration for people (e.g., "3μs 456ns").
    // Avoid gap.total('nanoseconds'): spans over ~104 days exceed Number.MAX_SAFE_INTEGER.
    // 'en-US' is used here for deterministic output; pass undefined to use the user's locale.
    console.log(`${prev.eventType} → ${curr.eventType}: ${gap.toLocaleString('en-US', { style: 'narrow' })}`);
  }
}

analyzeTrace(sequenceEvents(events));
```

## Strategic Implementation & Best Practices

- **DO** use `Temporal.Instant` for timestamps that were all recorded against one clock (a server, database, or log pipeline) and only need to be ordered or differenced. This is the canonical case for `Instant` rather than `Temporal.PlainDateTime`, which has no offset and therefore cannot be placed unambiguously on the timeline.
- **DO** keep the timestamp recorded by the source. Browsers deliberately coarsen `Temporal.Now.instant()` to mitigate timing attacks and fingerprinting (the spec explicitly permits this), so it does not give sub-millisecond resolution; for local in-page timing use `performance.now()` / `performance.mark()`, and for cross-service ordering use the timestamp recorded by the source.
- **DO** use `Temporal.Instant.compare()` for sorting and `a.equals(b)` for equality checks; do not compare `Instant.compare(a, b) === 0` or compare `toString()` output.
- **DO NOT** parse high-precision timestamp strings with `new Date()` or `Date.parse()` for ordering, because they truncate to milliseconds and produce collisions.
- **DO NOT** collapse an interval to a single number for display. `duration.total('nanoseconds')` returns a `Number`, which exceeds `Number.MAX_SAFE_INTEGER` for spans longer than ~104 days and silently loses precision. Subtracting `epochNanoseconds` (a `BigInt`) is exact but discards unit structure and usually ends up converted to `Number`; keep intervals as `Temporal.Duration` and format them with `toLocaleString()`.
- **DO** convert an `Instant` to `Temporal.ZonedDateTime` with `instant.toZonedDateTimeISO(timeZone)` when you need to show the wall-clock time of an event to a user.
- **DO** verify that the environment supports `Temporal` before using it natively or providing a fallback.

## Fallback strategies

{{ BASELINE_STATUS("temporal") }}

For environments without native support, use a standards-compliant polyfill such as `@js-temporal/polyfill`. Load it conditionally to avoid bloating the payload for modern clients. Note that `@js-temporal/polyfill` does not automatically install a global `Temporal` object, so you must explicitly assign it if you need it globally.

```javascript
(async () => {
  // Check for native support
  if (typeof Temporal === 'undefined') {
    // Dynamically load polyfill using an ESM-compatible CDN
    const module = await import('https://esm.sh/@js-temporal/polyfill');
    // The polyfill does not auto-install globally, so we must assign it
    globalThis.Temporal = module.Temporal;
  }
  
  // Proceed with application logic
})();
```
