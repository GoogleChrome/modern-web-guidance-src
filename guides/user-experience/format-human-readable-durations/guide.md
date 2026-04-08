---
name: format-human-readable-durations
description: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context.
web-feature-ids:
  - temporal
sources:
  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
  - https://www.npmjs.com/package/@js-temporal/polyfill
---

# Formatting Human-Readable Durations with Temporal

Presenting elapsed time or durations to users in a readable format (e.g., "1 hour and 30 minutes") has historically required manual math or external libraries. The `Temporal` API's `Temporal.Duration` class simplifies this by providing structured duration objects and powerful "balancing" capabilities via the `round()` method.

## How to Implement

To format a duration:

1.  **Create a Duration**: Use `Temporal.Duration.from()` to create a duration object from a set of units.
2.  **Apply Balancing**: Use the `round()` method with the `largestUnit` option to control how units are balanced. For example, to convert 90 minutes into hours and minutes, or to keep it as total minutes.
3.  **Build the Display String**: Access the specific unit properties (like `.hours`, `.minutes`) to construct the human-readable string.

### Example: Duration Balancing

```javascript
// 1. Create a duration (e.g., from user input or calculation)
const duration = Temporal.Duration.from({ minutes: 90 });

// 2. Balance to hours
// This converts 90 minutes to 1 hour and 30 minutes
const balancedToHours = duration.round({ largestUnit: 'hours' });
console.log(`${balancedToHours.hours} hours and ${balancedToHours.minutes} minutes`);
// Output: "1 hours and 30 minutes" (Note: Pluralization needs handling)

// 3. Balance to minutes (keep as total minutes)
const balancedToMinutes = duration.round({ largestUnit: 'minutes' });
console.log(`${balancedToMinutes.minutes} minutes`);
// Output: "90 minutes"
```

## Strategic Implementation & Best Practices

*   **DO** use `Temporal.Duration.round()` with `largestUnit` to control the display strategy (detailed breakdown vs total count).
*   **DO** handle pluralization and joining of units manually or with external helpers, as `Temporal.Duration` does not provide localized string formatting.
*   **DO NOT** rely on `Temporal.Duration.prototype.toString()` for user-facing text; it returns ISO 8601 strings (e.g., `PT1H30M`).
*   **DO** use feature detection and a polyfill for environments lacking native support.

## Fallback strategies

{{ BASELINE_STATUS("temporal") }}

For browsers that do not yet support the native `Temporal` API, use feature detection and load the `@js-temporal/polyfill`.

```javascript
// Check if Temporal is supported natively
if (typeof Temporal === 'undefined') {
  // Load the polyfill conditionally
  import('@js-temporal/polyfill').then(({ Temporal: TemporalPolyfill }) => {
    // Assign to global scope if your app code uses the global 'Temporal'
    globalThis.Temporal = TemporalPolyfill;
    initializeApp();
  });
} else {
  // Native Temporal is available
  initializeApp();
}

function initializeApp() {
  const duration = Temporal.Duration.from({ minutes: 90 });
  const balanced = duration.round({ largestUnit: 'hours' });
  console.log(balanced.toString());
}
```