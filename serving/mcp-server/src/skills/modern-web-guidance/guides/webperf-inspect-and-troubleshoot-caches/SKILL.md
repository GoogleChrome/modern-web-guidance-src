---
description: Inspect and troubleshoot web caches using Chrome DevTools to improve website performance.
filename: inspect-and-troubleshoot-caches
category: webperf
---

# Inspect and Troubleshoot Web Caches with DevTools

This document provides guidance on using Chrome DevTools to inspect, clear, and disable various web caches, helping developers optimize website loading speed and troubleshoot caching-related issues.

## Inspect and Clear Caches with the Network Panel

The **Network** panel in Chrome DevTools allows you to observe network requests and their associated caching behavior. You can inspect individual resource requests to see how they were served from the cache or from the network.

To clear the cache for specific resources or all resources, you can use the options within the **Network** panel or employ the "Empty Cache and Hard Reload" option.

## Influence Caching with `Cache-Control`

The `Cache-Control` HTTP header is a powerful directive that allows you to specify how resources should be cached. Understanding and correctly implementing `Cache-Control` is crucial for effective cache management. Key directives include:

*   `public`: Allows caching by any component.
*   `private`: Allows caching by the browser only.
*   `no-cache`: Forces revalidation with the origin server before using a cached copy.
*   `no-store`: Disables caching completely.
*   `max-age=<seconds>`: Specifies the maximum time a resource is considered fresh.
*   `s-maxage=<seconds>`: Similar to `max-age`, but applies to shared caches (e.g., CDNs).

Refer to the [HTTP Cache documentation](https://web.dev/articles/http-cache#flowchart) for a detailed flowchart on how caching works.

## Empty Cache and Hard Reload

When you need to ensure you're getting the latest version of a resource and bypass any cached copies, use the "Empty Cache and Hard Reload" option. This is accessible by:

1.  Opening Chrome DevTools.
2.  Going to the **Network** tab.
3.  Right-clicking on the refresh button in the browser toolbar (while DevTools is open) and selecting "Empty Cache and Hard Reload".

This action clears the browser's cache for the current site and then performs a full reload, fetching all resources from the server.

## Disable Cache

For development and testing purposes, you can temporarily disable the browser's cache. This ensures that every request fetches the resource from the origin server.

To disable the cache:

1.  Open Chrome DevTools.
2.  Go to the **Network** tab.
3.  Check the "Disable cache" checkbox.

**Note:** This setting only applies when DevTools is open.

## Service Workers and Caching

Service workers can intercept network requests and manage their own caches. This allows for advanced caching strategies, including offline support.

### Filter Resources Cached by Service Workers

In the **Network** tab, you can filter requests to see which ones are being served or handled by a service worker. Look for the "ServiceWorker" source in the initiator column.

### Inspect and Disable Service Worker Cache with the Application Panel

The **Application** panel provides detailed information about service workers, including their registered state and their associated caches.

To inspect and manage service worker caches:

1.  Open Chrome DevTools.
2.  Go to the **Application** tab.
3.  Under the "Service Workers" section, you can see registered service workers.
4.  Under the "Cache Storage" section, you can inspect the contents of caches managed by service workers.
5.  You can unregister service workers or clear their caches from this panel.

## Simulate Devices with Low Storage

To understand how caching might behave on devices with limited storage, you can use the device simulation tools in Chrome DevTools. This can help identify potential issues where aggressive caching might lead to storage exhaustion.

## Further Reading

*   [DevTools Tips: Debugging bfcache](/blog/devtools-tips-29)