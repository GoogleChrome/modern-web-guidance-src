---
description: Prevent the Lighthouse notification audit from failing by requesting notification permissions at the right time.
filename: request-notification-permission-responsibly
category: ui
---

# Requesting Notification Permissions Responsibly

## Best Practices

When requesting notification permissions, avoid calling `Notification.requestPermission()` directly on page load. Instead, prompt users for permission after they have opted into receiving notifications for a specific purpose. This ensures notifications are timely, relevant, and precise, leading to a better user experience.

**DO NOT** call `Notification.requestPermission()` on page load.

**DO** offer users a clear value proposition for enabling notifications.

**DO** present the permission request after the user has explicitly opted in to a specific type of notification.

**DO** check the Lighthouse notification audit regularly to ensure your site complies with best practices.

## How the Lighthouse Notification Audit Fails

The Lighthouse notification audit flags pages that request notification permissions on page load. Lighthouse analyzes all JavaScript executed when the page loads. If `Notification.requestPermission()` is called and notification permission has not already been granted, the audit fails.

Lighthouse reports the URL and line number of each notification permission request.

<<../../../../_includes/partials/lighthouse-best-practices/scoring.md>>

## Resources

- [Source code for **Requests the notification permission on page load** audit](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/dobetterweb/notification-on-start.js)
- [Push notifications overview](https://web.dev/articles/push-notifications-overview)
- [Resetting notification permissions in Chrome](https://support.google.com/chrome/answer/6148059)