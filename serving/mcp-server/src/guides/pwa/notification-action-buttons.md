---
description: Allow users to interact with notifications without opening the app by adding action buttons.
filename: notification-action-buttons
category: pwa
---

# Notification Actions

Reference docs:
- [Web Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Notifications specification](https://notifications.spec.whatwg.org/#using-actions)

## Best Practices

To add contextual actions to notifications, create an array of action objects and include them in the `NotificationOptions` when calling `showNotification` from a ServiceWorker.

Currently, Chrome supports a maximum of two actions per notification. You can check the platform's support for actions using `Notification.maxActions`.

```javascript
self.registration.showNotification('New message from Alice', {
  actions: [
    {action: 'like', title: 'Like'},
    {action: 'reply', title: 'Reply'}
  ]
});
```

You can use Emoji and extended Unicode characters to add context to action buttons, as direct icon support is not yet available.

```javascript
self.registration.showNotification("New message from Alice", {
  actions: [
    {action: 'like', title: '👍Like'},
    {action: 'reply', title: '⤻ Reply'}
  ]
});
```

User interactions with notifications, including taps on action buttons, are handled by the `notificationclick` event in your service worker. The `event.action` property will tell you which action was taken.

```javascript
self.addEventListener('notificationclick', function(event) {
  var messageId = event.notification.data;

  event.notification.close();

  if (event.action === 'like') {
    silentlyLikeItem();
  }
  else if (event.action === 'reply') {
    clients.openWindow("/messages?reply=" + messageId);
  }
  else {
    // Default action if no specific action is matched or user clicks outside action buttons
    clients.openWindow("/messages?reply=" + messageId);
  }
}, false);
```

## Fallback strategies

Since platform support for notification actions can vary, always provide a sensible fallback action for users who might not see or be able to interact with the action buttons. This fallback should be what you'd expect the user to do if they simply clicked the notification.

Actions can be used for background tasks (like "Like" or "Delete") or for actions requiring user input (like "Reply," which would open a new window).

## Further Information

- Explore [Peter Beverloo's Notification Test Harness](https://tests.peter.sh/notification-generator/#actions=3) to see actions in action.
- Read up on the [Notifications specification](https://notifications.spec.whatwg.org/#using-actions) or [follow along with spec as it updates](https://github.com/whatwg/notifications).
- Check out the full documentation for best practices on using [Web Push Notifications](https://web.dev/notifications).