---
description: Use background sync to reliably make network requests even when the user is offline.
filename: background-sync
category: pwa
---

# Background Sync

Reference docs:
- https://wicg.github.io/BackgroundSync/spec/
- https://developer.mozilla.org/en-US/docs/Web/API/BackgroundSync_API
- https://developer.mozilla.org/en-US/docs/Web_API/Using_IndexedDB

## Basic Usage

The easiest way to use Workbox Background Sync is to leverage the `BackgroundSyncPlugin`. This plugin automatically queues up failed requests and retries them when future `sync` events are fired. This is ideal for scenarios where requests might fail due to temporary network issues, ensuring data can still be sent to the server.

```js
import {BackgroundSyncPlugin} from 'workbox-background-sync';
import {registerRoute} from 'workbox-routing';
import {NetworkOnly} from 'workbox-strategies';

// Initialize the plugin with a unique queue name.
// maxRetentionTime specifies how long retries should be attempted (in minutes).
const bgSyncPlugin = new BackgroundSyncPlugin('myQueueName', {
  maxRetentionTime: 24 * 60, // Retry for max of 24 Hours
});

registerRoute(
  /\/api\/.*\/*.json/,
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);
```

The `BackgroundSyncPlugin` hooks into the `fetchDidFail` plugin callback. This callback is only invoked when an exception is thrown during a fetch, typically due to a network failure. Requests that result in `4xx` or `5xx` error statuses are not automatically retried by default.

If you need to retry requests with server errors (e.g., `5xx` status codes), you can add a `fetchDidSucceed` plugin to your strategy to throw an error for such responses, which will then trigger `fetchDidFail`.

```js
const statusPlugin = {
  fetchDidSucceed: ({response}) => {
    if (response.status >= 500) {
      // Throwing an error here will trigger fetchDidFail.
      throw new Error('Server error.');
    }
    // If it's not a 5xx error, use the response as is.
    return response;
  },
};

// Add statusPlugin to the plugins array in your strategy.
// For example: new NetworkOnly({ plugins: [bgSyncPlugin, statusPlugin] })
```

## Advanced Usage

For more granular control, Workbox Background Sync provides a `Queue` class. You can instantiate this class to manage failed requests manually. These requests are stored in IndexedDB and retried when the browser detects that connectivity has been restored (signaled by a `sync` event).

### Creating a Queue

Instantiate the `Queue` class with a unique name for your origin. This name is crucial as it's used for registering sync events and as the Object Store name in IndexedDB.

```js
import {Queue} from 'workbox-background-sync';

const queue = new Queue('myQueueName');
```

<aside class="note"><b>Note:</b>The queue name must be unique to your origin as it's used internally for `SyncManager` registration and IndexedDB storage.</aside>

### Adding a request to the Queue

After creating a `Queue` instance, you can use its `.pushRequest()` method to add failed requests. The following example demonstrates how to catch failed requests within a `fetch` event listener and add them to the queue.

```js
import {Queue} from 'workbox-background-sync';

const queue = new Queue('myQueueName');

self.addEventListener('fetch', event => {
  // Add criteria here to determine if a request should use background sync.
  if (event.request.method !== 'POST') {
    return;
  }

  const bgSyncLogic = async () => {
    try {
      // Attempt to fetch the request.
      const response = await fetch(event.request.clone());
      return response;
    } catch (error) {
      // If the fetch fails, queue the request for later retry.
      await queue.pushRequest({request: event.request});
      return error; // Return the error so the app can handle it if needed.
    }
  };

  event.respondWith(bgSyncLogic());
});
```

Requests added to the queue are automatically retried when the service worker receives a `sync` event. Browsers that do not support the BackgroundSync API will attempt to retry queued requests every time the service worker starts up.

## Testing Workbox Background Sync

Testing Background Sync can be challenging. The recommended approach involves simulating offline conditions and manually triggering sync events:

1.  **Register Service Worker:** Load a page and ensure your service worker is registered.
2.  **Simulate Offline:** Disable your computer's network connection or stop your web server. **Crucially, do not use the "Offline" checkbox in Chrome DevTools**, as it only affects page requests, not Service Worker requests.
3.  **Trigger Failed Requests:** Make network requests that should be handled by Workbox Background Sync.
4.  **Verify Queue:** Check `Chrome DevTools > Application > IndexedDB > workbox-background-sync > requests` to confirm that the failed requests have been queued.
5.  **Restore Network:** Turn your network connection back on or restart your web server.
6.  **Force Sync Event:** Navigate to `Chrome DevTools > Application > Service Workers`. Enter the tag name in the format `workbox-background-sync:<your queue name>` (replace `<your queue name>` with the actual name you provided) and click the 'Sync' button.
7.  **Confirm Success:** Observe that the failed network requests are now successfully replayed. The IndexedDB data for requests should be empty if all retries were successful.