---
description: Enhance website navigation speed by using service workers to extend the cache lifetime of prefetched resources, ensuring faster load times and improved user experience.
filename: service-worker-prefetching
category: pwa
---

# Service Worker Prefetching for Faster Navigation

This guide explores how service workers can be used to complement traditional prefetching techniques, significantly speeding up website navigation.

## Best Practices

Traditional prefetching with `<link rel="prefetch">` is a good starting point, but its benefits are limited by the short cache lifetime of prefetched resources (often around 5 minutes in browsers like Chrome 85). Service workers offer a powerful way to overcome this limitation, extending resource availability and enabling offline access.

### 1. Precaching Static Pages and Subresources

**Precaching** involves a service worker saving files to its cache during installation. This is distinct from **prefetching**, where resources are fetched ahead of time for brief availability.

*   **Precaching Static Pages:** For pages generated at build time (e.g., `about.html`, `contact.html`) or those in entirely static sites, add these documents to the precache list in your service worker. This ensures they are immediately available from the cache on access.

    ```js
    workbox.precaching.precacheAndRoute([
      {url: '/about.html', revision: 'abcd1234'},
      // ... other entries ...
    ]);
    ```

*   **Precaching Page Subresources:** Pre-caching static assets (JavaScript, CSS, etc.) used by various site sections is a general best practice. In prefetching scenarios, this provides an extra boost. For instance, on an e-commerce site, prefetching product detail pages for the initial products on a listing page becomes even faster if their subresources are already precached.

    To implement this:
    *   Add a `<link rel="prefetch">` tag to the page:

        ```html
         <link rel="prefetch" href="/phones/smartphone-5x.html" as="document">
        ```
    *   Add the page's subresources to the precache list in the service worker:

        ```js
        workbox.precaching.precacheAndRoute([
          '/styles/product-page.ac29.css',
          // ... other entries ...
        ]);
        ```

### 2. Extend the Lifetime of Prefetch Resources

Service workers allow you to extend the availability of prefetched pages beyond the browser's default cache limits, making these resources accessible even offline.

Complement your `<link rel="prefetch">` tags with a Workbox runtime caching strategy.

*   Add a `<link rel="prefetch">` tag to the page:

    ```html
     <link rel="prefetch" href="/phones/smartphone-5x.html" as="document">
    ```
*   Implement a runtime caching strategy in the service worker for these requests, for example, using `StaleWhileRevalidate` with an extended `maxAgeSeconds`:

    ```js
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'document-cache',
      plugins: [
        new workbox.expiration.Plugin({
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    });
    ```
    The `stale-while-revalidate` strategy serves content from the cache immediately if available, and updates the cache in the background with the network response.

### 3. Delegate Prefetching to the Service Worker

While `<link rel="prefetch">` is generally efficient, there are scenarios where delegating prefetching entirely to the service worker is more advantageous. This is particularly true for client-side rendered pages where dynamic injection of multiple `<link rel="prefetch">` tags based on API responses might burden the main thread.

A "page to service worker communication strategy" using `worker.postMessage()` can effectively offload this task.

The Workbox Window package simplifies this communication.

*   **In the page:** Call the service worker with the desired action and URLs to prefetch.

    ```js
    const wb = new Workbox('/sw.js');
    wb.register();

    const prefetchResponse = await wb.messageSW({type: 'PREFETCH_URLS', urls: [...]});
    ```
*   **In the service worker:** Implement a message handler to initiate `fetch()` requests for each URL:

    ```js
    addEventListener('message', (event) => {
      if (event.data.type === 'PREFETCH_URLS') {
        // Fetch URLs and store them in the cache
      }
    });
    ```

## Caution

Adding a service worker can introduce a small amount of latency if not used effectively for navigation requests. Mitigate this overhead by enabling **navigation preload**. This allows the service worker to respond to a navigation request using a preloaded network response, ensuring speed.

## Production Cases

*   **MercadoLibre:** Dynamically injects `<link rel="prefetch">` tags in listing pages as users scroll, prefetching the next result page.
*   **Virgilio Sport:** Uses service workers to prefetch popular posts and the Network Information API to avoid prefetching on slow connections (2G). This resulted in a 78% improvement in navigation load times and a 45% increase in article impressions.

## Fallback Strategies

When a feature might not be supported by all browsers:

*   **Service Worker Support:**
    *   Check for `navigator.serviceWorker` in the `window` object.
    *   Consider polyfills for older browsers if necessary, although service worker support is widespread in modern browsers.
*   **Workbox Libraries:** Use Workbox modules (e.g., `workbox-precaching`, `workbox-strategies`, `workbox-window`) which abstract many complexities and provide robust caching solutions.