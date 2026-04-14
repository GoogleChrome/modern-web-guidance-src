---
name: format-human-readable-durations
description: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context.
web-feature-ids:
  - temporal
  - intl-duration-format
sources:
  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
  - https://www.npmjs.com/package/@js-temporal/polyfill
---

# Formatting Human-Readable Durations with Temporal

Presenting elapsed time or durations to users in a readable format (e.g., "1 hour and 30 minutes") has historically required manual math or external libraries. The `Temporal` API's `Temporal.Duration` class simplifies this by providing structured duration objects and powerful "balancing" capabilities via the `round()` method.

## How to Implement

To format a duration:

1.  (**MANDATORY**) **Create a Duration**: Use `Temporal.Duration.from()` to create a duration object from a set of units.
2.  (**OPTIONAL**) **Apply Balancing**: Use the `round()` method with the `largestUnit` option to control how units are balanced. For example, to convert 90 minutes into hours and minutes, or to keep it as total minutes.
3.  (**MANDATORY**) **Build the Display String**: Access the specific unit properties (like `.hours`, `.minutes`) to construct the human-readable string manually, or **(Recommended)** use `Intl.DurationFormat` for a localized, automatic approach.

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

### Example: Localized Formatting with Intl.DurationFormat

```javascript
// 1. Create a duration
const duration = Temporal.Duration.from({ hours: 1, minutes: 30 });

// 2. Format using Intl.DurationFormat (Recommended)
const formatter = new Intl.DurationFormat('en', { style: 'long' });
console.log(formatter.format(duration));
// Output: "1 hour and 30 minutes"
```

## Strategic Implementation & Best Practices

*   **DO** use `Temporal.Duration.round()` with `largestUnit` to control the display strategy (detailed breakdown vs total count).
*   **DO** use `Intl.DurationFormat` for localized string formatting and automatic pluralization, or fall back to manual construction if not supported. 
*   **DO NOT** rely on `Temporal.Duration.prototype.toString()` for user-facing text; it returns ISO 8601 strings (e.g., `PT1H30M`).
*   **DO** use feature detection and a polyfill for environments lacking native support.

## Fallback strategies

{{ BASELINE_STATUS("temporal") }}

For browsers that do not yet support the native `Temporal` API or `Intl.DurationFormat`, use feature detection and load the appropriate polyfills.

*   For `Temporal`: Use `@js-temporal/polyfill`.
*   For `Intl.DurationFormat`: Use a polyfill like the one provided by FormatJS.

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