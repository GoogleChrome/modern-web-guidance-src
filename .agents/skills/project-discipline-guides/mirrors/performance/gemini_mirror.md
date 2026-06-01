This "Redundancy Mirror" outlines the foundational and modern performance best practices, syntax, and APIs inherent to my training. It covers critical areas from loading and execution to rendering and memory management.

---

# Performance Development: The Redundancy Mirror

## 1. Resource Loading & Prioritization

### Resource Hints
*   **`preconnect`**: Establishes early connections (DNS + TCP + TLS) to critical third-party origins.
*   **`dns-prefetch`**: Resolves DNS for origins that will be needed soon (lower overhead than preconnect).
*   **`preload`**: Forces high-priority fetch of resources needed for the current page (e.g., fonts, hero images, critical scripts). Use `as` and `type` attributes.
*   **`prefetch`**: Low-priority fetch for resources likely needed for the *next* navigation.
*   **Speculation Rules API**: Modern, JSON-based configuration for prefetching and prerendering entire pages based on user intent.

### JavaScript Loading Patterns
*   **`defer`**: Downloads script in parallel, executes after HTML parsing but before `DOMContentLoaded`. Maintains order.
*   **`async`**: Downloads in parallel, executes as soon as it's ready (interrupts parsing). No order guarantee.
*   **ES Modules (`type="module"`)**: Deferred by default. Enables tree-shaking and avoids global scope pollution.
*   **Dynamic `import()`**: Enables code-splitting and on-demand loading of modules.

### Fetch Priority API
*   **`fetchpriority`**: Attribute (`high`, `low`, `auto`) for `<img>`, `<link>`, `<script>`, and `fetch()` calls to signal relative importance to the browser's preload scanner.

---

## 2. Rendering Performance & CSS

### The Pixel Pipeline
*   **Avoid Layout Thrashing**: Prevent "Read-Write-Read" cycles. Batch DOM reads (e.g., `getBoundingClientRect`) and writes (e.g., `style.height`) to avoid forced synchronous layouts.
*   **Compositor-Only Properties**: Prioritize `transform` and `opacity` for animations. These bypass the Layout and Paint stages, running on the GPU.

### Modern CSS Performance
*   **`content-visibility: auto`**: Skips rendering of off-screen elements until they approach the viewport.
*   **`contain` property**: Informs the browser that an element’s subtree is independent, allowing for layout/paint optimizations (`contain: layout paint`).
*   **`will-change`**: Hints to the browser which properties will change (e.g., `will-change: transform`), allowing for early layer creation. Use sparingly.
*   **`aspect-ratio`**: Sets a preferred aspect ratio to prevent Layout Shift (CLS) before media loads.
*   **CSS Grid & Flexbox**: Generally more performant for complex layouts than legacy float/table hacks.

---

## 3. Execution Performance (JavaScript)

### Task Scheduling
*   **`requestAnimationFrame (rAF)`**: Synchronizes code execution with the display's refresh rate (typically 60fps). Ideal for visual updates.
*   **`requestIdleCallback (rIC)`**: Schedules low-priority background tasks when the browser is idle.
*   **`scheduler.yield()` (Prioritized Task Scheduling API)**: Breaks up long tasks to keep the main thread responsive, allowing the browser to interleave input handling or rendering.

### Off-Main-Thread Execution
*   **Web Workers**: Moves heavy computational logic (data processing, complex math) to a background thread.
*   **Shared Workers**: Allows multiple scripts (in different tabs/iframes) to communicate with a single background worker.
*   **Service Workers**: Manages caching and network requests, enabling offline capabilities and faster repeat visits.

### Memory Management
*   **Weak References**: Use `WeakMap`, `WeakSet`, and `WeakRef` to hold references to objects without preventing garbage collection.
*   **Event Listener Cleanup**: Always remove event listeners (`removeEventListener`) or use the `once: true` / `signal` (AbortController) options to prevent leaks.
*   **Object Pooling**: Reuse objects in high-frequency scenarios (like game loops) to reduce Garbage Collection (GC) pressure.

---

## 4. Modern Browser APIs

### Observation APIs
*   **Intersection Observer API**: Efficiently detects when an element enters/exits the viewport (perfect for lazy-loading and infinite scroll).
*   **Resize Observer API**: Tracks changes to an element's dimensions without the overhead of window `resize` events.
*   **Mutation Observer API**: Watch for specific changes to the DOM tree.

### Measurement & Telemetry
*   **Performance API**:
    *   `performance.now()`: High-resolution timestamps.
    *   `performance.mark()` and `performance.measure()`: Custom timing for User Timing API.
    *   `PerformanceObserver`: Efficiently streams performance entries (LCP, FID, CLS, long tasks).
*   **Beacon API (`navigator.sendBeacon`)**: Sends small amounts of data to a server asynchronously on page unload without blocking navigation.

### Data & Streams
*   **Streams API**: Processes data (e.g., large fetch responses) chunk-by-chunk without loading the entire payload into memory.
*   **Compression Streams API**: Compresses and decompresses data streams natively in the browser (Gzip/Deflate).

---

## 5. Network & Optimization

### Image & Media
*   **Native Lazy Loading**: `loading="lazy"` on `<img>` and `<iframe>`.
*   **Modern Formats**: Prefer WebP and AVIF over JPEG/PNG.
*   **`srcset` and `sizes`**: Serve appropriately sized images based on device resolution and layout width.
*   **`decoding="async"`**: Allows image decoding to happen off the main thread.

### Transport
*   **HTTP/2 & HTTP/3**: Leverages multiplexing, header compression (HPACK/QPACK), and reduced latency.
*   **Compression**: Ensure Brotli (preferable) or Gzip is enabled for all text-based assets.

---

## 6. Clean Code & Architectural Patterns

### Efficient Logic
*   **Debouncing & Throttling**: Limit the execution rate of high-frequency event handlers (scroll, resize, typing).
*   **Early Returns**: Reduce cognitive load and unnecessary nesting.
*   **Virtualization**: For large lists, only render the DOM nodes currently visible in the scroll container.

### Modern Syntax for Performance
*   **Spread/Rest vs. Object.assign**: Understanding that modern engines optimize spread operations well, but excessive use on large objects can create overhead.
*   **Typed Arrays**: Use `Int32Array`, `Float64Array`, etc., for high-performance numeric data handling.
*   **`for` vs `forEach`**: Traditional `for` loops or `for...of` are often faster in tight loops than array prototype methods that involve callback overhead.
