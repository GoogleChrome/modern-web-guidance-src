# Web Performance: Common Knowledge Guide

## 1. Core Web Vitals & Metrics

### Key Metrics
- **LCP (Largest Contentful Paint)**: Measures loading performance. Target: ≤2.5s. Tracks the render time of the largest image/text block visible in the viewport.
- **INP (Interaction to Next Paint)**: Replaced FID in March 2024. Measures responsiveness across all interactions. Target: ≤200ms.
- **CLS (Cumulative Layout Shift)**: Measures visual stability. Target: ≤0.1.
- **FCP (First Contentful Paint)**: Time until first DOM content renders. Target: ≤1.8s.
- **TTFB (Time to First Byte)**: Server response time. Target: ≤800ms.
- **TBT (Total Blocking Time)**: Lab metric correlating with INP. Sum of blocking time on the main thread.

### Measurement APIs
```js
// Use PerformanceObserver, not deprecated performance.timing
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.name, entry.startTime, entry.duration);
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });

// Long Animation Frames API (LoAF) - replaces Long Tasks for INP debugging
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('LoAF:', entry.duration, entry.scripts);
  }
}).observe({ type: 'long-animation-frame', buffered: true });

// Event Timing API for INP
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.interactionId) {
      console.log(entry.name, entry.duration);
    }
  }
}).observe({ type: 'event', buffered: true, durationThreshold: 16 });

// Navigation Timing Level 2
const nav = performance.getEntriesByType('navigation')[0];
console.log(nav.domContentLoadedEventEnd - nav.startTime);

// Resource Timing
performance.getEntriesByType('resource').forEach(r => {
  console.log(r.name, r.transferSize, r.duration);
});
```

### Use the `web-vitals` library
The standard for collecting field data; use the attribution build for debugging.

```js
import { onLCP, onINP, onCLS } from 'web-vitals/attribution';
onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

## 2. Loading & Resource Hints

### Resource Hints
```html
<!-- Preconnect: establish early connections to critical origins -->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- DNS Prefetch: lighter-weight fallback for preconnect -->
<link rel="dns-prefetch" href="https://example.com">

<!-- Preload: high-priority fetch for critical resources -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/hero.jpg" as="image" fetchpriority="high">

<!-- Modulepreload: preload ES modules -->
<link rel="modulepreload" href="/app.js">

<!-- Prefetch: low-priority fetch for next-navigation resources -->
<link rel="prefetch" href="/next-page.html">
```

### Speculation Rules API (Chromium)
```html
<script type="speculationrules">
{
  "prerender": [{"where": {"href_matches": "/*"}, "eagerness": "moderate"}],
  "prefetch": [{"where": {"href_matches": "/*"}, "eagerness": "conservative"}]
}
</script>
```

### Priority Hints
```html
<img src="hero.jpg" fetchpriority="high" alt="">
<img src="below-fold.jpg" fetchpriority="low" loading="lazy" alt="">
<script src="analytics.js" fetchpriority="low" async></script>
```

### Script Loading
- `<script defer>`: Downloads in parallel, executes after HTML parsing in order.
- `<script async>`: Downloads in parallel, executes ASAP, no order guarantee.
- `<script type="module">`: Defers by default.
- Avoid synchronous render-blocking scripts in `<head>`.

## 3. Images & Media

### Modern Formats
- **AVIF**: Best compression, broad support since 2024.
- **WebP**: Universal support, fallback for AVIF.
- Use `<picture>` for format negotiation:

```html
<picture>
  <source srcset="hero.avif" type="image/avif">
  <source srcset="hero.webp" type="image/webp">
  <img src="hero.jpg" alt="" width="1200" height="600" loading="lazy" decoding="async">
</picture>
```

### Responsive Images
```html
<img
  srcset="hero-400.jpg 400w, hero-800.jpg 800w, hero-1600.jpg 1600w"
  sizes="(max-width: 600px) 100vw, 50vw"
  src="hero-800.jpg"
  alt=""
  width="1600"
  height="900"
  loading="lazy"
  decoding="async">
```

### Required Image Attributes
- **Always set `width` and `height`** (or `aspect-ratio` in CSS) to prevent CLS.
- Use `loading="lazy"` for below-the-fold images.
- Use `loading="eager"` and `fetchpriority="high"` for LCP images. **Never lazy-load the LCP image.**
- Use `decoding="async"` to avoid blocking rendering.

### Video
```html
<video
  preload="metadata"
  poster="poster.jpg"
  playsinline
  muted
  loop>
  <source src="clip.webm" type="video/webm">
  <source src="clip.mp4" type="video/mp4">
</video>
```
- Use `preload="none"` or `preload="metadata"` to avoid wasted bandwidth.
- Prefer AV1 > VP9 > H.264 for compression.

## 4. Fonts

### Best Practices
```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-weight: 100 900; /* variable font range */
  font-display: swap;   /* or optional, fallback */
  unicode-range: U+0000-00FF;
  size-adjust: 100%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}
```

- Use **WOFF2** exclusively (universal support).
- Use **variable fonts** for weight/style variation.
- `font-display: swap` for visibility (best LCP) or `optional` for stability (best CLS).
- **Preload critical fonts** with `crossorigin`.
- Use `size-adjust` and `*-override` to match fallback metrics, eliminating CLS from font swap.
- Subset fonts with `unicode-range` to reduce file size.

### System Font Stack
```css
font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```

## 5. CSS Performance

### Critical CSS
- Inline critical above-the-fold CSS in `<head>`.
- Defer non-critical CSS:
```html
<link rel="preload" href="non-critical.css" as="style" onload="this.rel='stylesheet'">
```

### Modern CSS Features
- **`content-visibility: auto`**: Skip rendering work for off-screen content.
```css
.section { content-visibility: auto; contain-intrinsic-size: auto 500px; }
```
- **`contain`**: Isolate subtrees to limit layout/paint scope.
```css
.widget { contain: layout style paint; }
```
- **`will-change`**: Hint to the browser; use sparingly and remove after the animation.
- **`transform` / `opacity`** for animations (compositor-only, no layout/paint).
- Avoid animating `width`, `height`, `top`, `left` — they trigger layout.

### Selector Performance
- Modern engines make selector cost mostly negligible; readability beats micro-optimization.
- Prefer flat class-based selectors over deep descendant chains.
- `:has()` is widely supported; use thoughtfully (it's more expensive than other selectors).

### Layout
- Use **CSS Grid** and **Flexbox** instead of float/positioning hacks.
- Use **`aspect-ratio`** to reserve space:
```css
img { aspect-ratio: 16 / 9; width: 100%; height: auto; }
```
- Use **container queries** (`@container`) for component-driven responsive design.

## 6. JavaScript Performance

### Code Splitting
```js
// Dynamic imports for route/component-level splitting
const module = await import('./heavy-feature.js');

// Lazy load on interaction
button.addEventListener('click', async () => {
  const { feature } = await import('./feature.js');
  feature();
}, { once: true });
```

### Defer Non-Critical Work
```js
// scheduler.postTask (Chromium) - prefer over setTimeout(0)
scheduler.postTask(() => doWork(), { priority: 'background' });

// scheduler.yield() to break up long tasks
async function processItems(items) {
  for (const item of items) {
    process(item);
    if (navigator.scheduling?.isInputPending?.()) {
      await scheduler.yield();
    }
  }
}

// requestIdleCallback fallback
requestIdleCallback(() => analytics.send(), { timeout: 2000 });
```

### Avoid Long Tasks
- Break tasks ≤50ms.
- Use `scheduler.yield()` or `await new Promise(r => setTimeout(r, 0))` to yield.
- Move CPU-heavy work to **Web Workers**.

### Web Workers
```js
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
worker.postMessage(data);
worker.onmessage = (e) => handleResult(e.data);

// Transfer ownership for zero-copy
worker.postMessage(buffer, [buffer]);
```

### Debounce / Throttle
```js
// Debounce
const debounce = (fn, ms) => {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
};

// Throttle with rAF for scroll/resize
let rafId;
window.addEventListener('scroll', () => {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    handleScroll();
    rafId = null;
  });
}, { passive: true });
```

### Passive Event Listeners
```js
// Always use passive for scroll-blocking events
el.addEventListener('touchstart', handler, { passive: true });
el.addEventListener('wheel', handler, { passive: true });
```

### Modern Syntax & APIs
- Use `Map`/`Set` for keyed lookups and uniqueness.
- Use `structuredClone()` instead of `JSON.parse(JSON.stringify(x))`.
- Use `AbortController` to cancel fetches and event listeners:
```js
const controller = new AbortController();
fetch(url, { signal: controller.signal });
el.addEventListener('click', handler, { signal: controller.signal });
controller.abort();
```
- Use `Object.groupBy` / `Map.groupBy` for grouping (2024+).
- Use `Array.prototype.at(-1)` instead of `arr[arr.length - 1]`.
- Use `String.prototype.replaceAll`.
- Use top-level `await` in modules.

## 7. Network

### HTTP & Caching
- **HTTP/2 or HTTP/3** for multiplexing; HTTP/3 (QUIC) preferred where available.
- **Brotli** compression for text assets; **Zstandard (zstd)** where supported.
- Long-term caching with content hashes:
```
Cache-Control: public, max-age=31536000, immutable
```
- Short cache for HTML:
```
Cache-Control: no-cache
```
- Use `stale-while-revalidate` for balance:
```
Cache-Control: max-age=60, stale-while-revalidate=86400
```

### Fetch API
```js
const res = await fetch(url, {
  signal: AbortSignal.timeout(5000),
  priority: 'low', // 'high' | 'low' | 'auto'
  cache: 'force-cache',
  keepalive: true, // for beacon-like requests
});
```

### Streaming
```js
// Process large responses without buffering
const response = await fetch(url);
const reader = response.body.getReader();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  process(value);
}
```

### Service Workers
- Use for offline support, runtime caching, and request orchestration.
- Use **Workbox** patterns: cache-first for static assets, network-first for HTML, stale-while-revalidate for APIs.
- Use **Navigation Preload** to parallelize SW startup with navigation requests.

### Connection-Aware Loading
```js
if (navigator.connection?.saveData || navigator.connection?.effectiveType === '2g') {
  // skip non-essential assets
}
```

## 8. Rendering Performance

### Avoid Layout Thrashing
```js
// BAD: read-write-read-write
for (const el of items) {
  el.style.width = el.offsetWidth + 10 + 'px';
}

// GOOD: batch reads, then writes
const widths = items.map(el => el.offsetWidth);
items.forEach((el, i) => el.style.width = widths[i] + 10 + 'px');
```

### Use `requestAnimationFrame` for visual updates
```js
function animate() {
  // visual update
  requestAnimationFrame(animate);
}
```

### Avoid Forced Synchronous Layout
- Reading layout properties (`offsetWidth`, `getBoundingClientRect()`, `getComputedStyle()`) after writes triggers reflow.

### Virtualization
- For long lists, render only visible items (windowing).
- Use `IntersectionObserver` for lazy-load triggers:
```js
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) loadContent(e.target);
  });
}, { rootMargin: '200px' });
```

## 9. DOM & Memory

### Efficient DOM
- Use `DocumentFragment` for batch insertions.
- Prefer `textContent` over `innerHTML` for plain text (also XSS-safer).
- Use event delegation on a parent rather than per-child listeners.

### Memory Leaks
- Remove event listeners (or use `AbortSignal`).
- Clear intervals/timeouts.
- Avoid retaining DOM nodes in closures after removal.
- Use `WeakMap` / `WeakRef` / `FinalizationRegistry` for caches keyed by objects.

## 10. Modules & Bundling

### ES Modules
- Use native ESM (`<script type="module">`) where possible.
- Use **import maps** for bare specifiers without bundling:
```html
<script type="importmap">
{ "imports": { "react": "https://esm.sh/react@18" } }
</script>
```

### Bundling Best Practices
- Tree-shake with ESM imports.
- Code-split per route.
- Avoid barrel files (`index.js` re-exports) that defeat tree-shaking.
- Use modern targets (ES2020+) — drop legacy transpilation when possible.
- Use differential serving via `<script type="module">` / `nomodule`.

## 11. Third-Party Scripts

- Load with `async` or `defer`.
- Use `<iframe loading="lazy">` and the `credentialless` attribute when applicable.
- Self-host critical third-party assets when feasible.
- Use **Partytown** to move third-party scripts to a worker.
- Use `fetchpriority="low"` for analytics.
- Audit with WebPageTest's Third-Party report.

## 12. Build & Delivery

### Compression
- Brotli for static text assets (pre-compress at build time, level 11).
- Gzip as fallback.
- Zstandard for emerging support.

### Minification
- Minify HTML, CSS, JS, SVG.
- Remove unused CSS (PurgeCSS / similar).

### CDN
- Serve static assets from a CDN with edge caching.
- Use HTTP/3 + 0-RTT where available.
- Place origin close to users; use multi-region.

## 13. Common Clean Code Principles

### Performance Code Hygiene
- **Measure first, optimize second.** Don't optimize without profiling data.
- **Profile in production-like conditions** (real devices, throttled CPU/network).
- **Test on slow devices** — Moto G Power class for realistic mid-tier mobile.
- Use Chrome DevTools Performance panel, Lighthouse, and WebPageTest.
- Set **performance budgets** (e.g., JS ≤200KB, LCP ≤2.5s) and enforce in CI.
- Prefer **clarity over cleverness**; modern JS engines optimize idiomatic code well.
- Avoid premature micro-optimizations (e.g., `for` vs `forEach` rarely matters).
- **Cache invalidation**: use content hashes in filenames.
- **Avoid global state mutations** in hot paths.
- **Minimize work in event handlers**; defer non-critical work.

### Accessibility & Performance Together
- Semantic HTML reduces JS needed for behavior (e.g., `<details>`, `<dialog>`).
- Use `prefers-reduced-motion` to skip expensive animations.
```css
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

## 14. Cutting-Edge (Progressive Enhancement)

- **View Transitions API** (Chromium): smooth cross-document transitions.
```css
@view-transition { navigation: auto; }
```
- **Speculation Rules** (Chromium): prerender next page.
- **`scheduler.yield()`** (Chromium): cleaner task yielding.
- **Compression Streams API**: `new CompressionStream('gzip')`.
- **`Cache API`** for runtime caching outside Service Workers.
- **`Navigator.scheduling.isInputPending()`** (Chromium): yield to user input.
- **Back/Forward Cache (bfcache)**: avoid `unload` listeners; use `pagehide` instead. Avoid `Cache-Control: no-store` if possible.

## 15. Diagnostic Workflow

1. **Field data first**: Use CrUX / RUM to find real-user pain points.
2. **Lab repro**: Use Lighthouse / DevTools to reproduce.
3. **Profile**: Performance panel for runtime, Coverage tab for unused code, Network panel for waterfall.
4. **Hypothesize and fix one thing at a time**.
5. **Validate** with before/after measurements.
6. **Monitor** with continuous RUM via `web-vitals`.

## 16. Common Anti-Patterns to Avoid

- Lazy-loading the LCP image.
- Missing `width`/`height` on images and embeds.
- Loading entire icon fonts when 5 SVGs would do.
- Synchronous third-party scripts in `<head>`.
- Animating layout-triggering properties.
- Polling with `setInterval` instead of event-driven updates.
- Shipping a massive client bundle for a static page (use SSG/SSR).
- Re-rendering entire trees on every state change.
- Forgetting to remove event listeners on unmount.
- Using `JSON.parse(JSON.stringify())` for deep clones (use `structuredClone`).
- Bundling polyfills for features all target browsers support.
- Ignoring `prefers-reduced-data` and `Save-Data` headers.
