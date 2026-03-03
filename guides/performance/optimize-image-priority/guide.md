---
name: optimize-image-priority
description: Optimize the loading priority of Largest Contentful Paint (LCP) candidate images and deprioritize non-critical images to reduce critical resource load delays.
web-feature-ids:
    - fetch-priority
sources:
  - https://web.dev/articles/fetch-priority
  - https://web.dev/articles/top-cwv
  - https://web.dev/learn/images/performance-issues
---

# Optimize image priority

Images discovered late in the document or hidden behind CSS/JavaScript often experience significant loading delays. Using `fetchpriority` allows you to communicate the importance of an image to the browser early in the loading process.

## How to implement

1. **Identify the LCP image**: Determine which image is the most likely candidate for the Largest Contentful Paint (usually the hero image at the top of the page).
2. **Elevate LCP priority**: Add `fetchpriority="high"` to the `<img>` element for the LCP candidate.
3. **Deprioritize non-critical images**: For images that are off-screen or part of a secondary UI (like carousels or lower-page thumbnails), add `fetchpriority="low"`.
4. **Optimize lazy loading**: Never use `loading="lazy"` on the LCP image. For other images, `loading="lazy"` is usually sufficient; only add `fetchpriority="low"` if the image should stay low priority even after it enters the viewport (e.g., hidden carousel items).

## Example code

```html
<!-- Elevate priority for the LCP image -->
<img src="/images/hero-banner.webp"
     alt="Main Banner"
     fetchpriority="high"
     width="800" height="400">

<!-- Deprioritize initially hidden images, even if they are loaded lazily -->
<img src="/images/carousel-item-2.webp"
     alt="Other View"
     fetchpriority="low"
     width="400" height="300">

<!-- Deprioritize a secondary logo that is less critical than the main content -->
<img src="/images/logo.svg"
     alt="Other Logo"
     fetchpriority="low"
     width="100" height="50">
```

## Best practices

- **MANDATORY**: Always apply `fetchpriority="high"` to the LCP image.
- **DO NOT** combine `fetchpriority="high"` with `loading="lazy"` for the LCP image.
- **DO** use `fetchpriority="low"` for images that may be above the fold but are not critical to the user experience, such as images in a gallery that are initially hidden.
- **DO NOT** combine `fetchpriority="low"` with `loading="lazy"` for standard below-the-fold images. When the user scrolls near the image, the browser should load it with high priority.
- **DO NOT** use the deprecated `importance` attribute. It has been replaced by `fetchpriority` and is not supported by any browser.

## Fallback strategy

### Fetch Priority

The `fetchpriority` attribute is a progressive enhancement for the `<img>` element. If a browser does not support it, the attribute is ignored, and the browser uses its default priority heuristics.
