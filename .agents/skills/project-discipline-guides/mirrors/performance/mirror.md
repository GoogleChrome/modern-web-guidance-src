This unified "Lowest Common Denominator (LCD) Mirror" represents the intersection of web performance practices explicitly documented in the Gemini, Claude, and Codex mirrors.

# Web Performance: Lowest Common Denominator (LCD) Mirror

## 1. Resource Loading & Prioritization

### Resource Hints
*   **`preconnect`**: Establishes early connections (DNS, TCP, TLS) to critical third-party origins.
*   **`dns-prefetch`**: Resolves DNS early for origins that will be required soon.
*   **`preload`**: Forces high-priority fetch for critical resources needed for the current page.
*   **`prefetch`**: Low-priority fetch for resources likely needed for the next navigation.
*   **Speculation Rules API**: JSON-based configuration for prefetching or prerendering pages based on user intent.

### Script Execution Patterns
*   **`defer`**: Downloads scripts in parallel and executes them in order after HTML parsing.
*   **`async`**: Downloads scripts in parallel and executes them as soon as they are ready, potentially interrupting parsing.
*   **ES Modules (`type="module"`)**: Scripts are deferred by default and enable better tree-shaking.
*   **Dynamic `import()`**: Enables code-splitting and on-demand loading of JavaScript modules.

### Priority Hints
*   **`fetchpriority`**: Attribute (`high`, `low`, `auto`) to signal the relative importance of resources (images, scripts, fetches) to the browser.

---

## 2. Rendering & CSS Performance

### The Pixel Pipeline & Layout
*   **Avoid Layout Thrashing**: Batch DOM reads (e.g., `offsetWidth`) and writes (e.g., `style.width`) to prevent forced synchronous layouts.
*   **Compositor-Only Properties**: Use `transform` and `opacity` for animations to bypass Layout and Paint stages and utilize the GPU.

### Modern CSS Features
*   **`content-visibility: auto`**: Skips rendering work for off-screen elements until they approach the viewport.
*   **`contain`**: Informs the browser that an element’s subtree is independent, isolating layout and paint.
*   **`will-change`**: Hints to the browser which properties will change to allow for early optimization (to be used sparingly).
*   **`aspect-ratio`**: Sets a preferred aspect ratio to reserve space and prevent Layout Shift (CLS) before media loads.
*   **CSS Grid & Flexbox**: Preferred modern layout systems for performance and flexibility.

---

## 3. Execution & Task Scheduling

### Main Thread Management
*   **`requestAnimationFrame` (rAF)**: Synchronizes code execution with the display refresh rate for smooth visual updates.
*   **`requestIdleCallback` (rIC)**: Schedules low-priority background tasks during browser idle periods.
*   **`scheduler.yield()`**: Breaks up long tasks to keep the main thread responsive to user input and rendering.

### Off-Main-Thread Execution
*   **Web Workers**: Moves heavy computational or data-processing logic to background threads to avoid blocking the UI.

---

## 4. Measurement & Observation

### Metrics & Core Web Vitals
*   **LCP (Largest Contentful Paint)**: Measures loading performance of the largest visible element.
*   **CLS (Cumulative Layout Shift)**: Measures visual stability by tracking unexpected layout shifts.

### Browser Observation APIs
*   **`PerformanceObserver`**: Efficiently monitors and streams performance entries (LCP, CLS, resources).
*   **`Intersection Observer API`**: Detects when elements enter or exit the viewport (used for lazy-loading).
*   **User Timing API**: Uses `performance.mark()` and `performance.measure()` for custom application timing.
*   **Beacon API (`navigator.sendBeacon`)**: Sends small amounts of data to a server asynchronously on page unload.

---

## 5. Media & Network Optimization

### Image Optimization
*   **Native Lazy Loading**: `loading="lazy"` attribute for `<img>` and `<iframe>`.
*   **Modern Formats**: Use of WebP and AVIF for superior compression.
*   **Responsive Images**: Use of `srcset` and `sizes` to serve appropriately sized images.
*   **`decoding="async"`**: Allows image decoding to occur off the main thread.

### Transport & Data
*   **HTTP/2 & HTTP/3**: Leverages multiplexing and reduced latency for resource delivery.
*   **Compression**: Use of Brotli or Gzip for text-based assets.
*   **Streams API**: Processes data (like fetch responses) chunk-by-chunk to reduce memory overhead.

---

## 6. Logic & Memory Management

### Efficient Implementation
*   **Debouncing & Throttling**: Limits the execution rate of high-frequency event handlers (scroll, resize, input).
*   **Virtualization**: Renders only the visible subset of items in large lists to reduce DOM nodes.

### Resource Cleanup
*   **Event Listener Management**: Use of `removeEventListener` or `AbortController` (`signal`) to prevent memory leaks.
*   **Weak Collections**: Use of `WeakMap` and `WeakSet` to hold object references without preventing garbage collection.
