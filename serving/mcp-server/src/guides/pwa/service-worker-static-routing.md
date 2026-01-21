---
description: Optimize service worker performance by declaratively routing specific URL patterns to bypass the service worker for direct network or cache access.
filename: service-worker-static-routing
category: pwa
---

# Service Worker Static Routing API

This document outlines best practices for using the Service Worker Static Routing API, available from Chrome 123, to improve performance by selectively bypassing the service worker.

## Use the API

The `ServiceWorkerStaticRouting` API allows you to declaratively define how specific resource paths should be fetched. This prevents the service worker from unnecessarily intercepting requests for resources that can be served directly from the network or cache.

To use the API, call `event.addRoutes` on the service worker `install` event. This method accepts a list of routes, each with a `condition` and a `source`.

### `condition`

Specifies when the rule applies. It accepts the following properties:

*   `urlPattern`: A `URLPattern` instance or a string representing a valid `URLPattern`.
*   `requestMethod`: A string representing the Request [method](https://developer.mozilla.org/docs/Web/API/Request/method) (e.g., `"GET"`, `"POST"`).
*   `requestMode`: A string representing the Request [mode](https://developer.mozilla.org/docs/Web/API/Request/mode) (e.g., `"cors"`, `"navigate"`).
*   `requestDestination`: A string representing the Request [destination](https://developer.mozilla.org/docs/Web/API/Request/destination) (e.g., `"document"`, `"image"`).
*   `runningStatus`: A string, either `"running"` or `"not-running"`, indicating the service worker's running status.

Multiple conditions within a single route must all be met. You can use an `or` array for alternative conditions.

### `source`

Specifies how resources matching the `condition` are loaded. It can be one of the following strings:

*   `"network"`: Fetch directly from the network.
*   `"cache"`: Fetch from a cache.
*   `"fetch-event"`: Handle by the service worker's `fetch` event.
*   `"race-network-and-fetch-handler"`: Race network requests against the service worker's fetch handler.

The `source` can optionally include a cache name, for example: `{ cacheName: "pictures" }`.

## Examples

### Route articles to the service worker if running

This example routes requests starting with `/articles/` to the service worker if it's currently running.

```js
addEventListener('install', (event) => {
  event.addRoutes({
    condition: {
      urlPattern: "/articles/*",
      runningStatus: "running"
    },
    source: "fetch-event"
  });
});
```

### Send form submissions directly to the network

This example ensures that `POST` requests to `/form/*` bypass the service worker and go directly to the network.

```js
addEventListener('install', (event) => {
  event.addRoutes({
    condition: {
      urlPattern: "/form/*",
      requestMethod: "post"
    },
    source: "network"
  });
});
```

### Use a specific cache for image files

This example uses the cache named `"pictures"` to serve `.png` and `.jpg` files.

```js
addEventListener('install', (event) => {
  event.addRoutes({
    condition: {
      or: [
        {urlPattern: "*.png"},
        {urlPattern: "*.jpg"}
      ]
    },
    source: {
      cacheName: "pictures"
    }
  });
});
```

## Changes from Origin Trial

The current API uses `event.addRoutes()`, replacing the older `InstallEvent.registerRouter()`. The `registerRouter()` method could only be called once and has been deprecated. Migrate any existing `registerRouter()` code to `addRoutes()` as it will be removed in Chrome 125.

The new API also supports enhanced `URLPattern` features introduced in Chrome 121, allowing for specification of request methods, modes, and destinations, along with additional source options.

## Support in Chrome DevTools

*   **Application Panel (Service Worker Tab):** Registered router rules are displayed here, allowing you to inspect and debug them.
*   **Network Panel:** When a request matches a registered rule, this is indicated in the size column. Hovering over the size column reveals the registered router ID, which corresponds to the rules shown in the Application tab.