---
name: calculate-event-differentials
description: Calculate the duration and time remaining between dates and times.
web-feature-ids:
  - temporal
---

# Calculating Event Differentials with Temporal

Calculating the time elapsed between events (such as trial expirations, subscription durations, or prorated costs) has historically been difficult with the legacy `Date` object due to complexities with time zones, daylight saving time (DST), and inconsistent parsing.

The `Temporal` API provides a modern, robust solution for date and time arithmetic. Specifically, `Temporal.ZonedDateTime` and `Temporal.Duration` enable exact, DST-safe calculations of time differences.

## How to Implement

To calculate differentials between two events:

1.  **Obtain ZonedDateTime objects**: Convert your inputs (dates and times) into `Temporal.ZonedDateTime` objects. This ensures calculations are time-zone aware.
2.  **Calculate active time with `.since()`**: Use `currentZonedDateTime.since(startZonedDateTime)` to find the time elapsed since a start event.
3.  **Calculate remaining time with `.until()`**: Use `currentZonedDateTime.until(endZonedDateTime)` to find the time remaining until a future event.
4.  **Control precision with options**: Use `largestUnit`, `smallestUnit`, and `roundingMode` to control how the resulting duration is balanced and rounded.

### Example: Trial Expiration Calculation

```javascript
// 1. Get current time point in the system time zone
const now = Temporal.Now.zonedDateTimeISO();
const tz = now.timeZoneId;

// 2. Combine separate date and time strings directly.
// Do not build an ISO string with template literals; chain the Temporal methods instead.
const startDateStr = "2025-01-01";
const startTimeStr = "12:00:00";
const endDateStr = "2025-01-31";
const endTimeStr = "12:00:00";

const start = Temporal.PlainDate.from(startDateStr).toPlainDateTime(startTimeStr).toZonedDateTime(tz);
const end = Temporal.PlainDate.from(endDateStr).toPlainDateTime(endTimeStr).toZonedDateTime(tz);

// 3. Calculate difference using .since() and .until()
// ZonedDateTime differences default to largestUnit: 'hour' (days are not a fixed
// length across DST, so Temporal won't balance into days unless asked). Pass
// largestUnit: 'day' or a calendar unit ('week', 'month', 'year') when you want a
// human-scale breakdown instead of e.g. PT1763H. smallestUnit rounds away
// seconds and sub-second noise so the formatted string stays readable.
const timeActive = now.since(start, { largestUnit: 'year', smallestUnit: 'minute' });
const timeRemaining = now.until(end, { largestUnit: 'year', smallestUnit: 'minute' });

// Format durations for display with .toLocaleString() (Intl.DurationFormat)
// instead of manually concatenating unit numbers and suffixes. 'en-US' is used
// here for deterministic output; pass undefined to use the user's locale.
console.log(`Active: ${timeActive.toLocaleString('en-US', { style: 'narrow' })}`);
console.log(`Remaining: ${timeRemaining.toLocaleString('en-US', { style: 'narrow' })}`);

// 4. Check status by leveraging the native .sign property on computed Duration objects
const isExpired = timeRemaining.sign < 0;
if (isExpired) {
  console.log("Subscription is expired.");
}
```

## Strategic Implementation & Best Practices

-   **DO** use `Temporal.ZonedDateTime` for calculations involving real-world events that occur in specific time zones (like subscription renewals or event scheduling).
-   **DO** combine separate date and time strings with Temporal methods, e.g. `Temporal.PlainDate.from(dateStr).toPlainDateTime(timeStr).toZonedDateTime(tz)` or `Temporal.PlainDate.from(dateStr).toZonedDateTime({ timeZone: tz, plainTime: timeStr })`, instead of interpolating an ISO string like `` `${dateStr}T${timeStr}` ``.
-   **DO** pass `largestUnit` (e.g. `'day'`, `'month'`, `'year'`) when you want durations balanced beyond hours; `ZonedDateTime` difference methods default to `'hour'`.
-   **DO** use `.since()` when calculating time elapsed *since* a past event (e.g., `now.since(start)`), and `.until()` for time remaining *until* a future event (e.g., `now.until(end)`).
-   **DO** format durations for display using `.toLocaleString()` (e.g., `duration.toLocaleString(undefined, { style: 'narrow' })` or `{ style: 'digital' }`), which uses `Intl.DurationFormat` under the hood, instead of manually concatenating unit numbers and suffixes.
-   **DO** render a `PlainTime` as `HH:MM` (e.g., for `<input type="time">`) using `.toPlainTime().toString({ smallestUnit: 'minute' })` rather than string `.slice(0, 5)`.
-   **DO NOT** modify instances directly; `Temporal` objects are **immutable**. Operations like `add()`, `subtract()`, or `with()` return a *new* instance.
-   **DO NOT** fall back to `Date`/`getTime()` arithmetic for the differential itself; `Date` has no time-zone-aware calendar math and only millisecond precision.
-   **DO** use the native `.sign` property of the computed `Temporal.Duration` (or use `Temporal.ZonedDateTime.compare`) to check if a duration represents a past/expired time point (negative sign) or future pending start.

## Fallback Strategy

{{ FEATURE_FALLBACKS("temporal") }}