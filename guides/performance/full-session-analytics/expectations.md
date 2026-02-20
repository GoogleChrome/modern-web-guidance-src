# Expectations: `full-session-analytics`

- The `fetchLater()` API is the only API that should be used to send beacons. Other APIs like `fetch()`, `sendBeacon()`, `XMLHttpRequest`, or `new Image()` should not used.
- Only a single beacon should be sent, after the user leaves the page.
- If a `fetchLater()` call throws a `QuotaExceededError`, `RangeError`, or `TypeError`, it should be properly handled.
- The `fetchLater()` polyfill should be included in the bundle, unless the project is only supporting Chromium browsers.
