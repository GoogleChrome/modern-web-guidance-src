---
description: Guide developers on how to implement push notifications to engage users with timely updates and information.
filename: push-notifications-guide
category: pwa
---

# Push Notifications

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/PushManager
- https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/pushManager
- https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission
- https://tools.ietf.org/html/draft-ietf-webpush-vapid

## Best Practices

This guide details the process of subscribing users to push notifications, which involves several key steps: feature detection, service worker registration, requesting user permission, and the subscription process itself.

### Feature Detection

Before implementing push notifications, it's crucial to check for browser support. This involves verifying the presence of `serviceWorker` on the `navigator` object and `PushManager` on the `window` object.

```js
if (!('serviceWorker' in navigator)) {
  // Service Worker isn't supported on this browser, disable or hide UI.
  return;
}

if (!('PushManager' in window)) {
  // Push isn't supported on this browser, disable or hide UI.
  return;
}
```

Always detect both features to ensure progressive enhancement.

### Register a Service Worker

After confirming support, register your service worker. This JavaScript file, running in a dedicated service worker environment, grants access to service worker APIs, including push messaging.

```js
function registerServiceWorker() {
  return navigator.serviceWorker
    .register('/service-worker.js')
    .then(function (registration) {
      console.log('Service worker successfully registered.');
      return registration;
    })
    .catch(function (err) {
      console.error('Unable to register service worker.', err);
    });
}
```

The `register()` function returns a `ServiceWorkerRegistration` object, which is used to access the `PushManager` API.

### Requesting Permission

Obtain user permission before sending push messages. The `Notification.requestPermission()` API handles this, supporting both callback and Promise-based versions for broader compatibility.

```js
function askPermission() {
  return new Promise(function (resolve, reject) {
    const permissionResult = Notification.requestPermission(function (result) {
      resolve(result);
    });

    if (permissionResult) {
      permissionResult.then(resolve, reject);
    }
  }).then(function (permissionResult) {
    if (permissionResult !== 'granted') {
      throw new Error("We weren't granted permission.");
    }
  });
}
```

Be mindful that users blocking notifications cannot be prompted again; they must manually change settings. This makes it essential to ask for permission at an appropriate time when the user understands the value.

### Subscribe User with PushManager

Once the service worker is registered and permission is granted, subscribe the user using `registration.pushManager.subscribe()`.

```js
function subscribeUserToPush() {
  return navigator.serviceWorker
    .register('/service-worker.js')
    .then(function (registration) {
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U', // Replace with your public VAPID key
        ),
      };

      return registration.pushManager.subscribe(subscribeOptions);
    })
    .then(function (pushSubscription) {
      console.log(
        'Received PushSubscription: ',
        JSON.stringify(pushSubscription),
      );
      return pushSubscription;
    });
}
```

Key options for `subscribe()`:
-   `userVisibleOnly: true`: **Required**. Indicates that push messages will result in user-visible notifications.
-   `applicationServerKey`: Your application's public VAPID key. This is crucial for identifying your application to the push service.

### Create Application Server Keys

Generate VAPID keys (public/private key pair) using `npm install -g web-push` and `web-push generate-vapid-keys`. Keep the private key secret and share the public key.

### Send Subscription to Your Server

After obtaining a `PushSubscription` object, send its details (endpoint, keys) to your server for storage. This allows your server to send push messages to the user later.

```js
function sendSubscriptionToBackEnd(subscription) {
  return fetch('/api/save-subscription/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription),
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Bad status code from server.');
      }
      return response.json();
    })
    .then(function (responseData) {
      if (!(responseData.data && responseData.data.success)) {
        throw new Error('Bad response from server.');
      }
    });
}
```

### Resubscribe Regularly to Prevent Expiration

While `PushSubscription.expirationTime` might be `null`, subscriptions can expire. A common pattern is to resubscribe the user upon receiving a notification to maintain the subscription.

```js
/* In the Service Worker. */
self.addEventListener('push', function(event) {
  console.log('Received a push message', event);
  const title = 'New Notification';
  const body = 'You have new updates!';
  const icon = '/images/icon.png';
  const tag = 'simple-push-demo-notification-tag';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      tag: tag
    })
  );

  event.waitUntil(resubscribeToPush());
});

function resubscribeToPush() {
  return self.registration.pushManager.getSubscription()
    .then(function(subscription) {
      if (subscription) {
        return subscription.unsubscribe();
      }
    })
    .then(function() {
      return self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('YOUR_PUBLIC_VAPID_KEY_HERE') // Replace with your public VAPID key
      });
    })
    .then(function(subscription) {
      console.log('Resubscribed to push notifications:', subscription);
      // Optionally, send new subscription details to your server
    })
    .catch(function(error) {
      console.error('Failed to resubscribe:', error);
    });
}
```
**Note**: Avoid circumventing browser mechanisms designed to protect users from unwanted notifications.

## Frequently Asked Questions

#### Can you change the push service a browser uses?
No, the browser selects the push service.

#### Do different push services use different APIs?
No, all push services adhere to the common [Web Push Protocol](https://tools.ietf.org/html/draft-ietf-webpush-protocol).

#### If you subscribe a user on their desktop, are they subscribed on their phone as well?
No, users must register and grant permission for push notifications on each browser and device.

## Next Steps

*   [Web Push Notification overview](/articles/push-notifications-overview)
*   [How push messaging works](/articles/push-notifications-how-push-works)
*   [Permission user experience](/articles/push-notifications-permissions-ux)
*   [Send messages with web push libraries](/articles/sending-messages-with-web-push-libraries)
*   [Handle push events](/articles/push-notifications-handling-messages)
*   [Display a notification](/articles/push-notifications-display-a-notification)