 The polyfill's original `visibilitychange` listener (for the aborted controller) is removed during `abort()` (via the abort signal listener calling `destroy()`).
8. The `visibilitychange` event propagation continues, but the original listener is gone, so it does nothing.
9. The microtask runs and sends the *new* beacon.
Result: Only ONE beacon is sent!

This is incredibly elegant! Let's verify this order of listener registration.
In Run B:
- Polyfill is defined in `<script>`.
- Module script runs, imports `web-vitals`. `web-vitals` immediately registers its `visibilitychange` listener (at startup).
- Later, LCP fires. `record()` is called, which calls `fetchLater()`.
- `fetchLater()` registers its `visibilitychange` listener.
- Since `web-vitals` registered its listener *first* (at startup), and `fetchLater` registered its listener *second* (at LCP fire), when `visibilitychange` fires:
  - `web-vitals` listener runs first. It fires `onCLS`/`onINP`.
  - `onCLS`/`onINP` call `record()`, which aborts the pending `fetchLater` (removing its listener before it can run!).
  - A new `fetchLater` is created, which queues a microtask to send.
  - The old `fetchLater` listener never runs because it was aborted.
  - Only the new beacon