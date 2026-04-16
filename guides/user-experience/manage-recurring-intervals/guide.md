---
name: manage-recurring-intervals
description: Calculate recurring intervals for subscription billings or payroll cycles, automatically adjusting for edge cases such as month-end transitions (e.g., adding one month to January 31st) to ensure accurate period calculations.
web-feature-ids:
  - temporal
sources:
  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
  - https://www.npmjs.com/package/@js-temporal/polyfill
---

# Managing Recurring Intervals with Temporal

Calculating recurring intervals, such as subscription billing cycles or payroll periods, has historically been error-prone with the legacy `Date` object. Adding a month to a date like January 31st is ambiguous (should it be February 28th/29th or March 3rd?).

The `Temporal` API provides a clean solution with `Temporal.PlainDate` and its `.add()` method, which handles month-end transitions predictably using configurable overflow strategies.

## How to Implement

1. **MANDATORY:** **Parse the starting date**: Use `Temporal.PlainDate.from()` to create a date object.
2. **MANDATORY:** **Add the duration**: Use the `.add()` method with a duration object (e.g., `{ months: 1 }`).
3. **OPTIONAL:** **Specify overflow behavior**: Use the `overflow` option to control how invalid dates (like Feb 31) are handled.
    - `'constrain'` (default): Clamps to the last valid day of the month.
    - `'reject'`: Throws a `RangeError`.

### Example: Subscription Billing Cycle

```javascript
// 1. Parse the start date (e.g., billing starts on Jan 31st)
const startDate = Temporal.PlainDate.from('2024-01-31');

// 2. Add 1 month with default 'constrain' overflow
// Jan 31 + 1 month -> Feb 29 (2024 is a leap year)
const nextBillingDate = startDate.add({ months: 1 });
console.log(`Next billing: ${nextBillingDate.toString()}`); // 2024-02-29

// 3. Add 1 month to Feb 29
// Feb 29 + 1 month -> Mar 29
// Note: Day is preserved if valid, otherwise constrained.
const thirdBillingDate = nextBillingDate.add({ months: 1 });
console.log(`Third billing: ${thirdBillingDate.toString()}`); // 2024-03-29

// Example with 'reject' strategy
try {
  // Jan 31 + 1 month with 'reject' throws because Feb 31 is invalid
  const invalidDate = startDate.add({ months: 1 }, { overflow: 'reject' });
} catch (e) {
  console.log("Caught expected error:", e.name); // RangeError
}
```

## Strategic Implementation & Best Practices

- **DO** use `Temporal.PlainDate` for calculations that do not depend on specific times or time zones (like calendar dates or billing cycles).
- **DO** understand the default `constrain` behavior. It is usually what users expect for billing (e.g., Jan 31 -> Feb 28/29 -> Mar 28/29).
- **DO NOT** modify instances directly; `Temporal` objects are **immutable**. Operations return a new instance.
- **DO** use `overflow: 'reject'` if you need to enforce that the resulting date must exist in the calendar and handle failures explicitly.

### Fallback strategies

{{ BASELINE_STATUS("temporal") }}

For browsers that do not yet support the native `Temporal` API, use feature detection and a polyfill. The standard reference polyfill is `@js-temporal/polyfill`.

```javascript
// Check if Temporal is supported natively
if (typeof Temporal === 'undefined') {
  // Load the polyfill conditionally
  import('@js-temporal/polyfill').then(({ Temporal: TemporalPolyfill }) => {
    globalThis.Temporal = TemporalPolyfill;
    initializeApp();
  });
} else {
  initializeApp();
}

function initializeApp() {
  const date = Temporal.PlainDate.from('2024-01-31');
  console.log(date.add({ months: 1 }).toString());
}
```