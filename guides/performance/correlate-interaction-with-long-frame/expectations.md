# Expectations: `correlate-interaction-with-long-frame`

- The `scripts` object may be empty.
- A performance observer should be used with type `long-animation-frame` and `buffered: true` options passed.
- Long animation frame entries are filtered based on `firstUIEventTimestamp`.
- No polyfill is included for long animation frames.
