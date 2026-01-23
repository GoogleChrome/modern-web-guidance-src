---
description: Optimize JavaScript delivery and parsing for faster page load and interactivity on various devices.
filename: optimize-javascript-delivery
category: webperf
---

# Optimize JavaScript Delivery and Parsing

This guide covers best practices for minimizing JavaScript's impact on your website's performance, focusing on network transmission and parsing/compiling costs.

## Minimize Network Transmission Cost

Sending less JavaScript over the wire directly translates to faster load times, especially on slower networks.

### Only Send Necessary Code

*   **Code-Splitting:** Break down your JavaScript into smaller chunks. Deliver only the code critical for the initial view and lazily load non-essential code. Module bundlers like Webpack support code-splitting out-of-the-box.
*   **Lazy Loading:** Defer loading of non-critical JavaScript until it's actually needed.

### Minification

*   Use tools like UglifyJS (for ES5) or babel-minify/uglify-es (for ES2015+) to reduce the file size of your JavaScript by removing unnecessary characters and whitespace.

### Compression

*   **Gzip:** Ensure your server is configured to compress text-based resources like JavaScript using Gzip.
*   **Brotli:** Consider Brotli compression, which often provides better compression ratios than Gzip, leading to smaller file sizes.

### Remove Unused Code

*   **DevTools Code Coverage:** Use browser developer tools to identify JavaScript code that is not being executed.
*   **Tree Shaking:** Utilize bundler features (like Webpack's tree shaking) to eliminate unused code from your final bundles.
*   **Modern Transpilation:** Use tools like `babel-preset-env` with `browserlist` to avoid transpiling features that are already supported by modern browsers.
*   **Library Optimization:** For libraries like Moment.js, consider specialized plugins (e.g., `lodash-babel-plugin`, Webpack's `ContextReplacementPlugin`) to reduce their impact.

### Caching

*   **HTTP Caching:** Configure appropriate HTTP cache headers (`max-age`, `ETag`) to allow browsers to cache JavaScript files and avoid re-downloading them on subsequent visits.
*   **Service Workers:** Implement Service Workers for robust network resilience and to enable advanced caching strategies, including V8's code cache.
*   **Filename Hashing:** Use filename hashing (e.g., with Webpack) to ensure that browsers fetch new versions of files only when they have actually changed.

## Reduce Parse/Compile Cost

Once downloaded, JavaScript needs to be parsed and compiled by the browser's JavaScript engine. This process can be a significant bottleneck, especially on less powerful devices.

### Understand Parse/Compile Time

*   **DevTools Performance Panel:** Use Chrome DevTools (specifically the "Scripting" time in the Performance panel, and the "Bottom-Up" and "Call Tree" tabs with V8 Runtime Call Stats enabled) to measure and analyze time spent parsing and compiling your JavaScript.
*   **Impact on Interactivity:** Long parse/compile times directly delay when a user can interact with your site.

### Optimize for Average Devices

*   **Test on Representative Hardware:** Don't just test on high-end devices. Test on hardware that represents your average user's capabilities (e.g., older smartphones with slower CPUs and limited cache).
*   **Consider CPU/GPU Constraints:** Recognize that users may have devices with slow CPUs, GPUs, and limited memory.

### Measure Real-World Impact

*   **Analyze HTTP Archive:** Examine data from sources like HTTP Archive to understand the current state of JavaScript on the web and identify common performance issues.
*   **Use Google Analytics:** Gain insights into the mobile device classes your users are employing to better understand their constraints.

## Minimize Execution Time

Executing JavaScript can also block the main thread, delaying interactivity.

### Small Chunks for Execution

*   **Avoid Long-Running Scripts:** Break down JavaScript execution into smaller, manageable chunks to prevent blocking the main thread for extended periods.
*   **Scheduling:** Utilize `requestAnimationFrame()` or `requestIdleCallback()` for scheduling non-critical tasks.

## Other Performance Costs

### Memory Management

*   **Avoid Memory Leaks:** Prevent memory leaks and minimize frequent garbage collection (GC) pauses, which can cause jank and unresponsiveness.
*   **GC Pauses:** Be aware that GC pauses temporarily halt JavaScript execution.

## Patterns for Reducing JavaScript Cost

### PRPL (Push, Render, Pre-cache, Lazy-load)

*   This pattern focuses on optimizing for interactivity through aggressive code-splitting and caching. It aims to deliver critical resources upfront and progressively load the rest.

### Progressive Bootstrapping

*   Instead of sending a large, fully-rendered initial page, send a minimally functional page for the current route. As more resources load, progressively enable more features and interactivity. This avoids the "uncanny valley" of a visually complete but non-interactive page.

## Conclusions

*   **Transmission Size Matters for Low-End Networks:** Minimize the amount of JavaScript sent over the wire.
*   **Parse Time is Crucial for CPU-Bound Devices:** Optimize your code to reduce the time spent parsing and compiling.
*   **Performance Budgets:** Adopt strict performance budgets to keep JavaScript transmission and parse/compile times in check. Regularly assess the JavaScript "headroom" your architectural decisions allow.
*   **Develop on Representative Hardware:** Always test your site's performance on devices that reflect your target audience's capabilities.