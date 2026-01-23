---
description: Enable proactive communication from service workers to web pages for timely updates and notifications.
filename: service-worker-broadcast-updates
category: pwa
---

# Proactively Broadcast Updates from Service Workers to Pages

This guide covers how to enable service workers to proactively communicate updates to web pages, allowing for dynamic user notifications and seamless feature enhancements.

## Production Cases

### Tinder

Tinder PWA utilizes `workbox-window` to detect service worker lifecycle events such as "installed" and "controlled". This allows them to display an "Update Available" banner to users when a new service worker is ready, prompting them to refresh and access the latest features.

<figure>
  <img src="image/a-screenshot-tinders-we-7235223308143.png" alt="A screenshot of Tinder's webapp 'Update Available' functionality." width="650" height="366">
  <figcaption class="wd-caption">In the Tinder PWA, the service worker tells the page that a new version is ready, and the page shows users a "Update Available" banner.</figcaption>
</figure>

### Squoosh

The Squoosh PWA leverages service worker messages to inform the page when all necessary assets for offline functionality have been cached. This triggers a "Ready to work offline" toast message, enhancing the user's awareness of the app's capabilities.

<figure>
  <img src="image/a-screenshot-squoosh-web-f8bcc1343566b.png" alt="A screenshot of Squoosh webapp 'Ready to work offline' functionality." width="550" height="380">
  <figcaption class="wd-caption">In the Squoosh PWA the service worker broadcasts an update to the page when cache is ready, and the page displays "Ready to work offline" toast.
</figcaption>
</figure>

## Using Workbox

### Listen to Service Worker Lifecycle Events

The `workbox-window` module provides a simple API to listen for key service worker lifecycle moments. It abstracts away lower-level browser APIs like `updatefound` and `statechange`, offering more user-friendly event listeners.

**DO** use `workbox-window` to detect events like `installed` and `activated` to inform users about service worker updates.

```javascript
const wb = new Workbox('/sw.js');

wb.addEventListener('installed', (event) => {
  if (event.isUpdate) {
    // Show "Update App" banner to the user
  }
});

wb.register();
```

### Inform the Page of Changes in Cache Data

The `workbox-broadcast-update` package offers a standardized method for notifying active clients when cached responses have been updated. This is particularly useful with strategies like `StaleWhileRevalidate`.

**DO** add `broadcastUpdate.BroadcastUpdatePlugin` to your strategy options in the service worker to broadcast cache updates.

```javascript
import {registerRoute} from 'workbox-routing';
import {StaleWhileRevalidate} from 'workbox-strategies';
import {BroadcastUpdatePlugin} from 'workbox-broadcast-update';

registerRoute(
  ({url}) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    plugins: [
      new BroadcastUpdatePlugin(),
    ],
  })
);
```

**DO** listen for `message` events in your web app to receive and process cache update notifications.

```javascript
navigator.serviceWorker.addEventListener('message', async (event) => {
  // Optional: ensure the message came from workbox-broadcast-update
  if (event.data.meta === 'workbox-broadcast-update') {
    const {cacheName, updatedUrl} = event.data.payload;

    // Process cacheName and updatedUrl.
    // For example, fetch updated content and update the DOM.
    const cache = await caches.open(cacheName);
    const updatedResponse = await cache.match(updatedUrl);
    const updatedText = await updatedResponse.text();
  }
});
```

## Using Browser APIs

If `workbox-window` and `workbox-broadcast-update` don't meet your specific needs, consider these browser APIs for implementing "broadcast updates":

### Broadcast Channel API

This API allows the service worker to create a `BroadcastChannel` and post messages to it. Any interested page can instantiate a `BroadcastChannel` with the same name and set up a message handler.

**DO** use `BroadcastChannel` for simple cross-context messaging. Be aware of browser support, as Safari currently lacks support.

```javascript
// Service Worker
const broadcast = new BroadcastChannel('sw-update-channel');

self.addEventListener('install', function (event) {
  broadcast.postMessage({type: 'CRITICAL_SW_UPDATE'});
});

// Page
const broadcast = new BroadcastChannel('sw-update-channel');

broadcast.onmessage = (event) => {
  if (event.data && event.data.type === 'CRITICAL_SW_UPDATE') {
    // Show "update to refresh" banner
  }
};
```

### Client API

The Client API provides a way to communicate with multiple clients (tabs/windows) from the service worker by iterating over `Client` objects.

**DO** use the Client API for broadcasting messages to multiple active tabs. Ensure compatibility by checking method support across browsers.

```javascript
// Service Worker
self.clients.matchAll(options).then(function (clients) {
  if (clients && clients.length) {
    clients[0].postMessage({type: 'MSG_ID'});
  }
});

// Page
navigator.serviceWorker.onmessage = (event) => {
     if (event.data && event.data.type === 'MSG_ID') {
         // Process response
   }
};
```

### Message Channel

`MessageChannel` requires an initial setup where a port is passed from the page to the service worker to establish a dedicated communication channel.

**DO** use `MessageChannel` for more complex, dedicated communication needs. While it involves more setup, it offers broad browser compatibility.

```javascript
// Page
const messageChannel = new MessageChannel();

navigator.serviceWorker.controller.postMessage({type: 'PORT_INITIALIZATION'}, [
  messageChannel.port2,
]);

messageChannel.port1.onmessage = (event) => {
  // Process message
};

// Service Worker
let communicationPort;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PORT_INITIALIZATION') {
    communicationPort = event.ports[0];
  }
});

communicationPort.postMessage({type: 'MSG_ID' });
```

## Next Steps

This guide focused on "broadcast updates" from service workers to pages. For other communication patterns between windows and service workers, explore:

- [Imperative Caching Guide](/articles/imperative-caching-guide): Learn how to call a service worker from a page to cache resources proactively.
- [Two-Way Communication Guide](/articles/two-way-communication-guide): Discover how to delegate tasks to a service worker and receive progress updates.