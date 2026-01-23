---
description: Providing timely and relevant updates to users even when the web application is not actively running by leveraging push notifications.
filename: push-notifications-for-background-updates
category: pwa
---

# Push Notifications for Background Updates

This document outlines best practices for implementing push notifications to deliver timely updates to users, even when the browser or web application is not actively open.

## Core Concepts

Push notifications enable web applications to send alerts and information to users outside of the typical browsing session. This is achieved through service workers, which can receive and process push messages independently of the main browser window.

## Best Practices

### Ensuring Delivery When the Browser is Closed

*   **Android:** The Android OS is designed to wake up the appropriate application when a push message is received, regardless of whether the app is closed. This applies to browsers on Android as well, ensuring the browser can be woken up to dispatch the push event to your service worker.
*   **Desktop (macOS/Windows):** Push notifications can be received when the browser is running in the background, even if no windows are open. A push message will only fail to be received if the browser is completely closed.

### Launching Web Apps from Notifications

*   **Chrome on Android:** To maintain a consistent user experience, web apps added to the home screen can be launched in fullscreen mode from a notification. This behavior is based on a heuristic: sites launched from the home screen within the last ten days are more likely to open in standalone mode. Developers should be aware that this behavior might be unreliable and is specific to Chrome.

### Comparing Push Notifications to Web Sockets

*   **Service Worker Longevity:** A key advantage of push notifications is that service workers can be activated even when the browser window is closed. Web sockets, on the other hand, only remain active as long as the browser and the web page are open.

### Understanding the Evolution of Web Push (GCM, FCM, Web Push, and Chrome)

*   **Early Implementations (December 2014):** Chrome initially used Google Cloud Messaging (GCM) for push notifications. This was not considered "true" web push due to requirements like setting up Google Developer Console accounts, sharing sender IDs, and using a non-standard API.
*   **Modern Implementation (July 2016 onwards):** The introduction of Application Server Keys (VAPID) marked a shift towards the standardized Web Push Protocol. Chrome then adopted Firebase Cloud Messaging (FCM) as its messaging service. This new approach:
    *   Eliminates the need for specific Google or Firebase project setup.
    *   Supports the Web Push Protocol, allowing for a single API request regardless of the push service used by the browser.
*   **Current Understanding:** When encountering content referencing GCM or FCM, treat it as potentially outdated or Chrome-centric. Focus on the concept of web push as a standardized protocol involving a browser and a push service that accepts Web Push Protocol requests.

### Utilizing Firebase Messaging SDK

*   **Abstraction Layer:** The Firebase Cloud Messaging (FCM) JavaScript SDK offers a convenient layer over web push. It simplifies implementation by:
    *   Using FCM Tokens instead of `PushSubscription` objects.
    *   Allowing proprietary FCM API calls for sending messages without encryption.
    *   Supporting FCM-specific features like Topics.
    *   Providing cross-platform support (Android, iOS, web).
*   **Purpose:** The FCM Messaging SDK aims to abstract the complexities of web push, making it easier to integrate push notification functionality into existing Firebase projects.

## Further Reading

*   [Web Push Notification Overview](/articles/push-notifications-overview)
*   [How Push Works](/articles/push-notifications-how-push-works)
*   [Subscribing a User](/articles/push-notifications-subscribing-a-user)
*   [Permission UX](/articles/push-notifications-permissions-ux)
*   [Sending Messages with Web Push Libraries](/articles/sending-messages-with-web-push-libraries)
*   [Web Push Protocol](/articles/push-notifications-web-push-protocol)
*   [Handling Push Events](/articles/push-notifications-handling-messages)
*   [Displaying a Notification](/articles/push-notifications-display-a-notification)
*   [Notification Behavior](/articles/push-notifications-notification-behaviour)
*   [Common Notification Patterns](/articles/push-notifications-common-notification-patterns)
*   [Common Issues and Reporting Bugs](/articles/push-notifications-common-issues-and-reporting-bugs)

### Code Labs

*   [Build a push notification client](/articles/push-notifications-client-codelab)
*   [Build a push notification server](/articles/push-notifications-server-codelab)