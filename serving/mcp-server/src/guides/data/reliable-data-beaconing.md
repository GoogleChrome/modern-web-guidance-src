---
description: Reliably send data from a web page to a server, even if the page is closed or the user navigates away, by using the fetchLater API.
filename: reliable-data-beaconing
category: data
---

# Reliable Data Beaconing with `fetchLater()`

The `fetchLater()` API provides a robust mechanism for ensuring that data is sent to a server, even under challenging circumstances such as page closure or navigation away from the site. This addresses a common problem where traditional methods of sending data on page unload can be unreliable.

## Best Practices

When implementing `fetchLater()`, consider the following best practices to ensure optimal performance and reliability:

### Using `fetchLater()`

*   **Request and Options:** `fetchLater()` accepts arguments similar to `fetch()`, including a `request` (URL string or `Request` object) and an optional `options` object.
*   **`activateAfter` Option:** Utilize the `activateAfter` option to specify a timeout for the fetch request. This allows you to balance timely data transmission with guaranteed delivery even if the page is closed.
*   **`AbortController`:** Employ an `AbortController` to manage and cancel pending `fetchLater()` requests, which is crucial when updates occur and a new request needs to be scheduled.

```js
// Example of scheduling a fetch with a timeout and abort capability
const fetchLaterController = new AbortController();
const requestOptions = {
  method: 'POST',
  body: JSON.stringify({ data: 'some payload' }),
  signal: fetchLaterController.signal,
  activateAfter: 60 * 60 * 1000, // 1 hour timeout
};

const fetchLaterResult = fetchLater('/api/beacon', requestOptions);

// To cancel the request if needed:
// fetchLaterController.abort();
```

### Feature Detection

Always feature detect the `fetchLater` global before using it to ensure compatibility with browsers that may not support the API.

```js
if (globalThis.fetchLater) {
  // Use fetchLater() for reliable data beaconing
  fetchLater('/analytics', {
    method: 'POST',
    body: JSON.stringify({ event: 'user_interaction' }),
  });
} else {
  // Fallback to traditional methods if fetchLater is not supported
  // e.g., navigator.sendBeacon() or fetch() with keepalive
  console.warn('fetchLater API not supported. Falling back to alternative.');
  // ... fallback implementation ...
}
```

### Error Handling and Fallbacks

While `fetchLater()` is designed for reliability, it's still good practice to consider fallback strategies. For instance, if the `fetchLater` request fails for some reason or is not supported, consider using `navigator.sendBeacon()` or `fetch()` with the `keepalive` option as a secondary measure.

## Example Use Case: Core Web Vitals Monitoring

`fetchLater()` is particularly useful for scenarios like measuring Core Web Vitals in the field. Performance metrics can change until the user leaves a page, and ensuring these final metrics are captured without data loss due to unreliable page unload mechanisms is critical.

```js
import { onCLS, onINP, onLCP } from 'web-vitals';

const metricQueue = new Set();
let currentFetchLaterSignal = null;

function sendWebVitalsUpdate(metricUpdate) {
  metricQueue.add(metricUpdate);
  const body = JSON.stringify([...metricQueue]);

  // Abort any existing fetchLater to schedule a new one with the latest data
  if (currentFetchLaterSignal) {
    currentFetchLaterSignal.abort();
  }

  const controller = new AbortController();
  currentFetchLaterSignal = controller;

  fetchLater('/web-vitals-analytics', {
    method: 'POST',
    body,
    signal: controller.signal,
    activateAfter: 30 * 60 * 1000, // Send within 30 minutes, or on page close
  }).then(result => {
    if (result.activated) {
      // If the fetchLater activated and was sent, clear the queue for new metrics
      metricQueue.clear();
      currentFetchLaterSignal = null;
    }
  });
}

if (globalThis.fetchLater) {
  onCLS(sendWebVitalsUpdate);
  onINP(sendWebVitalsUpdate);
  onLCP(sendWebVitalsUpdate);
} else {
  console.warn('fetchLater not available. Core Web Vitals may not be reliably reported.');
  // Consider a fallback here if necessary
}
```

## Origin Trial and Testing

`fetchLater()` is currently available in Chrome via an origin trial. For local testing and development:

*   Enable "Experimental Web Platform features" flag at `chrome://flags/#enable-experimental-web-platform-features`.
*   Run Chrome from the command line with `--enable-experimental-web-platform-features` or `--enable-features=FetchLaterAPI`.

## Limitations

Be aware of current limitations:
*   `fetchLater()` is not yet available in service workers.
*   It will not beacon after a browser crash.
*   The API might differ slightly from the final specification.

Refer to the [Chromium experiment docs](https://chromium.googlesource.com/chromium/src/+/main/docs/experiments/fetch-later.md) for the most up-to-date information on supported features and limitations.

## Feedback

Developer feedback is crucial for refining new web APIs. Please file issues and provide feedback on the [pending-beacon GitHub repository](https://github.com/WICG/pending-beacon/issues).