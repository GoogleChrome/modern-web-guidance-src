---
description: Achieve near-instantaneous rendering for multipage applications by streaming partial HTML content from a service worker, combining cached common elements with dynamically fetched content.
filename: streaming-multipage-apps
category: webperf
---

# Streaming HTML Responses in a Service Worker

This guide outlines best practices for implementing streaming HTML responses in a service worker to enhance the performance of multipage applications. The core idea is to leverage a service worker to precache common page elements (like headers and footers) and then stream these alongside dynamically fetched content, resulting in significantly faster load times.

## Core Concepts

### Segmenting Page Structure

The fundamental step is to break down your web pages into logical parts:
- **Header:** Consistent across all pages (e.g., navigation, branding).
- **Content:** Unique to each page.
- **Footer:** Consistent across all pages (e.g., copyright, links).

This segmentation allows you to precache static parts and fetch only the dynamic content from the network.

### Service Worker Integration

- **Precache Partials:** Use `workbox-precaching` to cache your header and footer partials. This ensures they are available instantly from the cache.
- **Stream Responses:** Employ `workbox-streams` to compose responses by combining precached partials with network-fetched content.
- **Navigation Requests:** Intercept navigation requests using `workbox-routing` and handle them with your composed streaming strategy.

## Implementation Best Practices

### Segmenting Your Website

1.  **Create Partial Files:** Generate separate files for your header and footer markup.
2.  **Isolate Content:** Extract the main content of each page into its own file or configure your backend to serve only content based on specific request headers.
3.  **Valid HTML:** While individual partials don't need to be valid HTML on their own, the final combined response *must* be valid.

### Composing the Service Worker

1.  **Install Dependencies:** Ensure `workbox-streams` and other necessary Workbox modules (`workbox-navigation-preload`, `workbox-strategies`, `workbox-routing`, `workbox-precaching`) are installed.
2.  **Enable Navigation Preload:** Use `navigationPreload.enable()` for browsers that support it.
3.  **Precache Partials and Assets:** Use `precacheAndRoute` to precache your header, footer, and any fallback pages.
4.  **Define Content Strategy:** Create a `NetworkFirst` strategy for fetching content partials, including logic for caching and error handling (e.g., fallback to an offline page).
5.  **Compose Strategies:** Use `composeStrategies` from `workbox-streams` to chain the precached header, the network-fetched content, and the precached footer.
6.  **Register Route:** Register this composed handler for all navigation requests (`request.mode === 'navigate'`).

### Handling Backend Responses (If Applicable)

-   **Conditional Rendering:** Modify your backend to serve only the content partial when specific headers (like `Service-Worker-Navigation-Preload` or a custom `X-Content-Mode` header) are present.
-   **Header/Footer Logic:** Conditionally include header and footer markup based on these same headers.

## Considerations

### Updating Page Elements

-   **Dynamic Updates:** Elements like the `<title>` tag or navigation states that are part of the precached header may need to be updated dynamically on the client.
-   **Inline Scripts:** Embed small inline `<script>` elements within the content partial to update critical page data (e.g., page title, descriptions) using JSON data.

### Slow Networks

-   **Loading Indicators:** Implement a visual indicator (e.g., a CSS-based "Loading..." message) that appears while the content partial is being fetched.
-   **Connection Type Detection:** Use JavaScript to detect slow network connection types (e.g., `navigator.connection.effectiveType`) and conditionally display loading indicators.
-   **CSS Fallbacks:** Employ CSS selectors that target empty elements (like an empty `<article>`) to show loading states.

### Providing Fallback Responses

-   **Offline Support:** Precache an offline fallback page.
-   **Error Handling:** Implement `handlerDidError` in your content strategy to serve the precached offline fallback if a network request for content fails and no cached version exists.

### Caching and CDNs

-   **`Vary` Header:** If using intermediate caches (like CDNs) with `Cache-Control` headers, use the `Vary` header (e.g., `Vary: Service-Worker-Navigation-Preload, X-Content-Mode`) in your responses. This ensures that caches differentiate between full and partial responses for the same URL, preventing duplicated headers/footers.

## Outcome and Benefits

-   **Reduced TTFB:** The initial byte of the response is nearly instant due to precached elements.
-   **Faster FCP:** First Contentful Paint is significantly improved as the header, often including styled content, renders quickly.
-   **Improved LCP:** Largest Contentful Paint can also be faster, especially if the main content is part of the precached header.
-   **Enhanced User Experience:** Users perceive faster loading and a more "app-like" experience without sacrificing the resilience of the browser's default navigation.