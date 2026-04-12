---
name: support-global-calendar-systems
description: Display and calculate dates in non-Gregorian calendar systems (e.g., Islamic, Hebrew, or Chinese) accurately for international users.
web-feature-ids:
  - temporal
sources:
  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
  - https://tc39.es/proposal-temporal/docs/
  - https://tc39.es/proposal-temporal/docs/calendars.html
  - https://www.w3schools.com/js/js_temporal.asp
---

# Supporting Global Calendar Systems with Temporal

The traditional JavaScript `Date` object is based on a proleptic Gregorian calendar, making it challenging to build applications for users who rely on other calendar systems, such as the Islamic (lunar), Hebrew (lunisolar), or Chinese (lunisolar) calendars. Developers previously had to rely on complex third-party libraries or manual calculations to support these systems.

The `Temporal` API provides first-class support for multiple calendar systems. By associating a calendar identifier with date objects, Temporal handles the complex arithmetic and formatting required for different cultural contexts natively.

## How to Implement

To support global calendar systems using Temporal:

1. **Associate a Calendar (Mandatory):** When creating or converting a Temporal object (like `Temporal.PlainDate`), you must specify the desired calendar system using `withCalendar()` to perform calendar-sensitive operations.
2. **Use Stable Identifiers (Mandatory for Lunisolar Calendars):** You must use `monthCode` rather than the numeric `month` index to identify specific months across years in lunisolar calendars. Only use this for calendars that use leap months, such as the Hebrew and Chinese calendars.
3. **Respect Calendar Invariants (Mandatory):** When iterating through months or days, you must not assume fixed values (like 12 months in a year or 31 days in a month). Use properties like `monthsInYear` and `daysInMonth` to ensure your code works across all calendars.

## Example Code: Converting and Iterating Calendars

```javascript
// 1. Get current date in default ISO 8601 calendar
const isoDate = Temporal.Now.plainDateISO();

// 2. Convert to Hebrew calendar
const hebrewDate = isoDate.withCalendar('hebrew');

// 3. Log properties specific to the calendar
console.log(`Hebrew Year: ${hebrewDate.year}`);
console.log(`Month Code: ${hebrewDate.monthCode}`); // Stable across leap years

// 4. Safely iterate through months in the current year
for (let m = 1; m <= hebrewDate.monthsInYear; m++) {
  console.log(`Month ${m} has ${hebrewDate.with({ month: m }).daysInMonth} days.`);
}

// 5. Format for display using toLocaleString
const localizedDisplay = hebrewDate.toLocaleString('en-u-ca-hebrew', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});
```

## Strategic Implementation & Best Practices

- **DO** use `Temporal.PlainDate.compare()` instead of manually comparing properties like `year` or `month` across different calendars.
- **DO** use `monthsInYear` as the upper bound when looping through months, rather than assuming 12.
- **DO** use `monthCode` for identifying specific months in calendars that use leap months (e.g., Hebrew or Chinese), regardless of the year.
- **DO NOT** assume `date.month === 12` is the last month of the year. Use `date.month === date.monthsInYear`.
- **DO NOT** assume `inLeapYear === true` implies the year is only one day longer. In lunisolar calendars, it may add a full leap month.
- **DO** use `toLocaleString()` to format dates for users instead of manual string concatenation.

## Fallback Strategy

{{ BASELINE_STATUS("temporal") }}

The Temporal API is currently a proposal and is not yet part of "Baseline Widely Available". For production use in browsers that do not support it natively, you must use a polyfill.

The recommended approach is to progressively enhance by checking for native support and dynamically loading a polyfill like `@js-temporal/polyfill` if needed.

```javascript
/**
 * Progressive Enhancement Fallback
 */
async function getTemporal() {
  if (typeof Temporal !== 'undefined') {
    return Temporal;
  }
  
  try {
    // Load polyfill dynamically
    const module = await import('https://esm.sh/@js-temporal/polyfill');
    return module.Temporal;
  } catch (e) {
    console.error('Failed to load Temporal polyfill:', e);
    throw e;
  }
}
```

## Knowledge Gaps & Open Questions

- **Supported Calendars:** While Temporal supports many calendars via `Intl`, the exact list of supported calendar IDs may vary by environment. Developers should verify support using `Intl.supportedValuesOf('calendar')`.
- **Complex Calendar Edge Cases:** Specific cultural nuances for less common calendars may not be fully covered by general invariants. Human review is recommended for critical cultural date calculations.