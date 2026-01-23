---
description: Ensure service worker compatibility by adhering to cache.addAll() and importScripts() specifications.
filename: service-worker-compatibility
category: pwa
---

# Service Worker Compatibility

Developers using [service workers](https://developer.mozilla.org/docs/Web/API/Service_Worker_API) and the [Cache Storage API](https://developer.mozilla.org/docs/Web/API/CacheStorage) should be aware of changes in Chrome 71 that align its behavior with specifications and other browsers.

## Disallowing asynchronous `importScripts()`

The `importScripts()` method pauses the current execution of a service worker script, downloads additional code from a given URL, and runs it in the current global scope. This is useful for organizing service worker code into smaller pieces or incorporating third-party functionality.

Browsers mitigate performance concerns by caching imported scripts. For this to work effectively, the browser needs to ensure no new scripts are imported after the initial installation. According to the service worker specification, `importScripts()` should only be called during the synchronous execution of the top-level service worker script or asynchronously within the `install` handler.

Prior to Chrome 71, asynchronous calls to `importScripts()` outside the `install` handler would function. Starting with Chrome 71, these calls will throw a runtime exception (unless the same URL was previously imported in an `install` handler), matching the behavior of other browsers.

### Recommended Practice

Move `importScripts()` calls to the top-level scope or import the same URL within the `install` handler.

```javascript
// Move the importScripts() to the top-level scope.
// (Alternatively, import the same URL in the install handler.)
importScripts('my-fetch-logic.js');
self.addEventListener('fetch', event => {
  event.respondWith(self.customFetchLogic(event));
});
```

**Note:** Users of the Workbox library should consult [this guidance](https://web.dev/migrate-to-workbox-v6/#avoid-async-imports) to avoid potential issues with asynchronous `importScripts()` calls.

## Deprecating repeated URLs passed to `cache.addAll()`

When the same URL is passed multiple times to a single call of `cache.addAll()`, the specification dictates that the returned promise should reject. This change aligns Chrome's Cache Storage API implementation with the relevant specification.

Prior to Chrome 71, duplicate URLs were ignored, and no warning was issued. Starting in Chrome 71, a warning message will be logged to the console. In Chrome 72, duplicate URLs will cause `cache.addAll()` to reject, which could lead to service worker installation failures if it's part of an `InstallEvent.waitUntil()` promise chain.

### Example of potential issue:

```javascript
const urlsToCache = [
  '/index.html',
  '/main.css',
  '/app.js',
  '/index.html', // Duplicate URL - should be removed.
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('my-cache').then(cache => cache.addAll(urlsToCache))
  );
});
```

### Solution

Remove duplicate URLs from the array passed to `cache.addAll()`.

**Note:** This restriction applies only to the actual URLs being passed. Caching equivalent responses with different URLs (e.g., `'/'` and `'/index.html'`) will not trigger a rejection.

## Test your service worker implementation widely

Service workers are widely implemented across major browsers. Regularly testing your progressive web app across different browsers will help you identify and address inconsistencies before they cause issues for your users. By staying aligned with specifications, you ensure a more consistent and reliable experience for all users.