# fetchlater

## Fallbacks { #fallbacks }

A fallback strategy is required if `fetchLater()` doesn't meet your Baseline target. However, given the improved reliability and performance benefits of this API, `fetchLater()` should be used if the browser supports it.

**Polyfill Behavior Difference:** The only notable behavior difference with this polyfill is instead of sending the payload when the user leaves the page, it sends it whenever the page's `visibilityState` changes to "hidden", since this is the most reliable end-of-session signal that's widely available today. Your code does not need to listen for `visibilitychange`; just call `fetchLater()` and the polyfill handles delivery. This is a crucial timing difference for analytics teams comparing session/beacon counts between supported and unsupported browsers.

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
