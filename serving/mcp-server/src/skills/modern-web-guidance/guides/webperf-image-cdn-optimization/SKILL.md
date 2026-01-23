---
description: Optimize images for faster loading and reduced data costs by using an image CDN.
filename: image-cdn-optimization
category: webperf
---

# Image CDNs

Reference docs:
- https://developer.chrome.com/blog/automating-resource-selection-with-client-hints
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Save-Data
- https://developer.chrome.com/docs/lighthouse/performance/uses-rel-preload
- https://web.dev/articles/optimize-images

## Best Practices

Image CDNs specialize in transforming, optimizing, and delivering images. They offer significant advantages over build-time optimization scripts, typically yielding 40-80% savings in image file size.

### Use a CDN's domain or a custom domain

Using your own domain makes it easier to switch image CDNs later without URL changes.

### Leverage automatic optimization

Image CDNs can automatically retrieve and optimize images. URLs often include parameters for size, format, and quality. For example, `https://my-site.example-cdn.com/https://flowers.com/daisy.jpg/quality=auto` retrieves and optimizes `https://flowers.com/daisy.jpg`.

### Understand URL components

Image URLs typically consist of:
- **Origin:** The domain of the CDN or your custom domain.
- **Image:** The original image location or uploaded asset.
- **Security key:** Prevents unauthorized image modifications.
- **Transformations:** Parameters for size, density, format, and compression.

### Utilize auto-transformations

Many CDNs support "auto" modes for transformations (e.g., format, quality) by using signals like Client Hints, `Save-Data`, User-Agent, and the Network Information API. This allows the CDN to select the optimal settings for each user.

### Choose the right CDN type

*   **Self-managed:** Good for teams comfortable with infrastructure (e.g., Thumbor, Imaginary).
*   **Third-party-managed:** Easier to get started, offered as a service (e.g., Cloudinary, Imgix).

## Effects on Largest Contentful Paint (LCP)

Images are crucial for LCP. Consider these points when using an image CDN:

*   **Proxy through primary origin:** If possible, use an image CDN that proxies through your main domain to avoid extra connection setup time.
*   **`fetchpriority="high"`:** Apply this attribute to the LCP image for earlier loading.
*   **`rel=preload`:** Use this hint for LCP images not immediately discoverable in HTML.
*   **`preconnect` and `dns-prefetch`:** If proxying isn't feasible and the image isn't known early, establish connections to the CDN early to reduce loading time.