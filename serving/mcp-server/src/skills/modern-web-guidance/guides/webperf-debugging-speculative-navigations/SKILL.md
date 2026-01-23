---
description: Make web browsing faster by prefetching and prerendering pages using the Speculation Rules API and learn how to debug these speculative loads in Chrome DevTools.
filename: debugging-speculative-navigations
category: webperf
---

# Debugging Speculative Navigations

Reference docs:
- https://developer.chrome.com/docs/web-platform/prerender-pages
- https://developer.chrome.com/docs/devtools/application/debugging-speculation-rules
- https://developer.chrome.com/docs/devtools/javascript/background-services#speculative-loads

## Best Practices

The [Speculation Rules API](/docs/web-platform/prerender-pages) enables near-instant page loads by allowing websites to prefetch and prerender pages based on user navigation predictions.

**Key Point:** When implementing speculative loads, it's crucial to balance the computational effort for user benefit against potentially wasteful, unused work.

### Inspecting Speculations in DevTools

Use Chrome DevTools to inspect the status and behavior of speculative loads:

1.  Navigate to **Application** > **Background services** > **Speculative loads**.
2.  Here you can inspect speculations, their associated rules, and their current statuses.
3.  Use the drop-down menu in the action bar at the top to switch between different renders.
4.  Inspect the prerendered content using all available DevTools panels.
5.  Utilize the live trace feature to monitor the prerender status in real-time.

### Triggering Speculative Loads

Chrome 121 and later versions can intelligently pick up links from the document to trigger speculative loads. To maximize the potential of speculative loads:

-   **Prerender on Hover:** Configure rules to prerender pages when a user hovers over a link, providing a small head start before a potential click.
-   **Prerender on Mouse Down:** Similar to hover, using the `mousedown` event can also initiate prerendering before the navigation fully commits.

Watch the video and explore the [demo](https://chrome.dev/speculative-loading/) to understand how to implement and debug document rules that leverage these events for a smoother user experience.

For more in-depth information, refer to the following resources:

-   [Prerender pages in Chrome for instant page navigations](/docs/web-platform/prerender-pages)
-   [Debugging speculation rules](/docs/devtools/application/debugging-speculation-rules)
-   [Debug background services > Speculative loads](/docs/devtools/javascript/background-services#speculative-loads)