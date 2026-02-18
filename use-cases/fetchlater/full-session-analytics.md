---
description: Reliably measure full-session analytics and telemetry with minimal beaconing
baseline-status: limited-availability
Usage-recommendation: use-now-with-fallback
web-feature-ids:
  - fetchlater
---

# Reliably measure full-session analytics and telemetry with minimal beaconing

## Description

Developers often need to collect user analytics and telemetry data throughout the entirety of a user's visit to a web page (not just when the page loads). If you collect that data prior to the user leaving, you get an incomplete picture and potentially miss critical aspects of the user journey that may be important to optimize.

For example, the following types of data are all important to collect:

- Feature usage data and other relevant interaction patterns
- Real-user performance and Core Web Vitals (specifically INP and CLS)
- Error and exception tracking (which could happen at any time during a user's visit).

To measure full-session user analytics properly, you need to capture data throughout an entire page visit, and defer sending that data until the last moment before the user leaves. However, capturing full-session analytics has historically been tricky due to the fact that traditional end-of-session signals (such as `unload`, `beforeunload`, `pagehide`, or `visibilitychange` events) are notoriously unreliable (especially on mobile) and can negatively impact performance (registering an `unload` event handler can disqualify a page from being eligible for the Back/Forward cache).

The solution to these challenges is the `fetchLater()` API, which lets you decouple the capturing of user data from sending it via the following process:

1. As soon as relevant user data is available, call `fetchLater()` with the most up-to-date snapshot of that data. This schedules that data to be sent at a later time.
2. If the data ever change, or if more data is collected, abort the scheduled send and call `fetchLater()` with the updated data.
3. If the user navigates away or closes the tab, the payload in the most recent call to `fetchLater()` will be reliably sent after the user leaves (or after a specified timeout period).

### Example code

This example measures the session duration of a user's visit to a page using `fetchLater()` to queue a new beacon every 10 seconds with the updated session duration. The previous beacon is aborted before the new one is queued, so only a single beacon is sent per page session.

```javascript
const sessionData = {
  duration: 0,
  id: crypto.randomUUID(),
};

let fetchLaterController = null;

function queueBeacon() {
  // Abort any pending beacons before creating a new one.
  if (fetchLaterController) {
    fetchLaterController.abort();
  }
  fetchLaterController = new AbortController();

  // Update session duration to the current page time.
  sessionData.duration = performance.now();

  try {
    fetchLater('/api/session', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(sessionData),
      signal: fetchLaterController.signal,
    });
  } catch (error) {
    // Handle 'QuotaExceededError' if needed.
  }
}

// Update every 10 seconds with latest duration.
setInterval(queueBeacon, 10000);
```

## Best Practices

- Use `fetchLater()` to send data to a server whenever both: (1) a response is not necessary, and (2) it's not critical that the data is sent immediately.
- Always use an `AbortController` to cancel the pending fetch in cases where the data may need to be updated before the user leaves the page
- Keep the payload size to a minimum to avoid exceeding the quota (currently roughly 64KB per origin).
- Always wrap calls to `fetchLater()` in a `try/catch` to handle quota errors.
- Always feature detect the presence of `fetchLater()` on `globalThis` and implement a fallback strategy for browsers that don't support the API.
- **DO NOT** use a `ReadableStream` object for the request body, as that will error.

## Browser support and fallback strategies

The `fetchLater` API is not currently supported in all modern browsers (Baseline limited availability), thus a fallback strategy is required in most cases.

However, given the improved reliability and performance benefits of the `fetchLater()` API, it should be preferred if the browser supports it.

### Recommended fallback strategy

The ideal fallback strategy for `fetchLater()` is to create a basic polyfill that mimics the behavior as closely as possible.

The following example polyfill uses a combination of `fetch()` (with `keepalive` set to `true`) and `navigator.sendBeacon()` as the fallback mechanisms. The polyfill implements the same API as `fetchLater()`; however, instead of sending the payload when the user leaves the page, it sends it whenever the page's visibilityState changes to "hidden", as this is the most reliable mechanism to use for browsers that don't support the `fetchLater()` API.

```js
globalThis.fetchLater ??= function fetchLater(url, init = {}) {
  let timeoutHandle;
  let activated = false;

  function sendNow() {
    if (!(init.signal && init.signal.aborted)) {
      // Use fetch keepalive if the browser supports it or if custom fetch
      // parameters are specified (e.g. custom headers or methods).
      // Otherwise fall back to `navigator.sendBeacon()`.
      if (
        'keepalive' in Request.prototype ||
        init.method !== 'POST' ||
        init.headers
      ) {
        fetch(url, Object.assign({}, init, {keepalive: true}));
        activated = true;
      } else {
        activated = navigator.sendBeacon(url, init.body);
      }
    }
    destroy();
  }

  function destroy() {
    document.removeEventListener('visibilitychange', sendNow);
    clearTimeout(timeoutHandle);
  }

  if (document.visibilityState === 'hidden') {
    // If the beacon was created while the page is already hidden, send data
    // ASAP but wait until the next microtask to allow all sync code to run.
    queueMicrotask(sendNow);
  } else {
    document.addEventListener('visibilitychange', sendNow);

    if (typeof init.activateAfter === 'number' && init.activateAfter >= 0) {
      timeoutHandle = setTimeout(sendNow, init.activateAfter);
    }
  }

  if (init.signal) {
    init.signal.addEventListener('abort', destroy);
  }

  return {
    get activated() {
      return activated;
    },
  };
};
```
