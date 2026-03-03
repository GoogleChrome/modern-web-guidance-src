---
name: optimize-preload-priority
description: Optimize the relative priority of preloaded content to reduce critical resource load delays.
web-feature-ids:
    - fetch-priority
    - link-rel-preload
sources:
  - https://web.dev/articles/fetch-priority
  - https://web.dev/learn/performance/resource-hints
  - https://web.dev/learn/performance/video-performance
---

# Optimize preload priority

Preloading resources with `<link rel="preload">` signals to the browser that a resource will be needed soon. However, browsers often assign a high default priority to preloads, which can cause them to compete with critical render-blocking resources like CSS. Using `fetchpriority` allows you to refine this relative priority.

## How to implement

1. **Identify preload candidates**: Find resources that are not discovered early by the browser (e.g., background images in CSS or fonts) but are essential for the page's appearance.
2. **Elevate critical preloads**: For the LCP image or essential fonts, use `<link rel="preload" fetchpriority="high">` to ensure they are prioritized above other preloads.
3. **Deprioritize non-critical preloads**: For resources that aren't critical for the initial render (e.g., a background video or secondary fonts), use `<link rel="preload" fetchpriority="low">`.
4. **Coordinate with resource types**: Note that different `as` types have different default priorities; use `fetchpriority` to override these defaults when necessary.

## Example code

```html
<!-- DO: Elevate priority for a critical LCP image that is hidden in CSS -->
<link rel="preload" href="/images/hero.webp" as="image" fetchpriority="high">

<!-- DO: Deprioritize a font that isn't required for the above-the-fold content -->
<link rel="preload" href="/fonts/secondary.woff2" as="font" type="font/woff2" fetchpriority="low" crossorigin>

<!-- DO: Deprioritize a background video to favor critical images and CSS -->
<link rel="preload" href="/videos/background.mp4" as="video" fetchpriority="low">
```

## Best Practices

- **MANDATORY**: Only use `fetchpriority="high"` on preloads that are directly responsible for the Largest Contentful Paint (LCP).
- **DO** use `fetchpriority="low"` for preloads that you want the browser to start early but not at the expense of CSS or critical JavaScript.
- **DO** specify the `as` attribute correctly, as it determines the default priority that `fetchpriority` will modify.
- **DO NOT** preload too many resources; this can lead to network congestion regardless of the priority assigned.
- **DO NOT** use the deprecated `importance` attribute. It has been replaced by `fetchpriority`.

## Fallbacks & Browser Support

{{ BASELINE_STATUS("fetch-priority") }}

The `fetchpriority` attribute on `<link rel="preload">` is a progressive enhancement. Browsers that do not support it will still preload the resource using their default priority for that resource type. To ensure compatibility, always provide correct `as` and `type` attributes.
