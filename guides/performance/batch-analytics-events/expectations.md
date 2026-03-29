## Must pass
- The `fetchLater()` API is invoked with a URL string as the first argument, and a `DeferredRequestInit` object as the second argument.
- `fetchLater()` should be invoked with the `activateAfter` option set.
- Multiple invocations of `fetchLater()` within the `activateAfter` time window should be batched into a single request (e.g. prior calls should be aborted).
- Batching should be limited in some way to prevent starvation or quota overflow.
- If a `fetchLater()` call throws a `QuotaExceededError`, `RangeError`, or `TypeError`, it should be properly handled.
- The `fetchLater()` polyfill should be included in the bundle, unless the project is only supporting Chromium browsers.

## Must fail
- Uses `fetch()`, `sendBeacon()`, `XMLHttpRequest`, or `new Image()` to send beacons instead of `fetchLater()`.
- Sends events individually without batching (no abort of prior calls).

## App-agnostic rules
- Do not assert specific variable names or function names for the batching logic.
- Assert API usage patterns (e.g. `fetchLater` is called), not specific code structure.
- Do not assert specific filenames or directory layout.
