- The implementation MUST feature-detect the `Temporal` API before usage to ensure compatibility.
- The implementation MUST conditionally load a Temporal polyfill only if native support is absent.
- The implementation MUST ensure the Temporal API is available globally if the application logic relies on the global `Temporal` object.
- The implementation MUST use `Temporal.PlainDate` for capturing calendar dates (such as birthdates, anniversaries, or holidays) where the specific time of day or time zone is irrelevant.
- The implementation MUST use `Temporal.PlainTime` for capturing wall-clock times (such as a daily alarm or reminder) where the time should remain constant regardless of the user's time zone.
- The implementation MUST NOT use `Temporal.PlainDate` or `Temporal.PlainTime` for data that represents a specific moment in physical time (an instant).
- Legacy `Date` objects are not constructed from hand-assembled ISO strings (such as `` `${date}T00:00:00Z` ``); when a `Date` is produced from a Temporal value, it is constructed from the `epochMilliseconds` of a `Temporal.Instant` or `Temporal.ZonedDateTime`.
- `Intl.DateTimeFormat.prototype.formatToParts()` is not used to extract year, month, or day parts; calendar fields are read from Temporal plain types and compared directly (for example, with `.equals()`).
- The implementation MUST NOT attempt to modify `Temporal` instances directly, as they are immutable.

