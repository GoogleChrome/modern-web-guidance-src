---
description: Service workers enable web applications to work offline by caching resources and handling network requests.
filename: service-worker-offline-caching
category: pwa
---

# Service Workers for Offline Caching

This document outlines common patterns and best practices for using Service Workers to make web applications work offline by strategically caching resources and managing network requests.

## Core Concepts and Use Cases

Service workers act as a proxy between the browser and the network, intercepting fetch events and allowing developers to control how resources are fetched and cached. This is crucial for providing a reliable user experience, even with intermittent or no network connectivity.

### When to Store Resources

The decision of *when* to cache resources depends on their criticality and update frequency.

*   **On Install, as a Dependency:** Ideal for static assets (CSS, JS, images, fonts) that are essential for the core functionality of a specific version of your site. Caching these during the `install` event ensures they are available immediately and prevents installation failure if any are missing.

    ```js
    self.addEventListener('install', function (event) {
      event.waitUntil(
        caches.open('mysite-static-v3').then(function (cache) {
          return cache.addAll([
            '/css/whatever-v3.css',
            '/css/imgs/sprites-v6.png',
            '/css/fonts/whatever-v8.woff',
            '/js/all-min-v4.js',
          ]);
        }),
      );
    });
    ```

*   **On Install, Not as a Dependency:** Suitable for larger resources that aren't immediately required. These won't block the installation or cause it to fail if caching fails, but might not be available if the service worker is terminated before the download completes.

*   **On Activate:** Primarily for clean-up tasks like deleting old caches when a new service worker version activates. Avoid long-running operations here, as it can block page loads.

    ```js
    self.addEventListener('activate', function (event) {
      event.waitUntil(
        caches.keys().then(function (cacheNames) {
          return Promise.all(
            cacheNames
              .filter(function (cacheName) {
                // Logic to decide which caches to delete
              })
              .map(function (cacheName) {
                return caches.delete(cacheName);
              }),
          );
        }),
      );
    });
    ```

*   **On User Interaction:** Allows users to explicitly save content for offline access, such as saving an article or a specific media item. This is initiated from the page itself.

    ```js
    document.querySelector('.cache-article').addEventListener('click', function (event) {
      event.preventDefault();
      var id = this.dataset.articleId;
      caches.open('mysite-article-' + id).then(function (cache) {
        fetch('/get-article-urls?id=' + id)
          .then(function (response) {
            return response.json();
          })
          .then(function (urls) {
            cache.addAll(urls);
          });
      });
    });
    ```

*   **On Network Response:** Useful for frequently updating resources or non-essential content. When a request doesn't match the cache, fetch it from the network, serve it to the page, and simultaneously add it to the cache. Be mindful of storage limits.

    ```js
    self.addEventListener('fetch', function (event) {
      event.respondWith(
        caches.open('mysite-dynamic').then(function (cache) {
          return cache.match(event.request).then(function (response) {
            return (
              response ||
              fetch(event.request).then(function (response) {
                cache.put(event.request, response.clone());
                return response;
              })
            );
          });
        }),
      );
    });
    ```

*   **On Push Message:** When the service worker is woken up by a push notification, it can fetch and cache relevant content, ensuring it's available even if the user opens the notification later.

*   **On Background Sync:** Similar to push messages, this allows the service worker to synchronize data in the background, ideal for non-urgent updates like social timelines or news articles.

## Serving Suggestions (Request Handling Patterns)

The service worker intercepts `fetch` events and uses various strategies to serve responses.

*   **Cache Only:** Serves the response directly from the cache. If not found, it will appear as a network error.

    ```js
    self.addEventListener('fetch', function (event) {
      event.respondWith(caches.match(event.request));
    });
    ```

*   **Network Only:** Always fetches from the network, ignoring the cache. Useful for non-GET requests or resources with no offline equivalent.

    ```js
    self.addEventListener('fetch', function (event) {
      event.respondWith(fetch(event.request));
    });
    ```

*   **Cache, Falling Back to Network:** The primary pattern for "offline-first" applications. It attempts to serve from the cache and falls back to the network if the resource is not found.

    ```js
    self.addEventListener('fetch', function (event) {
      event.respondWith(
        caches.match(event.request).then(function (response) {
          return response || fetch(event.request);
        }),
      );
    });
    ```

*   **Cache and Network Race:** Fetches from both the cache and the network simultaneously and serves the response from whichever finishes first. Useful for performance-critical small assets on slow storage.

    ```js
    // Helper function for Promise.race like behavior
    function promiseAny(promises) {
      return new Promise((resolve, reject) => {
        promises = promises.map((p) => Promise.resolve(p));
        promises.forEach((p) => p.then(resolve));
        promises.reduce((a, b) => a.catch(() => b)).catch(() => reject(Error('All failed')));
      });
    }

    self.addEventListener('fetch', function (event) {
      event.respondWith(promiseAny([caches.match(event.request), fetch(event.request)]));
    });
    ```

*   **Network Falling Back to Cache:** Prioritizes the network but falls back to the cache if the network request fails. This provides the freshest data for online users while still offering offline access.

    ```js
    self.addEventListener('fetch', function (event) {
      event.respondWith(
        fetch(event.request).catch(function () {
          return caches.match(event.request);
        }),
      );
    });
    ```

*   **Cache Then Network:** Serves from the cache immediately to show content quickly, then updates the page when fresh data arrives from the network. This is excellent for frequently updating content where immediate display is prioritized over the absolute latest data.

    **Page Code:**
    ```js
    var networkDataReceived = false;
    startSpinner();
    var networkUpdate = fetch('/data.json').then(response => response.json()).then(data => {
      networkDataReceived = true;
      updatePage(data);
    });
    caches.match('/data.json').then(response => {
      if (!response) throw Error('No data');
      return response.json();
    }).then(data => {
      if (!networkDataReceived) {
        updatePage(data);
      }
    }).catch(() => {
      return networkUpdate;
    }).catch(showErrorMessage).then(stopSpinner);
    ```
    **Service Worker Code:**
    ```js
    self.addEventListener('fetch', function (event) {
      event.respondWith(
        caches.open('mysite-dynamic').then(function (cache) {
          return fetch(event.request).then(function (response) {
            cache.put(event.request, response.clone());
            return response;
          });
        }),
      );
    });
    ```

*   **Generic Fallback:** Provides a default response (e.g., an offline page or placeholder image) if both cache and network requests fail.

    ```js
    self.addEventListener('fetch', function (event) {
      event.respondWith(
        caches.match(event.request).then(function (response) {
          return response || fetch(event.request);
        }).catch(function () {
          return caches.match('/offline.html');
        }),
      );
    });
    ```

*   **Service Worker-Side Templating:** For dynamic content that shouldn't be cached directly, the service worker can fetch JSON data and a template, then render the HTML response.

    ```js
    importScripts('templating-engine.js');
    self.addEventListener('fetch', function (event) {
      var requestURL = new URL(event.request.url);
      event.respondWith(
        Promise.all([
          caches.match('/article-template.html').then(response => response.text()),
          caches.match(requestURL.path + '.json').then(response => response.json()),
        ]).then(function (responses) {
          var template = responses[0];
          var data = responses[1];
          return new Response(renderTemplate(template, data), {
            headers: { 'Content-Type': 'text/html' },
          });
        }),
      );
    });
    ```

## Cache Persistence

Browser storage, including caches, is subject to eviction under storage pressure. To mitigate this, use the `StorageManager` API to request persistent storage.

```js
// From a page:
navigator.storage.persist()
.then(function(persisted) {
  if (persisted) {
    console.log("Storage is persistent.");
  } else {
   console.log("Storage may be cleared.");
  }
});
```

## Putting It All Together

You can combine multiple patterns within a single service worker by inspecting the request URL and method to route requests appropriately.

```js
self.addEventListener('fetch', function (event) {
  var requestURL = new URL(event.request.url);

  if (requestURL.hostname == 'api.example.com') {
    event.respondWith(/* combination of patterns */);
    return;
  }
  if (requestURL.origin == location.origin) {
    if (/^\/article\//.test(requestURL.pathname)) {
      event.respondWith(/* other combination of patterns */);
      return;
    }
    // ... other routing logic
  }

  // Default pattern
  event.respondWith(
    caches.match(event.request).then(function (response) {
      return response || fetch(event.request);
    }),
  );
});
```

## Further Reading

*   [Service workers and the Cache Storage API][sw_primer]
*   [JavaScript Promises—an Introduction](/articles/promises)

[sw_primer]: /articles/service-workers-cache-storage