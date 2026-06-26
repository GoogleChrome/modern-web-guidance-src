### 1. Divergence Point

The divergence between the two runs occurred during the implementation of the metric registration scripts (**Step 16 in Run A** vs. **Step 12 in Run B**):

*   **Run A** imported and registered both the Core Web Vitals (`onLCP`, `onINP`, `onCLS`) and auxiliary page-load metrics (`onFCP`, `onTTFB`) from a locally installed `web-vitals` package.
*   **Run B** strictly registered only the three Core Web Vitals (`onLCP`, `onINP`, `onCLS`) imported from `web-vitals@4` via CDN.

By registering early-firing, non-core metrics (`FCP` and `TTFB`), Run A introduced a race condition within the `fetchLater()` polyfill lifecycle during page unload.

---

### 2. Root Cause Explanation

The failure of Run A to send only a single beacon on page unload is caused by a precise sequence of event listeners and state transitions:

1.  **Early Metric Execution**: Metrics like `TTFB` and `FCP` finalize and fire their callbacks during the initial page load phase while `document.visibilityState` is `'visible'`.
2.  **Initial Polyfill Registration**: When `onTTFB` or `onFCP` fires, `queueBeacon()` is invoked. Because the page is visible, the `fetchLater()` polyfill registers a `'visibilitychange'` event listener on `document` to flush the payload (`sendNow`) when the page eventually hides.
3.  **Page Hide Transition**: When the user navigates away, the browser transitions the page to `'hidden'`, triggering the `'visibilitychange'` event.
4.  **First Beacon Dispatch**: The browser executes `'visibilitychange'` listeners in registration order. The polyfill's listener (registered early during page load) runs first, executing `sendNow()` and dispatching the first beacon via `fetch` keepalive or `sendBeacon`.
5.  **Late Core Metric Finalization**: The `web-vitals` library also listens to `'visibilitychange'` to finalize the Core Web Vitals (`LCP`, `INP`, `CLS`). When its listener runs, it fires the corresponding callbacks.
6.  **Second Beacon Dispatch**: The callbacks invoke `queueBeacon()`. Although `queueBeacon()` calls `fetchLaterController.abort()`, the previous controller has already executed and dispatched its beacon. Because `document.visibilityState` is now `'hidden'`, the new `fetchLater()` call immediately schedules `sendNow()` in a microtask, dispatching a second, redundant beacon.

In contrast, Run B avoided registering early-firing metrics, ensuring no beacon was queued or registered to the `'visibilitychange'` listener prior to the page hide transition, resulting in exactly one consolidated beacon.

---

### 3. Trajectory Contrast

| Dimension | Run A (Failed) | Run B (Successful) |
| :--- | :--- | :--- |
| **Metrics Monitored** | Core Web Vitals (`LCP`, `INP`, `CLS`) + Supporting (`FCP`, `TTFB`). | Strictly Core Web Vitals (`LCP`, `INP`, `CLS`). |
| **Dependency Source** | Installed locally via `pnpm` (`web-vitals` v5.3.0). | Loaded via CDN (`web-vitals` v4). |
| **Beacon Queueing Behavior** | Queues a beacon early during page load due to immediate `TTFB`/`FCP` events. | Queues beacons only when Core Web Vitals are updated or finalized. |
| **Unload Event Sequence** | Early-registered listener flushes first beacon; subsequent finalized metrics trigger a second beacon. | Single consolidated beacon is queued and dispatched during the unload transition. |
| **Outcome** | Failed assertion: Multiple beacons sent. | Passed all assertions. |