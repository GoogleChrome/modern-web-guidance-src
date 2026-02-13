---
description: Load a fallback image when network conditions are poor using the Adaptive Loading API
web-feature-ids:
  - adaptive-loading
---

# Adaptive Loading

The `loading-placeholder` attribute is a non-standard mechanism for `<img>` and `<source>` elements that enables declarative Adaptive Loading based on a user's network conditions. It accepts a valid URL string pointing to a lightweight alternative resource. When the user agent determines that the current Effective Connection Type (ECT) is constrained (typically '3g' or slower), it may prioritize fetching the resource specified in `loading-placeholder` instead of the primary resource defined by the `src` or `srcset` attributes. This allows developers to automatically serve lower-fidelity images to users on slow networks, improving load times and reducing data usage without requiring imperative JavaScript execution.

## Best Practices

Example 1: Basic usage on an image.

```html
<img src='high-res.jpg' loading-placeholder='low-res.jpg' alt='Hero image'>
```

Example 2: Using it with a picture element for art direction.

```html
<picture>
  <source media='(min-width: 800px)' srcset='large.jpg' loading-placeholder='large-blur.jpg'>
  <img src='small.jpg' loading-placeholder='small-blur.jpg' alt='Responsive image'>
</picture>
```

## Fallback strategies

If the user's Baseline target (or Widely available, if unavailable) does not support any of the required features, the following fallback strategies MUST be used.

### Adaptive Loading

Baseline status: Limited availability

- **DO** Use `'loadingPlaceholder' in HTMLImageElement.prototype` for feature detection
- **DO** Fall back to the http://example.github.io/adaptive-loading-polyfill/adaptive-loading.min.js polyfill in unsupported browsers
