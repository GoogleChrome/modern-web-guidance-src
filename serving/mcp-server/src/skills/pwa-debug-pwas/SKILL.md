---
description: Inspect, modify, and debug web app manifests, service workers, and service worker caches for Progressive Web Apps using the Chrome DevTools Application panel.
filename: debug-pwas
category: pwa
---

# Debugging Progressive Web Apps (PWAs)

The **Application** panel in Chrome DevTools provides a comprehensive suite of tools for inspecting, modifying, and debugging the core components of Progressive Web Apps (PWAs): web app manifests, service workers, and service worker caches.

## Best Practices

### Inspecting Web App Manifests

*   Use the **Manifest** tab to view and validate your web app manifest file.
*   The **Identity**, **Presentation**, and **Icons** sections provide user-friendly displays of manifest properties and allow for visual inspection of icons, including checking safe areas for maskable icons.
*   The **Protocol Handlers** section enables testing of URL protocol handler registrations.
*   The **Installability** section highlights any errors that prevent your PWA from being installable.
*   When inspecting icons, use the **Show only the minimum safe area for maskable icons** checkbox to ensure your icons display correctly across different platforms.

### Debugging Service Workers

*   The **Service Workers** tab is the central hub for managing and debugging your service workers.
*   Monitor service worker status, update on reload, bypass service workers for network requests, and trigger updates manually.
*   Emulate push notifications and background sync events to test their functionality.
*   Unregister service workers to test their removal and ensure clean state.
*   Pay attention to the **Status** line, which indicates the service worker's current state and update count.
*   Use the **start** and **stop** links to simulate service worker lifecycle events and uncover potential bugs related to global state.
*   The **Update Cycle** table provides detailed timestamps for service worker lifecycle events (install, wait, activate).
*   If errors occur, the **Service Workers** tab will display an **Error** icon, linking to the **Console** for detailed logs.
*   For a holistic view, click **See all registrations** to access `chrome://serviceworker-internals/?devtools`.

### Managing Service Worker Caches

*   The **Cache Storage** tab offers a read-only view of resources cached by your service worker using the Cache API.
*   Reload the page if DevTools doesn't immediately detect cache changes.
*   Be aware that "opaque" responses (from different origins without CORS) are padded significantly for quota calculations, potentially exceeding storage limits faster than expected.

### Clearing Storage

*   The **Clear Storage** tab is a convenient tool for unregistering service workers and clearing all associated caches and storage with a single click, simplifying the debugging process.

### Triggering Installation

*   To trigger the PWA installation flow on desktop:
    1.  Open the PWA's landing page in Chrome.
    2.  Click the **Install** icon in the address bar.
    3.  Follow the on-screen instructions.
*   Keep the **Console** drawer open during installation to see manifest issues and installation lifecycle information.
*   For mobile testing, use remote debugging and trigger installation via the three-dot menu's **Install app** option on the connected device.

## Related Guides

*   [Progressive Web Apps (PWAs)][1]
*   [How to provide your own in-app installation experience][4]
*   [Intro to Service Workers][7]
*   [Push Notifications: Timely, Relevant, and Precise][8]
*   [Inspect page resources][21]
*   [Inspect and manage local storage and caches][22]

[1]: https://web.dev/progressive-web-apps
[4]: https://web.dev/customize-install/
[7]: /docs/workbox/service-worker-overview/
[8]: https://web.dev/push-notifications-overview/
[21]: /docs/devtools/resources/
[22]: /docs/devtools/storage/localstorage/