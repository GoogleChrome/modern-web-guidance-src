- The implementation MUST feature-detect the `Temporal` API using `typeof Temporal === 'undefined'` before usage.
- The implementation MUST conditionally load a Temporal polyfill (e.g., `@js-temporal/polyfill`) only if native support is absent.
- The implementation MUST manually assign the loaded polyfill to `globalThis.Temporal` to ensure it is globally accessible if the application logic relies on the global name.
- The implementation MUST use `Temporal.ZonedDateTime` as the primary type for calculating differences between real-world events that occur in specific time zones.
- The implementation MUST calculate the time elapsed since a start event using the `.since()` method on a `Temporal.ZonedDateTime` instance.
- The implementation MUST calculate the time remaining until an end event using the `.until()` method on a `Temporal.ZonedDateTime` instance.
<<<<<<< HEAD
- The implementation MUST specify a `largestUnit` (such as `'year'`, `'month'`, or `'week'`) in the options object passed to `.since()` or `.until()` to ensure balanced, human-readable durations.
- The implementation MUST use the native `.sign` property of the computed `Temporal.Duration` (or use `Temporal.ZonedDateTime.compare`) to check if a duration represents a past/expired time point (negative sign) or future pending start.
- The implementation MUST NOT attempt to modify `Temporal` instances directly, as they are immutable. It MUST use the new instances returned by operations like `add()` or `subtract()`.
=======
- The implementation MUST specify a `largestUnit` (such as `'year'`, `'month'`, or `'day'`) in its duration calculations to ensure balanced, human-readable durations.
- The implementation MUST use `Temporal.ZonedDateTime.compare` to compare two date-time points (e.g., determining if a current time is past an expiration time).
- If the implementation uses `add()` or `subtract()` methods, it MUST use the returned new instances, as `Temporal` instances are immutable.
>>>>>>> main
- The implementation MUST NOT use the legacy `Date` object for the core event differential calculations.
- The implementation MUST NOT use brittle string slicing (such as `.slice(0, 5)`) to format PlainTime values; instead, it MUST format them using `toPlainTime().toString({ smallestUnit: 'minute' })` directly.
- The implementation MUST NOT perform manual string formatting (such as manually joining unit numbers with custom suffixes) for user-facing duration display when `Intl.DurationFormat` / `.toLocaleString()` is supported; instead, it MUST format them with `.toLocaleString('en-US', { style: 'narrow' })` (or equivalent) with a graceful progressive enhancement fallback.
- The implementation MUST NOT perform redundant separate parsing of `PlainDate` and `PlainTime` when combining date and time inputs; instead, it MUST use `PlainDateTime.from(\`\${date}T\${time}\`)` to combine them directly.
