---
description: Ensure that the browser's preload scanner can efficiently discover and fetch critical resources to improve page load performance.
filename: optimize-preload-scanner-discovery
category: webperf
---

# Optimize Preload Scanner Discovery

The browser's preload scanner is a secondary parser that speculatively examines raw HTML markup to discover resources before the primary parser encounters them, especially when the primary parser is blocked by render-blocking resources like CSS. By understanding how the preload scanner works and avoiding patterns that hinder its operation, developers can significantly improve page load times and user experience.

## Best Practices

To help the preload scanner work effectively, follow these best practices:

-   **DO** ensure that critical resources like JavaScript, stylesheets, and images are present in the initial HTML markup provided by the server. This allows the preload scanner to discover them early.
-   **DO NOT** inject critical resources into the DOM using client-side JavaScript after the initial HTML load. This includes scripts, images, stylesheets, and other assets that would be better placed in the server's initial response.
-   **DO NOT** lazily load images or iframes that are "above the fold" (visible without scrolling) using JavaScript solutions. These resources should be directly available in the initial markup.
-   **DO NOT** render markup entirely on the client-side using JavaScript if it contains references to subresources. This makes those resources invisible to the preload scanner and delays their discovery. Server-side rendering (SSR) or static generation is preferred for such cases.
-   **DO** use `rel=preload` as a last resort if you cannot avoid patterns that negatively impact preload scanner discovery. This resource hint can help the browser discover critical assets sooner. However, use it judiciously, as prioritizing too many resources can lead to bandwidth contention.
-   **DO** be cautious with inlining resources into HTML, especially large assets or base64-encoded files. While it can avoid separate requests, it bloats the HTML, potentially delaying the preload scanner and reducing cache efficiency. Inline only very small resources if absolutely necessary.
-   **DO** consider using server-side rendering (SSR) or static generation for markup that requires JavaScript to attach functionality. This allows the preload scanner to discover resources while still enabling client-side interactivity through hydration.
-   **DO** test your implementation in lab tools (like WebPageTest) to verify that optimizations, including `rel=preload`, are having the desired effect on resource discovery and load times.
-   **DO** understand that the preload scanner only scans HTML markup. It does not examine the content of other resources, such as CSS files, which may contain references to important assets like background images. For CSS-defined background images, especially LCP candidates, consider using `<link rel="preload" as="image">`.

## Fallback Strategies

If you encounter scenarios where you absolutely must use a pattern that might hinder the preload scanner, the `rel=preload` hint is your primary fallback.

-   **DO** use `rel=preload` to give the browser a hint about critical resources that might otherwise be discovered late.
    ```html
    <link rel="preload" as="image" href="/path/to/critical-image.jpg">
    ```
-   **DO** be aware of the `imagesrcset` attribute if your preloaded image needs to vary based on viewport size.
-   **DO** carefully test the impact of `rel=preload` on resource priorities and overall performance, ensuring it doesn't create new bottlenecks. Avoid preloading everything, as this negates the prioritization benefits.