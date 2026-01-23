---
description: Leverage client hints to adapt website resource delivery based on device capabilities and network conditions for improved performance.
filename: client-hints-best-practices
category: webperf
---

# Client Hints: Best Practices

Client hints provide valuable information about a user's device and network, allowing developers to dynamically adjust resource delivery for optimal performance and user experience.

## Primary Use Cases

### Adaptive Image Delivery

Client hints enable sophisticated adaptive image delivery, surpassing the capabilities of basic `srcset` and `<picture>` elements, especially for complex scenarios.

1.  **Art Direction**: Use `Viewport-Width` to select different image crops or treatments based on the user's viewport size.
2.  **Resolution Matching**: Employ `Width` and `DPR` (Device Pixel Ratio) to serve images with an intrinsic size optimized for the layout and screen density.
3.  **Format Negotiation**: Combine client hints with the `Accept` header to deliver the most optimal image format (e.g., WebP, AVIF) supported by the browser.
4.  **Dynamic Image Generation**: Instead of pre-generating multiple image variants, utilize a server-side script (e.g., PHP) that accepts image filenames and client hint parameters to dynamically resize and format images on demand. This approach is more flexible and can lead to significant reductions in data transfer.

```html
<img
  src="/image/sizes:true/company-photo.jpg"
  sizes="(min-width: 560px) 251px, 88.43vw"
  alt="Company Photo"
/>
```

*   **Consideration**: When implementing dynamic image resizing via client hints, services like CDNs or specialized image optimization platforms (e.g., Cloudinary with `w_auto`) can automate this process, significantly reducing development effort and improving performance.
*   **Caveat**: Be aware of changes in browser support, such as cross-origin client hint restrictions, and refer to Feature Policy for future developments.

### Network Condition Adaptation

Adapt your site's behavior and resource loading based on the user's network quality.

1.  **Prioritize Critical Resources**: For users on slow networks (identified by `ECT`, `RTT`, `Downlink`, or `Save-Data`), prioritize loading essential content and defer or omit non-critical resources like large JavaScript bundles, web fonts, or less important images.
2.  **Progressive Enhancement**: Implement a fallback strategy for browsers that do not support client hints. Initialize variables with default, high-performance values (e.g., default `ECT` to `4g`) to ensure a consistent experience.
3.  **`Save-Data` Preference**: Explicitly check for the `Save-Data: on` header and apply aggressive data-saving measures, as this is a direct user request to reduce data consumption.
4.  **Network Quality Scoring**: Develop a system to calculate a network quality score (e.g., 0-1) based on `ECT`, `RTT`, and `Downlink` values to guide adaptive decisions.

```php
<?php
// Example of checking Save-Data
$saveData = isset($_SERVER["HTTP_SAVE_DATA"]) && $_SERVER["HTTP_SAVE_DATA"] === "on";

// Example of default ECT value for fallback
$ect = isset($_SERVER["HTTP_ECT"]) ? $_SERVER["HTTP_ECT"] : "4g";
?>
```

*   **Impact**: Adapting to network conditions can drastically reduce page load times, as demonstrated by significant improvements in WebPagetest waterfalls when non-critical resources are omitted on slow connections.

## Opting In and Implementation

### Server-Side Opt-In (`Accept-CH`)

You must explicitly request client hints by sending an `Accept-CH` header with subsequent resource requests.

```http
Accept-CH: Viewport-Width, Downlink, DPR
```

*   **HTTPS Required**: Client hints only function over HTTPS connections.
*   **Implementation**: Set the `Accept-CH` header using your server-side language (e.g., PHP's `header()` function) or via an HTML `<meta http-equiv>` tag.

```html
<meta http-equiv="Accept-CH" content="Viewport-Width, Downlink" />
```

### Client-Side Hints (JavaScript and Service Workers)

Client hints can also be accessed and utilized within service workers or directly in JavaScript.

*   **Service Workers**: Access hint values via `event.request.headers.get()`.

    ```javascript
    self.addEventListener('fetch', (event) => {
      let dpr = event.request.headers.get('DPR');
      // ... use client hint values
    });
    ```
*   **JavaScript Equivalents**: For network-related hints, JavaScript provides corresponding properties in the `navigator` object (e.g., `navigator.connection.effectiveType`, `navigator.deviceMemory`).

    ```javascript
    if ('connection' in navigator) {
      let effectiveType = navigator.connection.effectiveType;
      // ... use network information
    }
    ```
*   **Feature Detection**: Always perform feature detection using operators like `in` before accessing JavaScript equivalents or client hint headers to ensure compatibility.

## Caching Considerations

When responses are varied based on HTTP headers (like client hints), the `Vary` header is crucial for correct cache behavior.

*   **Use `Vary`**: Include request headers that influence the response in the `Vary` header.

    ```http
    Vary: DPR, Width, ECT
    ```
*   **Avoid Frequent Headers**: Be cautious about varying on frequently changing headers like `Cookie` or potentially volatile network hints (`RTT`, `Downlink`) as this can lead to cache misses. Prioritize varying on more stable hints like `ECT` when appropriate.
*   **Dynamic Content**: For highly dynamic content (e.g., HTML), caching may not be feasible, and you can modify responses based on any necessary headers without concerns about `Vary`.

## Available Client Hints

### Device Hints

*   **`Viewport-Width`**: Width of the user's viewport in CSS pixels.
*   **`DPR` (Device Pixel Ratio)**: Ratio of physical pixels to CSS pixels.
*   **`Width`**: Hints at the optimal intrinsic width for images requested with the `sizes` attribute.
*   **`Content-DPR`**: A response header indicating the DPR of the delivered resource, used in conjunction with `DPR` and `Width`.
*   **`Device-Memory`**: Approximate device memory in GiB (intentionally coarse to prevent fingerprinting).

### Network Hints

*   **`RTT` (Round Trip Time)**: Approximate RTT in milliseconds, including server processing time.
*   **`Downlink`**: Approximate downstream speed in Mbps.
*   **`ECT` (Effective Connection Type)**: An enumerated type (`4g`, `3g`, `2g`, `slow-2g`) representing the connection's performance profile.
*   **`Save-Data`**: User preference indicating a desire to send less data (cannot be opted into via `Accept-CH`).