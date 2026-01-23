---
description: Implement efficient offline experiences for web applications by leveraging Workbox caching strategies.
filename: workbox-caching-strategies
category: pwa
---

# Workbox Caching Strategies

Reference docs:
- https://web.dev/articles/offline-cookbook
- https://developer.chrome.com/docs/workbox/reference/workbox-strategies

## Best Practices

Workbox provides a set of caching strategies to handle how your service worker responds to fetch events, enabling robust offline capabilities for your web application.

### Stale-While-Revalidate

This strategy responds to requests as quickly as possible with a cached response if available, falling back to a network request if not cached. The network request is then used to update the cache. This is ideal for content where having the absolute latest version is not critical.

```js
import {registerRoute} from 'workbox-routing';
import {StaleWhileRevalidate} from 'workbox-strategies';

registerRoute(
  ({url}) => url.pathname.startsWith('/images/avatars/'),
  new StaleWhileRevalidate()
);
```

### Cache First (Cache Falling Back to Network)

This strategy is best for assets that are non-critical and can be gradually cached. If a response is in the cache, it's served directly. Otherwise, it fetches from the network, caches the response, and serves it.

```js
import {registerRoute} from 'workbox-routing';
import {CacheFirst} from 'workbox-strategies';

registerRoute(({request}) => request.destination === 'style', new CacheFirst());
```

### Network First (Network Falling Back to Cache)

This strategy is ideal for requests that update frequently. It first tries to fetch the latest response from the network. If successful, it caches the response. If the network request fails, it falls back to the cached response.

```js
import {registerRoute} from 'workbox-routing';
import {NetworkFirst} from 'workbox-strategies';

registerRoute(
  ({url}) => url.pathname.startsWith('/social-timeline/'),
  new NetworkFirst()
);
```

### Network Only

Use this strategy when specific requests must be fulfilled directly from the network, bypassing the cache entirely.

```js
import {registerRoute} from 'workbox-routing';
import {NetworkOnly} from 'workbox-strategies';

registerRoute(({url}) => url.pathname.startsWith('/admin/'), new NetworkOnly());
```

### Cache Only

This strategy ensures that responses are obtained exclusively from the cache. It's useful when you have a custom precaching mechanism and want to guarantee cache usage.

```js
import {registerRoute} from 'workbox-routing';
import {CacheOnly} from 'workbox-strategies';

registerRoute(({url}) => url.pathname.startsWith('/app/v2/'), new CacheOnly());
```

## Configuring Strategies

You can customize strategies by specifying the cache name, setting cache expiration rules, and integrating plugins.

### Changing the Cache Used by a Strategy

Separate assets into different caches for better organization and debugging by providing a `cacheName`.

```js
import {registerRoute} from 'workbox-routing';
import {CacheFirst} from 'workbox-strategies';

registerRoute(
  ({request}) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
  })
);
```

### Using Plugins

Workbox plugins extend strategy functionality. Common plugins include `workbox-expiration` for managing cache entries and `workbox-cacheable-response` for controlling which responses are cached.

```js
import {registerRoute} from 'workbox-routing';
import {CacheFirst} from 'workbox-strategies';
import {ExpirationPlugin} from 'workbox-expiration';

registerRoute(
  ({request}) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 7 * 24 * 60 * 60, // Cache for one week
        maxEntries: 10, // Limit to 10 entries
      }),
    ],
  })
);
```

## Custom Strategies

For advanced use cases, you can create custom strategies by extending the `Strategy` base class from `workbox-strategies`. This allows for fine-grained control over request handling logic.

```js
import {Strategy} from 'workbox-strategies';

class CustomStrategy extends Strategy {
  _handle(request, handler) {
    // Define custom handling logic using handler methods like fetch, cacheMatch, etc.
    return handler.fetch(request);
  }
}
```

The `StrategyHandler` instance provides methods such as `fetch()`, `cacheMatch()`, and `cachePut()` to interact with network and cache resources, while also invoking relevant plugin lifecycle methods.

## Advanced Usage

You can directly use strategy classes within your `fetch` event listener for custom routing logic without relying on `workbox-routing`.

```js
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);

  if (url.origin === location.origin && url.pathname === '/') {
    event.respondWith(new StaleWhileRevalidate().handle({event, request}));
  }
});