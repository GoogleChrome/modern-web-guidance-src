---
name: webperf-lazy-load-images
description: Defer loading of off-screen images to minimize network contention and improve LCP.
---

# Lazy loading images

## Best practices

The standard way to lazy load images is the `loading="lazy"` HTML attribute:

For a full working example, see `examples/lazy-loading.html`.

### When TO Use It
- Images that are **below the fold** (off-screen initially).
- Non-critical decorative images.

### When NOT To Use It
- **The LCP candidate**: The largest image in the viewport (often the hero image) should NEVER be lazy-loaded. It delays the Largest Contentful Paint metric.

## Fallback strategies

If the user's Baseline target (or Widely available, if unavailable) does not support any of the required features, the following fallback strategies MUST be used.

### Loading Attribute

Baseline status: Widely available

- **DO** rely on standard browser behavior: if `loading="lazy"` is not supported, browsers will simply ignore it and fetch the resource immediately (equivalent to `loading="eager"`). This is a safe and acceptable graceful degradation.
- **DO NOT** use JavaScript libraries like `lazysizes` unless you specifically need to support very old browsers (e.g., IE) or require custom thresholds, as native lazy loading is highly optimized.
