---
name: capture-location-agnostic-data
description: Record chronological data that should not change based on a user's location, such as birthdates, recurring alarms, or national holidays.
web-feature-ids:
  - temporal
---

# Capturing Location-Agnostic Data with Temporal

Recording chronological data that should remain identical regardless of the viewer's location (such as birthdates, recurring alarms, or national holidays) has historically been error-prone with the legacy `Date` object. Because a `Date` always represents a specific instant in time and is displayed using whatever time zone the viewer's device happens to be in, saving a date like "1990-01-01" can result in users in different time zones seeing "1989-12-31" due to offset shifts.

The `Temporal` API introduces "Plain" types—such as `Temporal.PlainDate` and `Temporal.PlainTime`—which have no concept of a time zone. These types represent calendar dates and wall-clock times exactly as you would read them off a calendar or a clock, making them ideal for location-agnostic data.

## How to Implement

To capture and display location-agnostic data:

1.  **Use `Temporal.PlainDate` for dates**: For data like birthdates or holidays, use `Temporal.PlainDate.from()` to create an instance from an ISO 8601 string or an object.
2.  **Use `Temporal.PlainTime` for times**: For data like a daily alarm or a preferred lunch time, use `Temporal.PlainTime.from()`.
3.  **Display without conversion**: Since these objects are time-zone unaware, they will display the same values regardless of the user's local time zone.

### Example: Capturing a Birthdate

```javascript
// 1. Parse a date string from an input (e.g., "1990-01-01")
const birthdateStr = "1990-01-01";
const plainDate = Temporal.PlainDate.from(birthdateStr);

// 2. Display the date
// This will output "01/01/1990" (or equivalent) in any time zone
console.log(plainDate.toLocaleString('en-GB'));

// 3. Read calendar fields directly from the Plain type. A PlainDate already *is*
// a calendar date, so there is no need for the formatToParts() workaround that
// legacy Date code uses to recover year/month/day from an instant.
const { year, month, day } = plainDate;
```

### Example: Interoperating with legacy `Date`

A legacy `Date` is a timestamp (an instant), not a calendar date. Storing "1990-01-01" as a `Date` forces you to pick *some* instant (typically midnight UTC), and reading it back in a time zone west of UTC yields "31/12/1989". If a library or API still requires a `Date`, convert explicitly through `Temporal.Instant` rather than building ISO strings by hand:

```javascript
// PlainDate -> Date: attach a time zone (time of day defaults to the start of
// that day) to get an Instant, then hand the epoch milliseconds to Date.
// 'UTC' is a deliberate choice and must be documented; any zone would do,
// but the stored instant depends on it.
const instant = plainDate.toZonedDateTime('UTC').toInstant();
const legacyDate = new Date(instant.epochMilliseconds);

// Date -> PlainDate: go back through Instant (legacyDate.toTemporalInstant()
// is equivalent), then project into an explicit time zone. The result depends
// on the zone, which is exactly the drift risk.
const viewedDate = Temporal.Instant.fromEpochMilliseconds(legacyDate.getTime())
  .toZonedDateTimeISO('America/New_York')
  .toPlainDate();

// Compare Plain types with .equals() (or Temporal.PlainDate.compare), not strings.
console.log(viewedDate.equals(plainDate)); // false: the calendar date drifted to 1989-12-31
```

## Strategic Implementation & Best Practices

-   **DO** use `Temporal.PlainDate` for "calendar dates" like birthdates, anniversaries, and holidays where the specific time of day or time zone is irrelevant.
-   **DO** use `Temporal.PlainTime` for "wall-clock times" like a daily reminder at 9:00 AM, where the time should be 9:00 AM in whatever time zone the user happens to be in.
-   **DO NOT** use Plain types if you need to represent a specific moment in physical time (an "instant"). Use `Temporal.Instant` or `Temporal.ZonedDateTime` for logs, event timestamps, or anything requiring time zone awareness.
-   **DO NOT** construct `Date` objects from hand-built ISO strings (such as `` `${date}T00:00:00Z` ``). Produce a `Date` from the `epochMilliseconds` of a `Temporal.Instant` or `Temporal.ZonedDateTime`, and read one back with `Temporal.Instant.fromEpochMilliseconds(date.getTime())` or `date.toTemporalInstant()`, so the time zone assumption is explicit.
-   **DO NOT** use `Intl.DateTimeFormat.prototype.formatToParts()` to extract or compare year, month, or day values. Read the `.year`, `.month`, and `.day` properties of a Plain type, and compare with `.equals()`.
-   **DO** identify time zones by IANA name (e.g., `America/New_York`) and never by a fixed UTC offset. Offsets change with daylight saving time and legislation, so labels like "UTC-5" become wrong for part of the year.
-   **DO** remember that `Temporal` objects are **immutable**. Methods like `add()` or `with()` return a new instance rather than modifying the original.

## Fallback Strategy

{{ FEATURE_FALLBACKS("temporal") }}