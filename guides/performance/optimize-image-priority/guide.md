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

Browsers use heuristics to assign loading priorities to images, but these defaults may not always align with your page's Largest Contentful Paint (LCP). Using `fetchpriority` on an `<img>` element allows you to explicitly signal an image's importance to the browser, ensuring critical images load faster while non-essential ones don't compete for bandwidth.

## How to implement

1. **Identify the LCP image**: Determine which image is the most likely candidate for the Largest Contentful Paint (usually the hero image at the top of the page).
2. **Elevate LCP priority**: Add `fetchpriority="high"` to the `<img>` element for the LCP candidate.
3. **Deprioritize non-critical images**: For images that are part of a secondary UI or are only revealed after user interaction (like mega menus, modals, or off-screen carousel slides), add `fetchpriority="low"`.
4. **Optimize lazy loading**: Never use `loading="lazy"` on the LCP image. For standard below-the-fold images, `loading="lazy"` is sufficient to defer the request until the user scrolls near them. Reserve `fetchpriority="low"` for images that are technically "above the fold" but not initially visible (e.g., hidden carousel slides). This prevents the browser's eager fetching heuristics from automatically assigning them a high priority and stealing bandwidth from your LCP image.

## Example code

```html
<!-- Elevate priority for the LCP image -->
<img src="/images/hero-lcp.jpg"
     alt="Main Banner"
     fetchpriority="high"
     width="800" height="400">

<!-- Deprioritize initially hidden images, even if they are loaded lazily -->
<img src="/images/gallery-alt.jpg"
     alt="Gallery Image"
     fetchpriority="low"
     width="400" height="300">

<!-- Deprioritize an image that is only revealed following a user interaction (e.g., inside a dropdown menu or modal) -->
<img src="/images/mega-menu-promo.jpg"
     alt="Special Offer"
     fetchpriority="low"
     width="300" height="150">
```

## Best practices

- **MANDATORY**: Always apply `fetchpriority="high"` to the LCP image.
- **MANDATORY**: Only use `fetchpriority="high"` on at most 1-2 critical images to avoid network contention and diluting the priority boost.
- **DO NOT** combine `fetchpriority="high"` with `loading="lazy"` for the LCP image.
- **DO** use `fetchpriority="low"` for images that may be above the fold but are not critical to the user experience, such as images in a gallery that are initially hidden.
- **DO NOT** combine `fetchpriority="low"` with `loading="lazy"` for standard below-the-fold images. When the user scrolls near the image, the browser should load it with high priority.
- **DO NOT** use the deprecated `importance` attribute. It has been replaced by `fetchpriority` and is not supported by any browser.

## Fallback strategy

### Fetch Priority

The Fetch Priority API is not Baseline.

The `fetchpriority` attribute is a progressive enhancement for the `<img>` element. If a browser does not support it, the attribute is ignored, and the browser uses its default priority heuristics.
