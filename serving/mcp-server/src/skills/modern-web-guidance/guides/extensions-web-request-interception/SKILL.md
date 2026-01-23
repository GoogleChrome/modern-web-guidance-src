---
description: Intercept, analyze, and modify web requests to enhance browser functionality or security.
filename: web-request-interception
category: extensions
---

# Web Request Interception

Reference docs:
- https://developer.chrome.com/docs/extensions/mv3/reference/webrequest/

## Best Practices

Use the `chrome.webRequest` API to intercept and manage network requests made by your extension. This allows you to observe, block, redirect, or modify requests and their headers.

### Manifest Declarations

Ensure you declare the `"webRequest"` permission in your extension's manifest. For specific functionalities like blocking or modifying headers, you might also need `"webRequestAuthProvider"` or `"declarativeNetRequest"`. Also, declare necessary host permissions to specify which URLs your extension can access.

```json
{
  "name": "My Web Request Extension",
  "version": "1.0",
  "manifest_version": 3,
  "permissions": [
    "webRequest",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

### Event Listeners

Register listeners for various `webRequest` events like `onBeforeRequest`, `onHeadersReceived`, and `onCompleted` to hook into the request lifecycle.

```javascript
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    console.log("Request URL:", details.url);
    // Example: Block requests to a specific domain
    if (details.url.includes("evil.com")) {
      return {cancel: true};
    }
    return {cancel: false};
  },
  {urls: ["<all_urls>"]}, // Filter for all URLs
  ["blocking"] // Use "blocking" for synchronous operations
);
```

### Blocking and Modifying Requests

- **Blocking:** Return `{cancel: true}` from an event listener (e.g., `onBeforeRequest`) to block a request.
- **Redirecting:** Return `{redirectUrl: "new_url"}` from `onBeforeRequest`.
- **Modifying Headers:** Return an object with modified `requestHeaders` or `responseHeaders` from `onBeforeSendHeaders` or `onHeadersReceived` respectively. Use `opt_extraInfoSpec` with `"requestHeaders"` or `"responseHeaders"`.

```javascript
chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    for (var i = 0; i < details.responseHeaders.length; i++) {
      if (details.responseHeaders[i].name === 'Content-Security-Policy') {
        details.responseHeaders.splice(i, 1);
        break;
      }
    }
    return {responseHeaders: details.responseHeaders};
  },
  {urls: ["<all_urls>"]},
  ["blocking", "responseHeaders"]
);
```

### `opt_extraInfoSpec`

Use `opt_extraInfoSpec` to request additional information or enable specific behaviors:
- `"blocking"`: Enables synchronous callback execution and allows returning a `BlockingResponse`.
- `"requestHeaders"`: Provides request headers in `onBeforeSendHeaders`.
- `"responseHeaders"`: Provides response headers in `onHeadersReceived`.
- `"extraHeaders"`: Provides access to sensitive headers (e.g., `Origin`, `Cookie`) and is necessary for modifying headers that affect CORS checks or bypassing CORB. **Use with caution** as it can impact performance.

### Handling Conflicts and Performance

- **Conflict Resolution:** Only one extension can redirect or modify headers at a time. The most recently installed extension wins. An extension is not notified if its modification is ignored.
- **Performance:** Avoid unnecessary use of `opt_extraInfoSpec: ['extraHeaders']`. Filter requests as much as possible in the `urls` parameter of the `addListener` filter to reduce the number of events processed by your extension.
- **Caching:** If you change request handling behavior, call `chrome.webRequest.handlerBehaviorChanged()` to flush the in-memory cache. This is an expensive operation, so use it sparingly.

### Limitations

- The API does not provide final HTTP headers sent to the network (e.g., caching-related headers).
- Certain sensitive requests or requests from other extensions are hidden.
- Synchronous XHRs from your extension are hidden to prevent deadlocks.
- Redirects are not supported for WebSocket requests.
- WebTransport over HTTP/3: Modifying headers in `onBeforeSendHeaders` is ignored, and redirects/authentication are not supported.

## Fallback Strategies

For features that might not be universally supported or for older browsers:

- **Manifest V2 vs. V3:** Be aware of the transition. Manifest V3 deprecates `webRequestBlocking` for most extensions in favor of `declarativeNetRequest`.
- **Cross-Origin Resource Sharing (CORS):** Modifying certain headers for cross-origin requests requires specifying `'extraHeaders'` in `opt_extraInfoSpec`. Be mindful of CORS preflight requests.
- **WebSockets/WebTransport:** Understand that the API intercepts the handshake but not the actual data transfer for WebSockets, and has specific limitations for WebTransport.

## Examples

### Blocking specific domains

```javascript
chrome.webRequest.onBeforeRequest.addListener(
  function(details) { return {cancel: true}; },
  {urls: ["*://www.evil.com/*"]},
  ["blocking"]
);
```

### Modifying request headers

```javascript
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    details.requestHeaders.push({name: "X-My-Custom-Header", value: "MyValue"});
    return {requestHeaders: details.requestHeaders};
  },
  {urls: ["<all_urls>"]},
  ["blocking", "requestHeaders"]
);