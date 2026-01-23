---
description: >-
  Build cross-device web applications by classifying devices into classes and
  serving tailored versions to maximize code reuse and performance.
filename: cross-device-webapp-best-practices
category: ui
---

# Cross-Device Webapp Best Practices

Reference docs:
- https://github.com/borismus/device.js
- https://www.html5rocks.com/mobile/responsivedesign
- https://developer.mozilla.org/en-US/docs/Web/API/History_API

## Best Practices

When building cross-device single-page UIs that don't fit neatly into responsive design, follow these practices:

1.  **Classify Devices**: Define a set of device classes (e.g., phone, tablet, desktop) and establish clear criteria for classifying devices into these classes. Consider factors like screen size, touch capability, and input methods.
2.  **MVC Architecture**: Employ an MVC-like framework (e.g., Backbone, Ember) to ensure a strong separation of concerns, particularly decoupling the UI (view layer) from the application logic (model layer). This allows for easy management of device-specific views.
3.  **Client-Side Detection**: Utilize `device.js` for client-side device class detection based on screen sizes and capabilities. This approach is more future-proof than User-Agent (UA) sniffing and requires no special server-side configuration.
4.  **Code Sharing**: Move device-specific code into separate files within a `versions/` directory, organized by device class. Serve the same core logic to all devices, but render custom views tailored to each device type.
5.  **Optimized Loading**: Package your JavaScript and CSS into single, minified files per device class for faster loading. Ensure your production HTML includes the necessary `link rel="alternate"` tags for search engines and the `device.js` script for redirection.
6.  **Manual Override**: Provide users with an option to manually override the detected device version, as device detection can sometimes be inaccurate. This can be achieved by providing a link to an alternative version (e.g., desktop) or by using URL parameters supported by `device.js`.
7.  **Performance Consideration**: If client-side redirection with `device.js` becomes a significant performance bottleneck, consider migrating to server-side UA-detection for full control over what version to serve and to improve initial load times.

```html
<!-- Example production HTML for a phone version -->
<!doctype html>
<head>
  <title>Mobile Web Rocks! (Phone Edition)</title>

  <!-- Indicate alternate versions -->
  <link rel="alternate" href="http://foo.com" id="desktop"
      media="only screen and (touch-enabled: 0)">
  <link rel="alternate" href="http://m.foo.com" id="phone"
      media="only screen and (max-device-width: 650px)">
  <link rel="alternate" href="http://tablet.foo.com" id="tablet"
      media="only screen and (min-device-width: 650px)">

  <!-- Viewport meta tag is crucial -->
  <meta name="viewport" content="width=device-width">

  <!-- Include device.js for client-side redirection -->
  <script src="device.js"></script>

  <link rel="style" href="phone.min.css">
</head>
<body>
  <script src="phone.min.js"></script>
</body>
```

## Fallback Strategies

While the primary approach focuses on serving tailored versions, consider these fallbacks and considerations:

### User Agent (UA) Sniffing (Server-Side)

-   **DO** use UA sniffing on the server as an alternative if client-side redirection performance is a significant issue.
-   **DO** be aware that UA sniffing requires constant updates as new devices emerge.
-   **DO** consider the overhead of large UA databases like WURFL or the licensing costs of DeviceAtlas.
-   **DO** leverage simpler, free alternatives like the Detect Mobile Browsers project, acknowledging their less comprehensive device distinction.

### Client-Side Feature Detection (JavaScript)

-   **DO** use JavaScript to detect device capabilities like touch support and screen size.
-   **DO** establish clear thresholds (e.g., `650px`) for distinguishing between device classes like "small touch" and "large touch".
-   **DO** account for both portrait and landscape orientations when determining screen dimensions.
-   **DO** understand the difference between CSS pixels and screen pixels, especially with high-density ("retina") displays.

### Client-Side Loading Strategies

-   **DO NOT** assume client-side detection means you can't control initial assets.
-   **Consider** redirecting to device-type-specific URLs (e.g., `/tablet`) using `window.location.href`. Use the History API to clean up URLs if necessary. Be mindful of redirect latency on mobile.
-   **Alternatively**, dynamically load device-type-specific assets (CSS, JS) using custom mechanisms. Be aware of potential browser limitations and the complexity of manipulating the DOM after initial load.

### Progressive Enhancement / Graceful Degradation

-   **DO** ensure your base application is accessible and functional on most devices, even if optimized versions exist.
-   **DO** consider accessibility features (keyboard navigation, screen readers) for devices that might not fall neatly into your defined classes.