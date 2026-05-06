# fetchlater

## Fallbacks { #fallbacks }

A fallback strategy is required if `fetchLater()` doesn't meet your Baseline target. However, given the improved reliability and performance benefits of this API, `fetchLater()` should be used if the browser supports it.

## Polyfill { #polyfill }

Use the following minimal `fetchLater()` polyfill, which implements the API as closely as possible in unsupporting browsers.

<details>
<summary>View Polyfill Code</summary>

```javascript
globalThis.fetchLater ??= function fetchLater(url, init = {}) {
  let timeoutHandle;
  let activated = false;

  function sendNow() {
    if (!(init.signal && init.signal.aborted)) {
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
</details>
