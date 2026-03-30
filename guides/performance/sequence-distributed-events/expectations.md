- The implementation MUST check for native `Temporal` support using `typeof Temporal === 'undefined'` or similar feature detection before using Temporal APIs.
- The implementation MUST capture timestamps for high-frequency events using `Temporal.Now.instant()`.
- The implementation MUST sort events chronologically using `Temporal.Instant.compare()`.
- The implementation MUST calculate the difference between events using the `.since()` method between two `Temporal.Instant` objects.
- The implementation MUST NOT rely on `Date.now()` as the primary mechanism for sequencing if nanosecond resolution is required to prevent collisions.
- The implementation MUST provide a fallback experience (e.g., disabling the feature, showing a banner, or falling back to limited precision) when `Temporal` is not supported.
- The implementation MUST include a fallback calculation for the precision difference if `Temporal` is not supported (e.g., converting millisecond differences to nanoseconds or using milliseconds to maintain UI consistency).

