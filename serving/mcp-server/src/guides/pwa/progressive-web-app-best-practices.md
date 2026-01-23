---
description: Build a performant and engaging user experience by implementing Progressive Web App (PWA) features like service workers and web app manifests.
filename: progressive-web-app-best-practices
category: pwa
---

# Progressive Web App Best Practices

Reference docs:
- https://developers.google.com/web/progressive-web-apps
- https://developers.google.com/web/fundamentals/primers/service-workers/
- https://developers.google.com/web/fundamentals/web-app-manifest/

## Best Practices

### Enhance Performance and Reliability

- **Implement Service Workers:** Use service workers to enable offline support, background synchronization, and improved caching strategies. This ensures a consistent and fast user experience, even on unreliable networks. Implement a cache-first strategy for core resources and frequently accessed content.
- **Utilize Web App Manifest:** Provide a `manifest.json` file to allow users to "install" your PWA to their home screen. This enhances discoverability and provides a native app-like experience. Configure icons, display modes, and launch URLs appropriately.
- **Optimize Critical Rendering Path:** Inline critical CSS to reduce render-blocking stylesheets and ensure faster first meaningful paint. Prioritize loading essential JavaScript and CSS bundles using techniques like HTTP/2 Server Push.

### Improve Loading Speed

- **Preload Key Requests:** Use `<link rel=preload>` to prioritize the loading of critical assets like fonts and scripts.
- **Avoid Multiple Round Trips:** Utilize `<link rel=preconnect>` to pre-resolve DNS and establish early connections to important third-party origins, reducing latency for external resources.
- **Dynamically Prefetch Next Page:** Implement `<link rel=prefetch>` to anticipate user navigation and pre-fetch subsequent pages, enabling near-instantaneous page transitions.
- **Optimize JavaScript Bundles:** Minimize JavaScript bundle sizes through techniques like route-based chunking and tree-shaking. Aim for smaller, modular bundles that are loaded on demand.
- **Optimize Third-Party JavaScript:** Minify and bundle third-party scripts where possible. Load them asynchronously to avoid blocking page rendering. Consider techniques like Intersection Observer API for progressive loading.
- **Leverage Compression:** Ensure all compressible resources are served with Gzip or Brotli compression.

### Ensure Cross-Browser Compatibility and Fallbacks

- **Progressive Enhancement:** Build core functionality with basic HTML, CSS, and JavaScript, then progressively enhance the user experience with PWA features and modern APIs.
- **Feature Detection:** Use feature detection for APIs like Service Workers and Web App Manifest to ensure graceful degradation on older browsers that may not support them.
- **Polyfills:** Conditionally load polyfills for unsupported features, ensuring a consistent experience across a wider range of browsers. Download local copies of polyfills or use package managers.

### Business Impact

- **Improve User Engagement:** Faster load times and offline capabilities lead to increased user satisfaction, reduced bounce rates, and higher engagement metrics.
- **Boost Conversions:** A smoother, more reliable user experience can directly translate to higher conversion rates, such as subscriptions or purchases.
- **Increase Organic Traffic:** Improved performance and user experience often lead to better search engine rankings and more organic traffic.