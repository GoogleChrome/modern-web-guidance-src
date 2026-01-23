---
description: Optimize website performance and reduce server load by leveraging content delivery networks (CDNs) to cache and serve content closer to users.
filename: content-delivery-networks
category: webperf
---

# Content Delivery Networks (CDNs)

## Best Practices

To maximize the performance benefits of a CDN, focus on caching content aggressively and enabling CDN-specific performance features.

### Caching Strategies

*   **Cache Public Resources:** Ensure that resources without `Cache-Control: no-store` or `Cache-Control: private` headers are cacheable by the CDN.
*   **Long TTL for Static Content:** Cache static assets like images, videos, and versioned libraries with a long Time To Live (TTL), such as 6 months or 1 year.
*   **Short TTL for Dynamic Content:** Cache dynamic content, like API responses or homepages, for short periods (e.g., 5 seconds) during high traffic to reduce origin server load.
*   **Leverage "Origin Pull":** This is the most common method where the CDN fetches resources from the origin as needed and caches them.
*   **Utilize Purging:** Use CDN purging (cache invalidation) for critical content updates to ensure users receive the latest information immediately.
*   **Implement Cache Tags/Surrogate Cache Keys:** For large-scale purging, associate tags with cached resources to enable granular invalidation (e.g., purging all resources with a "footer" tag when the footer is updated).

### Improving Cache Hit Ratio (CHR)

*   **Initial Audit:** Verify that all cacheable resources are being cached with appropriate HTTP Cache headers (`Cache-Control: max-age`, `Cache-Control: s-maxage`, `Expires`) and a maximum TTL.
*   **Ignore Unnecessary Query Parameters:** Configure your CDN to ignore query parameters that do not affect the content served (e.g., `referral_id`).
*   **Normalize Query Parameter Order:** Set up your CDN to sort query parameters to ensure that `example.com/page?a=1&b=2` and `example.com/page?b=2&a=1` are cached as the same resource.
*   **Prudent Use of `Vary` Header:** While `Vary` can be useful, be mindful that it can reduce CHR. If used, normalize request headers (e.g., `Accept-Language`) to avoid redundant caching.
*   **Avoid Unnecessary `Set-Cookie` Headers:** Minimize the use of `Set-Cookie` headers in responses, as they typically prevent caching.

### Performance Features

*   **Enable Compression:** Ensure all text-based responses are compressed using Brotli (preferred) or gzip. Leverage automatic Brotli compression offered by CDNs.
*   **Use TLS 1.3:** TLS 1.3 offers a faster handshake, reducing connection setup time.
*   **Enable HTTP/2 and HTTP/3:** These protocols provide significant performance benefits, including multiplexing, stream prioritization (HTTP/2), and elimination of head-of-line blocking (HTTP/3).
*   **Utilize Image Optimization:** Leverage CDN services for automatic image optimizations like EXIF data stripping, lossless compression, and format conversion (e.g., to WebP).
*   **Minification:** While ideally done at the origin, CDN minification of JavaScript, CSS, and HTML is a good fallback.

## Fallback Strategies

While not directly applicable to CDN configuration itself, understanding how CDNs interact with browser capabilities is important. Ensure your CDN configuration does not hinder features like HTTP/2 or HTTP/3 if browsers support them.

For specific CDN providers, consult their documentation for details on implementing these best practices.