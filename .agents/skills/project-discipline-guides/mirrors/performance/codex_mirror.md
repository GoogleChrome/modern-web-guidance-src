# Redundancy Mirror: Performance Development Common Knowledge

This guide reflects standard performance engineering knowledge I would apply by default without needing project-specific guidance. It focuses on modern browser APIs, shipped platform features, progressive enhancement, standard syntax, and clean implementation principles.

## Performance Mindset

Performance is a product feature. Optimize for real user outcomes, not just benchmark scores.

Default priorities:

1. Load useful content quickly.
2. Keep the UI responsive during interaction.
3. Avoid layout instability.
4. Avoid wasting network, CPU, memory, and battery.
5. Measure before and after changes.
6. Prefer simple architectural choices that prevent performance problems over later micro-optimizations.

Key user-centered metrics:

- **LCP**: Largest Contentful Paint. Measures when the main content is likely visible.
- **INP**: Interaction to Next Paint. Measures responsiveness across user interactions.
- **CLS**: Cumulative Layout Shift. Measures visual stability.
- **TTFB**: Time to First Byte. Measures backend/network response start.
- **FCP**: First Contentful Paint. Measures when something useful starts rendering.
- **TBT**: Total Blocking Time. Lab proxy for main-thread blocking before interactivity.
- **Long tasks**: Main-thread tasks over 50 ms that delay user input and rendering.

General rule: optimize the critical path first. The most important bytes, requests, and work are those needed to render and interact with the initial viewport.

## Measurement Basics

Use both lab and field data.

Lab tools:

- Lighthouse
- Chrome DevTools Performance panel
- Network panel
- Coverage panel
- Memory panel
- Performance Insights
- WebPageTest
- Bundle analyzers
- Framework profilers, such as React DevTools Profiler

Field data:

- Real User Monitoring
- `PerformanceObserver`
- Navigation Timing
- Resource Timing
- Long Animation Frames / Long Tasks where available
- Core Web Vitals collection
- Server logs and CDN analytics

Do not assume local development performance reflects production. Development builds often include extra checks, unminified code, source maps, slower rendering, and disabled optimizations.

Measure on realistic devices and networks:

- Mid-tier Android devices
- Low-power laptops
- Slow 4G / fast 3G simulations
- Cold cache and warm cache
- Authenticated and unauthenticated flows
- Realistic data volume

Useful browser APIs:

```js
performance.mark("start-work");
// work
performance.mark("end-work");
performance.measure("work", "start-work", "end-work");

const entries = performance.getEntriesByType("measure");
```

```js
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.name, entry.duration);
  }
}).observe({ entryTypes: ["measure", "navigation", "resource"] });
```

Use `console.time()` and `console.timeEnd()` for quick local checks, but prefer `performance.mark()` and `performance.measure()` for structured instrumentation.

## Core Web Vitals

### LCP

Improve LCP by:

- Rendering the LCP element early.
- Avoiding client-side rendering delays for primary content.
- Reducing TTFB.
- Avoiding render-blocking CSS and scripts.
- Preloading the LCP image when appropriate.
- Avoiding lazy loading for above-the-fold hero images.
- Using properly sized, compressed images.
- Serving responsive images.
- Avoiding slow font swaps that delay text rendering.
- Avoiding unnecessary animation or opacity delays on primary content.

Good image pattern:

```html
<img
  src="/hero-1280.avif"
  srcset="/hero-640.avif 640w, /hero-1280.avif 1280w, /hero-1920.avif 1920w"
  sizes="100vw"
  width="1280"
  height="720"
  fetchpriority="high"
  decoding="async"
  alt=""
>
```

Use `fetchpriority="high"` sparingly, usually for the real LCP image. Overusing high priority can harm other critical resources.

Avoid:

```html
<img src="/hero.jpg" loading="lazy">
```

for above-the-fold LCP images.

### INP

Improve INP by:

- Keeping event handlers short.
- Avoiding long synchronous work.
- Splitting large tasks.
- Debouncing or throttling high-frequency events.
- Deferring non-urgent updates.
- Reducing DOM size and expensive style/layout work.
- Avoiding unnecessary framework re-renders.
- Using event delegation where appropriate.
- Moving CPU-heavy work to Web Workers.
- Avoiding forced synchronous layout in interaction handlers.

Bad:

```js
button.addEventListener("click", () => {
  expensiveCalculation();
  renderHugeList();
  sendAnalyticsSynchronously();
});
```

Better:

```js
button.addEventListener("click", () => {
  updateImmediateUI();

  setTimeout(() => {
    expensiveCalculation();
    renderDeferredContent();
  }, 0);

  navigator.sendBeacon("/analytics", JSON.stringify({ action: "click" }));
});
```

Modern task yielding:

```js
if ("scheduler" in window && "yield" in scheduler) {
  await scheduler.yield();
} else {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
```

Use progressive enhancement for `scheduler.yield()` and related Scheduling APIs because support varies.

### CLS

Prevent layout shift by:

- Setting `width` and `height` on images and videos.
- Using CSS `aspect-ratio`.
- Reserving space for ads, embeds, banners, and async content.
- Avoiding inserting content above existing content unless caused by user action.
- Avoiding late font metric changes.
- Using `font-display` intentionally.
- Avoiding animations that affect layout properties.

Good:

```css
.media {
  aspect-ratio: 16 / 9;
}

img,
video {
  max-width: 100%;
  height: auto;
}
```

Prefer transform/opacity animations:

```css
.card {
  transition: transform 160ms ease, opacity 160ms ease;
}

.card:hover {
  transform: translateY(-2px);
}
```

Avoid layout-triggering animation:

```css
.card:hover {
  top: -2px;
  width: 105%;
}
```

## HTML Performance

Use semantic HTML. It improves parsing, accessibility, browser behavior, and maintainability.

Prefer native elements:

- `<button>` for actions
- `<a>` for navigation
- `<img>` for images
- `<video>` for video
- `<dialog>` for modal dialogs where appropriate
- `<details>` and `<summary>` for disclosure UI
- Form controls for input rather than custom widgets

Native controls usually have better accessibility, keyboard behavior, mobile support, and less JavaScript.

Specify dimensions:

```html
<img src="/image.avif" width="800" height="600" alt="Description">
```

Use responsive images:

```html
<picture>
  <source srcset="/image.avif" type="image/avif">
  <source srcset="/image.webp" type="image/webp">
  <img src="/image.jpg" width="800" height="600" alt="Description">
</picture>
```

Use `srcset` and `sizes` for resolution and viewport-aware loading:

```html
<img
  src="/product-800.jpg"
  srcset="/product-400.jpg 400w, /product-800.jpg 800w, /product-1200.jpg 1200w"
  sizes="(max-width: 700px) 100vw, 50vw"
  width="800"
  height="600"
  loading="lazy"
  decoding="async"
  alt="Product"
>
```

Use lazy loading for below-the-fold images and iframes:

```html
<img src="/below-fold.jpg" loading="lazy" decoding="async" alt="">
<iframe src="/embed" loading="lazy"></iframe>
```

Do not lazy-load critical above-the-fold content.

Use resource hints carefully:

```html
<link rel="preconnect" href="https://cdn.example.com">
<link rel="dns-prefetch" href="https://cdn.example.com">
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="modulepreload" href="/assets/app.js">
```

Guidance:

- Use `preconnect` for critical third-party origins used early.
- Use `dns-prefetch` for less critical origins.
- Use `preload` for critical resources the browser would otherwise discover late.
- Use `modulepreload` for important JavaScript modules.
- Avoid preloading too much. It can compete with more important resources.

Use async/defer correctly:

```html
<script src="/non-critical.js" defer></script>
<script type="module" src="/app.js"></script>
```

Notes:

- Classic scripts without `async` or `defer` block parsing.
- `defer` scripts execute after parsing and preserve order.
- `async` scripts execute as soon as loaded and do not preserve order.
- `type="module"` scripts are deferred by default.
- Avoid blocking scripts in `<head>` unless truly required.

Use progressive HTML streaming when server rendering. Send the shell and critical content as soon as possible.

Avoid excessive DOM depth and node count. Very large DOMs increase style, layout, memory, and interaction cost.

## CSS Performance

CSS blocks rendering, so keep critical CSS small.

Best practices:

- Inline only truly critical CSS when beneficial.
- Load non-critical CSS later.
- Remove unused CSS.
- Avoid shipping entire design systems when only a few rules are used.
- Prefer simple selectors.
- Avoid deeply nested selectors.
- Avoid expensive universal selector patterns over large subtrees.
- Avoid unnecessary `!important`.
- Use cascade layers where helpful for predictable overrides.

Modern CSS features I would use by default when supported by target browsers:

- Custom properties
- Logical properties
- `clamp()`, `min()`, `max()`
- `aspect-ratio`
- Container queries
- Cascade layers
- `:is()`
- `:where()`
- `:has()` with care
- Native CSS nesting, if supported by project browser targets
- Media query range syntax
- `@supports`
- `content-visibility`
- `contain`
- `prefers-reduced-motion`
- `prefers-color-scheme`
- `color-scheme`
- Subgrid where available and appropriate

Use feature queries:

```css
@supports (container-type: inline-size) {
  .card-list {
    container-type: inline-size;
  }

  @container (min-width: 40rem) {
    .card {
      grid-template-columns: 12rem 1fr;
    }
  }
}
```

Use containment for isolated components:

```css
.widget {
  contain: layout paint style;
}
```

Use `content-visibility` for large offscreen sections:

```css
.section {
  content-visibility: auto;
  contain-intrinsic-size: 800px;
}
```

This can reduce initial rendering cost, but test carefully because it affects rendering, find-in-page behavior in some cases, accessibility timing, and scroll behavior.

Use `@starting-style` for entry transitions where supported:

```css
.panel {
  opacity: 1;
  transition: opacity 150ms ease;
}

@starting-style {
  .panel {
    opacity: 0;
  }
}
```

Use `@supports` for progressive enhancement around newer features:

```css
@supports selector(:has(*)) {
  .field:has(input:invalid) {
    border-color: red;
  }
}
```

Avoid animating layout properties:

Expensive:

- `width`
- `height`
- `top`
- `left`
- `right`
- `bottom`
- `margin`
- `padding`
- `border-width`
- `font-size`
- `grid-template-*`

Usually cheaper:

- `transform`
- `opacity`

Use `will-change` sparingly:

```css
.menu {
  will-change: transform;
}
```

Remove or avoid persistent `will-change` on many elements because it can increase memory usage.

Respect reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
```

Use `font-display`:

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter.woff2") format("woff2");
  font-display: swap;
}
```

Use modern font formats:

- Prefer WOFF2.
- Use variable fonts when they reduce total font bytes.
- Subset fonts.
- Avoid loading unused weights and styles.
- Preload only critical fonts.
- Use system font stacks when brand constraints allow.

System font stack:

```css
body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

## JavaScript Loading

JavaScript is expensive because it must be downloaded, parsed, compiled, and executed.

Default principles:

- Ship less JavaScript.
- Split by route and feature.
- Load non-critical JavaScript after critical rendering.
- Prefer server-rendered or static HTML for initial content where possible.
- Avoid hydration work that does not create immediate user value.
- Avoid large dependencies for small utilities.
- Use modern ESM builds.
- Use tree-shaking-friendly imports.
- Avoid top-level side effects in modules.
- Avoid legacy transpilation unless target browsers require it.

Use dynamic imports:

```js
button.addEventListener("click", async () => {
  const { openEditor } = await import("./editor.js");
  openEditor();
});
```

Prefer named imports from tree-shakable packages:

```js
import { format } from "date-fns";
```

Avoid importing entire libraries when only a small function is needed:

```js
import _ from "lodash";
```

Use import maps only when appropriate and supported by deployment constraints:

```html
<script type="importmap">
{
  "imports": {
    "utils": "/js/utils.js"
  }
}
</script>
```

Use modern syntax when supported by build targets:

- `let` and `const`
- Arrow functions
- Classes where useful
- Template literals
- Destructuring
- Default parameters
- Rest/spread
- Optional chaining
- Nullish coalescing
- Logical assignment
- Private class fields
- Static class fields
- Top-level `await` in modules where appropriate
- `Array.prototype.at`
- `Object.hasOwn`
- `structuredClone`
- `Promise.allSettled`
- `Promise.any`
- `AbortController`
- `WeakMap`
- `WeakSet`
- `Map`
- `Set`

Use nullish coalescing instead of `||` when valid falsy values matter:

```js
const limit = options.limit ?? 20;
```

Use optional chaining for safe property access:

```js
const city = user.profile?.address?.city;
```

Use `Object.hasOwn()`:

```js
if (Object.hasOwn(config, key)) {
  // own property
}
```

Use `structuredClone()` for deep cloning supported data:

```js
const copy = structuredClone(data);
```

Avoid JSON clone for general cloning because it loses types and fails on unsupported values.

## Main Thread Work

Keep the main thread available for input, rendering, and scrolling.

Avoid long synchronous operations:

- Large JSON parsing
- Large loops
- Complex sorting/filtering
- Syntax highlighting huge documents
- Client-side image processing
- Expensive markdown rendering
- Large DOM updates
- Heavy framework reconciliation

Chunk work:

```js
async function processItems(items) {
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    processChunk(chunk);

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
```

Prefer `requestIdleCallback` for low-priority work where supported, with fallback:

```js
const scheduleIdle = window.requestIdleCallback
  ? window.requestIdleCallback
  : (callback) => setTimeout(() => callback({ timeRemaining: () => 0 }), 1);

scheduleIdle(() => {
  warmCache();
});
```

Do not use idle callbacks for work required for the next interaction.

Use `requestAnimationFrame` for visual updates:

```js
requestAnimationFrame(() => {
  element.style.transform = `translateX(${x}px)`;
});
```

Separate reads and writes to avoid layout thrashing:

Bad:

```js
for (const item of items) {
  const height = item.offsetHeight;
  item.style.height = `${height + 10}px`;
}
```

Better:

```js
const heights = items.map((item) => item.offsetHeight);

items.forEach((item, index) => {
  item.style.height = `${heights[index] + 10}px`;
});
```

Avoid forced synchronous layout reads after writes:

Layout-triggering reads include:

- `offsetWidth`
- `offsetHeight`
- `offsetTop`
- `offsetLeft`
- `clientWidth`
- `clientHeight`
- `scrollWidth`
- `scrollHeight`
- `getBoundingClientRect()`
- `getComputedStyle()`

They are not bad by themselves, but they become expensive when interleaved with DOM writes.

## Web Workers

Use Web Workers for CPU-heavy work that does not need direct DOM access.

Good candidates:

- Parsing large files
- Data transformation
- Search indexing
- Compression
- Image manipulation with OffscreenCanvas where supported
- Syntax highlighting
- Crypto-heavy non-WebCrypto tasks
- Expensive calculations

Example:

```js
const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});

worker.postMessage({ type: "process", payload: data });

worker.addEventListener("message", (event) => {
  renderResult(event.data);
});
```

Transfer large binary data instead of copying:

```js
worker.postMessage(buffer, [buffer]);
```

Use Comlink-like abstractions only if they reduce complexity and do not hide important performance costs.

Use `SharedArrayBuffer` only when the app has proper cross-origin isolation headers and a real need.

## Network Performance

Reduce round trips, bytes, and blocking dependencies.

Best practices:

- Use HTTP/2 or HTTP/3 where available.
- Compress text assets with Brotli or gzip.
- Use CDN caching for static assets.
- Use immutable hashed filenames.
- Set strong cache headers.
- Avoid unnecessary third-party scripts.
- Reduce redirects.
- Avoid document-blocking third-party resources.
- Keep cookies small, especially on frequently requested origins.
- Serve assets from geographically close locations.
- Avoid cache-busting query strings unless intentional.
- Use `stale-while-revalidate` where appropriate.
- Avoid serial request waterfalls.

Cache header pattern for hashed static assets:

```http
Cache-Control: public, max-age=31536000, immutable
```

For HTML:

```http
Cache-Control: no-cache
```

or a short max-age with revalidation, depending on app needs.

Use `fetch()` with aborts:

```js
const controller = new AbortController();

const response = await fetch("/api/search", {
  signal: controller.signal,
});

controller.abort();
```

Timeout wrapper:

```js
async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
}
```

Use request deduplication for identical in-flight requests.

Avoid fetching data that is already embedded in the initial HTML when SSR can provide it safely.

Prefer pagination, cursor loading, or virtualization over fetching huge datasets.

Use `navigator.sendBeacon()` for analytics during page unload:

```js
navigator.sendBeacon("/analytics", JSON.stringify(eventData));
```

Use `keepalive` for small fetches when needed:

```js
fetch("/analytics", {
  method: "POST",
  body: JSON.stringify(eventData),
  keepalive: true,
});
```

## Fetching And Data

Use parallel requests when independent:

```js
const [user, settings] = await Promise.all([
  fetchUser(),
  fetchSettings(),
]);
```

Avoid accidental waterfalls:

Bad:

```js
const user = await fetchUser();
const settings = await fetchSettings();
```

when `settings` does not depend on `user`.

Use `Promise.allSettled()` when partial failure is acceptable:

```js
const results = await Promise.allSettled([fetchA(), fetchB()]);
```

Abort stale requests in search/autocomplete:

```js
let currentController;

async function search(query) {
  currentController?.abort();

  currentController = new AbortController();

  const response = await fetch(`/search?q=${encodeURIComponent(query)}`, {
    signal: currentController.signal,
  });

  return response.json();
}
```

Debounce user input:

```js
function debounce(fn, delay) {
  let id;

  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}
```

Throttle scroll/resize work:

```js
function throttle(fn, interval) {
  let last = 0;

  return (...args) => {
    const now = performance.now();

    if (now - last >= interval) {
      last = now;
      fn(...args);
    }
  };
}
```

Prefer `ResizeObserver` and `IntersectionObserver` to polling.

```js
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      loadCard(entry.target);
      observer.unobserve(entry.target);
    }
  }
});

observer.observe(element);
```

```js
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    updateLayout(entry.contentRect);
  }
});

resizeObserver.observe(container);
```

## Images

Images are often the largest assets.

Best practices:

- Use AVIF where suitable.
- Use WebP as a broad fallback.
- Use JPEG for photos when AVIF/WebP unavailable.
- Use PNG only when lossless transparency or exact pixels are needed.
- Use SVG for icons and simple vector graphics.
- Compress images.
- Resize images to display dimensions.
- Avoid serving 4000 px images into 400 px containers.
- Use `srcset` and `sizes`.
- Use `loading="lazy"` below the fold.
- Use `decoding="async"` for non-critical images.
- Use `fetchpriority="high"` for the true LCP image.
- Reserve space with `width`, `height`, or `aspect-ratio`.
- Avoid layout-shifting placeholders.
- Avoid base64 inlining large images into CSS or HTML.
- Use CSS gradients only when they are lighter and appropriate.
- Avoid animated GIFs for large animations; prefer video.

Video instead of GIF:

```html
<video autoplay muted loop playsinline width="640" height="360">
  <source src="/animation.webm" type="video/webm">
  <source src="/animation.mp4" type="video/mp4">
</video>
```

Use `poster` for videos:

```html
<video controls preload="metadata" poster="/poster.jpg">
  <source src="/video.webm" type="video/webm">
  <source src="/video.mp4" type="video/mp4">
</video>
```

Avoid `preload="auto"` for many videos.

## Fonts

Fonts can block text rendering or cause layout shifts.

Best practices:

- Use system fonts when acceptable.
- Use WOFF2.
- Subset font files.
- Limit weights, styles, and character sets.
- Use variable fonts if they reduce total bytes.
- Use `font-display`.
- Preload critical fonts.
- Avoid loading icon fonts; prefer inline SVG or SVG sprites.
- Match fallback font metrics where possible.
- Avoid render-blocking external font CSS when self-hosting is feasible.

Example:

```html
<link
  rel="preload"
  href="/fonts/inter-var.woff2"
  as="font"
  type="font/woff2"
  crossorigin
>
```

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-var.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}
```

Use `size-adjust`, `ascent-override`, `descent-override`, and `line-gap-override` when carefully matching fallback metrics:

```css
@font-face {
  font-family: "Inter Fallback";
  src: local("Arial");
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}
```

## Rendering And Layout

Avoid unnecessary reflows and repaints.

Best practices:

- Keep DOM size reasonable.
- Avoid deeply nested layout structures.
- Prefer CSS layout over JS layout.
- Use Flexbox and Grid appropriately.
- Use CSS containment for isolated regions.
- Avoid reading layout repeatedly during writes.
- Avoid expensive box shadows and filters on many elements.
- Avoid backdrop filters over large areas unless tested.
- Avoid fixed-position large layers with expensive effects.
- Avoid unnecessary compositing layers.
- Use virtualization for long lists.

Virtualize long lists rather than rendering thousands of nodes.

Basic idea:

```js
const visibleItems = items.slice(startIndex, endIndex);
```

Use established virtualization libraries for complex production cases.

CSS Grid and Flexbox are generally efficient, but pathological layouts with many items, nested grids, or frequent layout changes can still be expensive.

Use `transform: translate(...)` for movement instead of positioning properties.

## Animation

Animations should be smooth, interruptible, and respectful of user preferences.

Default rules:

- Animate `transform` and `opacity`.
- Avoid layout-triggering animation.
- Use CSS animations/transitions for simple state changes.
- Use Web Animations API for complex imperative animation.
- Use `requestAnimationFrame` for JS-driven visual updates.
- Avoid running animations when offscreen.
- Pause background animations when hidden.
- Respect `prefers-reduced-motion`.
- Avoid animating huge blurred elements or filters.

Web Animations API:

```js
element.animate(
  [
    { transform: "translateY(8px)", opacity: 0 },
    { transform: "translateY(0)", opacity: 1 },
  ],
  {
    duration: 180,
    easing: "ease-out",
    fill: "both",
  }
);
```

Cancel animations when no longer needed:

```js
const animation = element.animate(keyframes, options);
animation.cancel();
```

Use Page Visibility API:

```js
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseWork();
  } else {
    resumeWork();
  }
});
```

## Event Handling

Use efficient event handling.

Best practices:

- Use event delegation for many similar children.
- Use passive listeners for scroll/touch listeners where `preventDefault()` is not needed.
- Avoid heavy work in input handlers.
- Debounce text input queries.
- Throttle resize and scroll updates.
- Use `pointer` events instead of separately handling mouse and touch when possible.
- Clean up event listeners.
- Use `AbortController` for listener cleanup.

Passive listener:

```js
window.addEventListener("scroll", onScroll, { passive: true });
```

Abortable listener:

```js
const controller = new AbortController();

element.addEventListener("click", onClick, {
  signal: controller.signal,
});

controller.abort();
```

Event delegation:

```js
list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  handleAction(button.dataset.action);
});
```

Avoid attaching thousands of listeners when one delegated listener will do.

## Memory

Memory problems often appear as sluggishness, crashes, or degraded responsiveness.

Avoid:

- Retaining detached DOM nodes.
- Keeping large arrays forever.
- Unbounded caches.
- Unremoved event listeners.
- Long-lived closures over large objects.
- Storing duplicate normalized data.
- Rendering hidden but heavy UI trees.
- Leaking timers, observers, sockets, and workers.

Use cleanup patterns:

```js
const controller = new AbortController();

function mount() {
  window.addEventListener("resize", onResize, {
    signal: controller.signal,
  });
}

function unmount() {
  controller.abort();
}
```

Disconnect observers:

```js
observer.disconnect();
resizeObserver.disconnect();
mutationObserver.disconnect();
```

Terminate workers:

```js
worker.terminate();
```

Use bounded caches:

```js
class LruCache {
  constructor(limit = 100) {
    this.limit = limit;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;

    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);

    return value;
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    this.map.set(key, value);

    if (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }
}
```

Use `WeakMap` for metadata associated with object lifetimes:

```js
const metadata = new WeakMap();
metadata.set(element, { initialized: true });
```

## Storage

Use storage intentionally.

Options:

- `localStorage`: synchronous, small data, can block main thread.
- `sessionStorage`: synchronous, tab-scoped.
- IndexedDB: async, better for larger structured data.
- Cache Storage: request/response caching, service workers.
- Cookies: sent with requests; keep small.
- OPFS: useful for file-like data in supported browsers.

Avoid large synchronous `localStorage` reads during startup.

Bad:

```js
const state = JSON.parse(localStorage.getItem("huge-state"));
```

Better: defer, reduce, or use async storage.

Use IndexedDB for larger client data. Use a small wrapper library if it reduces boilerplate.

## Service Workers And Offline

Service workers can improve repeat visits but add complexity.

Use for:

- Offline support
- App shell caching
- Runtime caching
- Background sync where supported
- Push notifications where appropriate
- Faster repeat navigations

Avoid:

- Stale critical assets due to poor update strategy.
- Caching personalized or sensitive responses incorrectly.
- Blocking first load with service worker setup.
- Overly broad cache rules.
- Cache growth without cleanup.

Register after initial load unless early control is necessary:

```js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js");
  });
}
```

Use Workbox or equivalent for non-trivial caching strategies.

Common strategies:

- Cache first for immutable static assets.
- Network first for frequently changing data.
- Stale while revalidate for assets where brief staleness is acceptable.
- Network only for sensitive or non-cacheable requests.

## Third-Party Scripts

Third-party resources are common performance risks.

Best practices:

- Audit every third-party script.
- Remove unused vendors.
- Load third-party scripts after critical rendering when possible.
- Use `async` or `defer`.
- Self-host when licensing, updates, and security allow.
- Use facades for heavy embeds.
- Lazy-load maps, videos, chat widgets, and social embeds.
- Limit tag manager sprawl.
- Monitor third-party CPU cost, not just bytes.
- Use `preconnect` only for critical third-party origins.
- Avoid blocking consent, analytics, or personalization scripts on initial render unless required.

Embed facade example: show a lightweight thumbnail/button, load the real iframe only after click.

## Bundling

Production bundles should be optimized.

Expected defaults:

- Minification.
- Tree shaking.
- Code splitting.
- Route-level chunks.
- Dynamic imports for rarely used features.
- Modern browser output when possible.
- Differential serving only when needed.
- CSS extraction where beneficial.
- Dead code elimination.
- Dependency deduplication.
- Avoid source maps in public production unless intentional.
- Analyze large dependencies.
- Avoid polyfilling entire APIs when small targeted fallbacks suffice.

Use `sideEffects` correctly in package metadata when authoring libraries:

```json
{
  "sideEffects": false
}
```

Only mark false if modules truly have no import-time side effects.

Avoid barrel files that defeat tree shaking in some build setups.

Avoid importing Node-oriented packages into browser bundles.

Prefer native APIs over dependencies when practical:

- `fetch` instead of request libraries
- `Intl` instead of many date/number formatting utilities
- `URL` and `URLSearchParams`
- `structuredClone`
- `crypto.randomUUID`
- `AbortController`
- CSS instead of JS animation libraries for simple transitions

## Modern JavaScript APIs

Use `Intl` for locale-aware formatting:

```js
const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

formatter.format(1234.56);
```

```js
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
```

Use `URL` and `URLSearchParams`:

```js
const url = new URL("/search", location.origin);
url.searchParams.set("q", query);
```

Use `crypto.randomUUID()`:

```js
const id = crypto.randomUUID();
```

Use Web Crypto for cryptographic operations, not hand-rolled crypto.

Use `AbortController` for cancelable async work:

```js
const controller = new AbortController();
doWork({ signal: controller.signal });
controller.abort();
```

Use streams for large data where appropriate:

```js
const response = await fetch("/large-file");
const reader = response.body.getReader();
```

Use `TextEncoder` and `TextDecoder` for binary/text conversion:

```js
const bytes = new TextEncoder().encode("hello");
const text = new TextDecoder().decode(bytes);
```

Use `Blob` and object URLs for generated files:

```js
const blob = new Blob([content], { type: "text/plain" });
const url = URL.createObjectURL(blob);

URL.revokeObjectURL(url);
```

Always revoke object URLs when no longer needed.

## Web Components

Use Web Components when they fit the architecture, especially for framework-agnostic reusable widgets.

Performance considerations:

- Shadow DOM encapsulation can help style isolation but adds complexity.
- Avoid excessive custom element creation for huge lists.
- Defer non-critical work in `connectedCallback`.
- Clean up listeners, observers, and timers in `disconnectedCallback`.
- Use attributes and properties intentionally.
- Avoid layout-heavy lifecycle work.

Example cleanup:

```js
class MyElement extends HTMLElement {
  #controller = new AbortController();

  connectedCallback() {
    this.addEventListener("click", this.#onClick, {
      signal: this.#controller.signal,
    });
  }

  disconnectedCallback() {
    this.#controller.abort();
  }

  #onClick = () => {
    // handle
  };
}

customElements.define("my-element", MyElement);
```

## Accessibility And Performance

Accessibility and performance usually reinforce each other.

Best practices:

- Use native HTML.
- Avoid excessive JavaScript for basic interactions.
- Keep focus handling simple.
- Do not trap users in slow custom controls.
- Respect reduced motion.
- Avoid layout shifts that disorient users.
- Make loading states clear.
- Avoid infinite spinners without progress or retry paths.
- Do not delay meaningful content for decorative effects.

Fast, semantic interfaces are usually more accessible.

## Framework Performance

General principles apply across React, Vue, Svelte, Angular, Solid, and others.

Best practices:

- Avoid unnecessary re-renders.
- Keep component state local when possible.
- Do not put rapidly changing state at the top of large trees.
- Memoize only when it prevents real work.
- Avoid expensive computations in render functions.
- Split large components by responsibility.
- Use virtualization for large lists.
- Use stable keys.
- Avoid using array index as key when list order can change.
- Lazy-load heavy routes and components.
- Prefer server rendering or static rendering for content-heavy pages.
- Avoid hydration for static islands where possible.
- Use partial hydration/islands/resumability when framework supports it and complexity is justified.
- Profile before adding memoization everywhere.

React common knowledge:

- Use `memo`, `useMemo`, and `useCallback` selectively.
- Avoid creating unnecessary objects/functions if they cause expensive child renders.
- Use transitions for non-urgent updates.
- Use `Suspense` appropriately.
- Keep controlled inputs responsive.
- Avoid expensive work during render.
- Use production builds.

React example:

```js
const filteredItems = useMemo(() => {
  return items.filter((item) => item.name.includes(query));
}, [items, query]);
```

Do not use `useMemo` for trivial calculations unless it avoids meaningful downstream cost.

Vue common knowledge:

- Keep reactive state minimal.
- Avoid making huge immutable datasets deeply reactive when unnecessary.
- Use computed properties for derived data.
- Use async components for code splitting.
- Use `v-memo` or equivalent optimizations selectively.
- Use stable keys.

Svelte common knowledge:

- Reactive declarations are efficient but should not hide expensive repeated work.
- Avoid huge keyed updates when virtualization is needed.
- Use stores carefully to avoid broad invalidation.

Angular common knowledge:

- Use `OnPush` change detection where appropriate.
- Use `trackBy` in repeated lists.
- Avoid heavy template expressions.
- Lazy-load routes.
- Use signals where appropriate in modern Angular.

## Server Rendering

Server rendering can improve initial content visibility but can also add hydration cost.

Best practices:

- Stream HTML where possible.
- Send critical content early.
- Avoid blocking rendering on non-critical data.
- Avoid duplicating expensive work on server and client.
- Keep hydration payloads small.
- Use partial hydration or islands when suitable.
- Cache rendered output when possible.
- Avoid huge serialized JSON blobs.
- Escape serialized data safely.
- Avoid client-rendering the whole page after SSR.

Hydration cost matters. A page that displays quickly but is unresponsive for seconds is still slow.

## Edge And Backend Interaction

Frontend performance often depends on backend behavior.

Best practices:

- Reduce TTFB.
- Cache at CDN/edge when possible.
- Use compression.
- Avoid unnecessary redirects.
- Optimize database queries.
- Avoid over-fetching.
- Use pagination.
- Return only needed fields.
- Use HTTP caching headers.
- Use ETags or Last-Modified for revalidation.
- Coalesce requests.
- Use server push alternatives carefully; HTTP/2 push is generally not a default recommendation.
- Prefer `103 Early Hints` where infrastructure supports it and it is beneficial.

API design performance:

- Avoid chatty request patterns.
- Batch when it reduces latency without over-fetching.
- Provide endpoints shaped for critical UI needs.
- Avoid sending huge nested objects for simple screens.
- Support compression.
- Support conditional requests.

## Clean Code Principles For Performance

Write code that makes performance characteristics obvious.

Principles:

- Prefer straightforward code.
- Keep data flow clear.
- Avoid hidden global work.
- Avoid import-time side effects.
- Make expensive operations explicit.
- Name functions according to cost when relevant.
- Cache only with clear invalidation rules.
- Keep caches bounded.
- Do not prematurely memoize everything.
- Avoid clever micro-optimizations that obscure behavior.
- Prefer algorithms with appropriate complexity.
- Use data structures intentionally.
- Avoid repeated linear scans in hot paths.
- Avoid nested loops over large collections when maps/sets would help.
- Avoid mutating shared state unpredictably.
- Keep rendering logic separate from data processing when useful.
- Add comments for non-obvious performance decisions.

Use `Map` for keyed lookup:

```js
const usersById = new Map(users.map((user) => [user.id, user]));
```

Use `Set` for membership:

```js
const selectedIds = new Set(selected.map((item) => item.id));

const visible = items.filter((item) => selectedIds.has(item.id));
```

Avoid repeated search:

```js
// Potentially O(n*m)
orders.map((order) => ({
  ...order,
  user: users.find((user) => user.id === order.userId),
}));
```

Better:

```js
const usersById = new Map(users.map((user) => [user.id, user.id]));

orders.map((order) => ({
  ...order,
  user: usersById.get(order.userId),
}));
```

Use early returns:

```js
function renderItem(item) {
  if (!item.visible) return null;

  return createItemView(item);
}
```

Avoid work in loops when it can be hoisted:

```js
const formatter = new Intl.NumberFormat("en-US");

for (const value of values) {
  labels.push(formatter.format(value));
}
```

Do not instantiate expensive formatters repeatedly in hot paths.

## Algorithmic Performance

Know common complexity:

- Array lookup by index: O(1)
- Array search: O(n)
- Object/Map lookup: usually O(1)
- Set membership: usually O(1)
- Sorting: usually O(n log n)
- Nested loops: often O(n²)

Common improvements:

- Pre-index data with `Map`.
- Use `Set` for membership.
- Sort once, not repeatedly.
- Cache derived data when inputs are stable.
- Avoid repeated parsing or formatting.
- Use incremental updates instead of recomputing everything.
- Use binary search for sorted data when appropriate.
- Use tries or indexes for heavy search/autocomplete when justified.
- Use workers for expensive operations.

Do not replace clear O(n) code with obscure tricks unless profiling shows it matters.

## DOM Updates

Batch DOM changes.

Use `DocumentFragment` for many insertions:

```js
const fragment = document.createDocumentFragment();

for (const item of items) {
  const element = renderItem(item);
  fragment.append(element);
}

list.append(fragment);
```

Use `replaceChildren()`:

```js
list.replaceChildren(...nodes);
```

Use `<template>` for repeated structures:

```html
<template id="row-template">
  <li class="row"></li>
</template>
```

```js
const template = document.querySelector("#row-template");

const node = template.content.firstElementChild.cloneNode(true);
```

Avoid repeated `innerHTML += ...` because it reparses and recreates content.

Be careful with `innerHTML` for security and performance. Prefer DOM APIs for untrusted content.

Use `textContent` instead of `innerHTML` for plain text:

```js
element.textContent = user.name;
```

## Observers

Use observer APIs instead of polling.

Intersection Observer:

- Lazy-load content.
- Start/stop animations.
- Track visibility.
- Trigger prefetch when near viewport.

Resize Observer:

- Respond to element size changes.
- Avoid global resize hacks.

Mutation Observer:

- React to DOM changes when integration requires it.
- Avoid observing huge subtrees unnecessarily.
- Disconnect when done.

Performance Observer:

- Collect performance entries.
- Track long tasks, layout shifts, resources, navigation, paint entries where supported.

## Progressive Enhancement

Use modern features when beneficial, with fallbacks for unsupported browsers.

Patterns:

```js
if ("IntersectionObserver" in window) {
  // enhanced behavior
} else {
  // fallback
}
```

```css
@supports (content-visibility: auto) {
  .section {
    content-visibility: auto;
  }
}
```

Progressive enhancement candidates:

- `content-visibility`
- Container queries
- `:has()`
- View Transitions API
- Scheduler API
- Speculation Rules
- Navigation API
- Popover API
- Anchor positioning
- OffscreenCanvas
- WebGPU
- Compression Streams
- File System Access API
- Shared Storage / privacy sandbox features, depending on use case

Cutting-edge features should not be required for core functionality unless the product explicitly targets browsers that support them.

## Speculation And Prefetching

Use predictive loading carefully.

Options:

```html
<link rel="prefetch" href="/next-page">
<link rel="prerender" href="/next-page">
```

Speculation Rules API, where supported:

```html
<script type="speculationrules">
{
  "prerender": [
    {
      "source": "list",
      "urls": ["/next"]
    }
  ]
}
</script>
```

Guidance:

- Prefetch likely next navigations.
- Avoid prefetching large resources on constrained networks.
- Respect data saver signals where available.
- Do not prerender pages with unsafe side effects.
- Avoid wasting user bandwidth.
- Be careful with authenticated or personalized pages.

Check connection hints:

```js
const connection = navigator.connection;

if (!connection?.saveData && connection?.effectiveType !== "2g") {
  prefetchLikelyRoute();
}
```

Network Information API support varies, so treat it as enhancement.

## View Transitions

Use View Transitions API as progressive enhancement.

```js
if (document.startViewTransition) {
  document.startViewTransition(() => updateDOM());
} else {
  updateDOM();
}
```

Keep transitions short and avoid masking slow navigations. A transition should not delay meaningful content.

## Popover And Dialog

Use native `popover` and `<dialog>` where supported and appropriate.

Popover:

```html
<button popovertarget="menu">Menu</button>
<div id="menu" popover>
  ...
</div>
```

Dialog:

```html
<dialog id="modal">
  <form method="dialog">
    <button>Close</button>
  </form>
</dialog>
```

Native primitives can reduce JavaScript and improve accessibility, but test behavior across target browsers.

## Forms

Use native form behavior.

Best practices:

- Use correct input types.
- Use built-in validation where suitable.
- Avoid custom controls unless needed.
- Avoid JS-heavy validation on every keystroke.
- Debounce async validation.
- Keep input handlers fast.
- Use `autocomplete`.
- Use `inputmode`.
- Use `enterkeyhint`.
- Use `required`, `min`, `max`, `pattern`, and other native constraints.

Example:

```html
<input
  type="email"
  autocomplete="email"
  required
>
```

```html
<input
  type="text"
  inputmode="numeric"
  autocomplete="one-time-code"
>
```

## Security And Performance

Security choices can affect performance, and performance choices must not weaken security.

Common knowledge:

- Do not use unsafe `innerHTML` with untrusted data.
- Avoid loading unnecessary third-party scripts.
- Use Content Security Policy where possible.
- Use Subresource Integrity for third-party static assets.
- Use HTTPS.
- Use secure cookies.
- Use COOP/COEP when required for advanced APIs like `SharedArrayBuffer`.
- Avoid exposing secrets in client bundles.
- Avoid client-side crypto schemes as a substitute for server security.

SRI example:

```html
<script
  src="https://cdn.example.com/library.js"
  integrity="sha384-..."
  crossorigin="anonymous"
  defer
></script>
```

## Mobile Performance

Mobile devices are constrained by CPU, memory, thermal throttling, and network quality.

Best practices:

- Test on real mobile hardware.
- Reduce JavaScript.
- Avoid large layout shifts.
- Keep touch handlers fast.
- Use passive listeners.
- Avoid large fixed backgrounds and heavy filters.
- Avoid excessive box shadows.
- Avoid scroll-linked JavaScript effects.
- Use responsive images.
- Avoid autoplaying heavy media.
- Keep tap targets stable.
- Avoid input jank from controlled components.
- Minimize memory use.
- Account for virtual keyboard resizing.

Use modern viewport units carefully:

- `svh`
- `lvh`
- `dvh`

Example:

```css
.panel {
  min-height: 100svh;
}
```

Use `dvh` when dynamic viewport behavior is desired, and test mobile browser UI behavior.

## Scroll Performance

Avoid scroll jank.

Best practices:

- Avoid heavy scroll handlers.
- Use passive listeners.
- Prefer CSS `position: sticky` over JS scroll positioning.
- Prefer Intersection Observer over scroll polling.
- Avoid animating expensive properties during scroll.
- Avoid large repaint areas.
- Avoid scroll-linked effects unless necessary.
- Use CSS scroll snap where appropriate.
- Respect reduced motion.

CSS scroll snap:

```css
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

.slide {
  scroll-snap-align: start;
}
```

## Tables And Large Data Views

For large data-heavy UIs:

- Use pagination or virtualization.
- Avoid rendering thousands of rows at once.
- Use sticky headers carefully.
- Avoid complex cell renderers in every row.
- Memoize column definitions where relevant.
- Avoid inline closures in hot cell paths if they cause rerenders.
- Precompute expensive derived values.
- Keep DOM depth shallow.
- Use `table` for real tabular data unless virtualization constraints require another structure.
- Preserve accessibility when virtualizing.

## Canvas, SVG, And WebGL

Use the right rendering technology.

DOM:

- Good for semantic UI and moderate element counts.

SVG:

- Good for scalable vector graphics, icons, diagrams, moderate data visualization.
- Can become slow with many nodes.

Canvas:

- Good for many drawn objects and pixel operations.
- Requires custom accessibility and hit testing.

WebGL/WebGPU:

- Good for advanced graphics and GPU computation.
- Higher complexity.

Canvas performance:

- Batch draw calls.
- Avoid unnecessary clears.
- Scale for device pixel ratio intentionally.
- Use OffscreenCanvas in workers where supported and useful.
- Avoid reading pixels frequently.
- Use requestAnimationFrame.
- Pause when hidden.

SVG performance:

- Reduce node count.
- Avoid heavy filters.
- Avoid animating many SVG attributes.
- Use symbols/reuse where appropriate.
- Prefer CSS transforms where possible.

## JSON And Data Serialization

Large JSON can block parsing.

Best practices:

- Do not send unnecessary fields.
- Paginate large responses.
- Compress responses.
- Stream where possible.
- Avoid embedding huge JSON in HTML.
- Parse off-main-thread for very large payloads.
- Consider binary formats only when justified.
- Avoid repeated serialization in hot paths.

Use `Response.json()` for normal payloads:

```js
const data = await response.json();
```

For very large data, consider streaming NDJSON or chunked formats.

## Internationalization

Use built-in `Intl` APIs.

Examples:

```js
new Intl.NumberFormat(locale).format(number);
new Intl.DateTimeFormat(locale, options).format(date);
new Intl.RelativeTimeFormat(locale).format(-1, "day");
new Intl.ListFormat(locale).format(items);
new Intl.DisplayNames(locale, { type: "region" }).of("US");
new Intl.PluralRules(locale).select(count);
```

Performance note: create formatters once and reuse them in hot paths.

## Testing Performance

Performance testing should be repeatable.

Common practices:

- Define budgets.
- Test production builds.
- Test realistic routes.
- Test cold and warm cache.
- Test with CPU/network throttling.
- Track bundle size.
- Track Core Web Vitals.
- Track regressions in CI where possible.
- Use smoke tests for severe regressions.
- Avoid overfitting to a single Lighthouse score.

Example budgets:

- Initial JS under a defined compressed size.
- LCP under 2.5s for target percentile.
- CLS under 0.1.
- INP under 200ms.
- No individual long task over a defined threshold for critical flows.
- Image sizes capped by use case.
- Route chunks capped.

## Performance Budgets

Budgets make performance enforceable.

Budget categories:

- JavaScript bytes
- CSS bytes
- Image bytes
- Total transfer size
- Number of requests
- LCP
- INP
- CLS
- TTFB
- Long tasks
- Hydration time
- Route transition time
- Memory usage
- Third-party script cost

Budgets should be tied to user and business goals, not arbitrary perfection.

## Build And Deployment

Production configuration matters.

Best practices:

- Use production mode.
- Minify JS and CSS.
- Compress assets.
- Hash static filenames.
- Use long-term caching for immutable assets.
- Generate modern bundles.
- Avoid unnecessary polyfills.
- Remove dev-only code.
- Remove console/debug code if policy requires it.
- Ensure source maps are intentional.
- Analyze bundles.
- Avoid shipping test utilities.
- Use CDN caching.
- Verify headers.

Common headers:

```http
Content-Encoding: br
Cache-Control: public, max-age=31536000, immutable
```

Security/performance headers where appropriate:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Only use COOP/COEP when you understand cross-origin embedding implications.

## Dependency Hygiene

Dependencies have performance, security, and maintenance costs.

Best practices:

- Prefer native APIs for small tasks.
- Audit dependency size.
- Avoid duplicate packages.
- Avoid importing all locales or plugins accidentally.
- Use ESM builds.
- Keep dependencies updated.
- Avoid abandoned packages.
- Avoid packages with large transitive dependency trees for trivial functionality.
- Check whether package code is browser-friendly.
- Avoid server-only modules in client bundles.

Common replacements:

- Native `fetch` instead of HTTP clients for simple requests.
- `URLSearchParams` instead of query string libraries.
- `Intl` instead of heavy formatting libraries.
- CSS transitions instead of animation libraries for simple effects.
- Native date formatting where enough.
- `crypto.randomUUID()` instead of UUID libraries when acceptable.

## Common Anti-Patterns

Avoid:

- Rendering everything on the client when static HTML would work.
- Loading the app before showing any content.
- Huge JavaScript bundles for simple pages.
- Unbounded client-side caches.
- Large synchronous `localStorage` reads on startup.
- Heavy scroll handlers.
- Layout reads mixed with writes.
- Lazy-loading the LCP image.
- Missing image dimensions.
- Shipping uncompressed images.
- Loading many font weights.
- Icon fonts for small icon sets.
- Blocking third-party scripts.
- Hydrating static content unnecessarily.
- Rendering thousands of list items.
- Recomputing derived data on every render.
- Overusing global state.
- Overusing memoization without profiling.
- Using array indexes as unstable keys.
- Importing entire utility libraries.
- Large CSS frameworks with most rules unused.
- Complex selectors over huge DOM trees.
- Animating layout properties.
- Keeping observers/listeners alive after unmount.
- Using polling instead of observers.
- Fetching data serially when independent.
- Retrying failed requests aggressively without backoff.
- Sending analytics synchronously.
- Ignoring mobile hardware.
- Optimizing only Lighthouse while real users remain slow.

## Clean Async Patterns

Handle async work predictably.

Use `try`/`catch`:

```js
try {
  const response = await fetch("/api/items");

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return await response.json();
} catch (error) {
  showError(error);
}
```

Use aborts:

```js
async function loadData(signal) {
  const response = await fetch("/api/data", { signal });
  return response.json();
}
```

Avoid fire-and-forget promises unless intentionally handled:

```js
void sendAnalytics(event);
```

Use backoff for retries:

```js
async function retry(fn, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === attempts) throw error;

      await new Promise((resolve) => {
        setTimeout(resolve, 2 ** attempt * 100);
      });
    }
  }
}
```

## Error Handling And Performance

Failures can cause performance issues.

Best practices:

- Avoid infinite retry loops.
- Use exponential backoff.
- Abort obsolete requests.
- Cache fallback data where appropriate.
- Avoid blocking the whole UI on partial failures.
- Fail fast for invalid input.
- Keep error UI lightweight.
- Log enough to debug without excessive payloads.
- Avoid throwing inside hot render paths when validation can happen earlier.

## Responsive Design Performance

Responsive design should not load unnecessary assets.

Best practices:

- Use responsive images.
- Avoid hiding huge desktop assets on mobile after downloading them.
- Use CSS media queries and `picture` sources.
- Avoid separate DOM trees for mobile and desktop when one responsive structure works.
- Use container queries for component-level adaptation.
- Avoid JS-driven resize layout when CSS can solve it.

Example:

```html
<picture>
  <source media="(max-width: 600px)" srcset="/image-small.avif">
  <source media="(min-width: 601px)" srcset="/image-large.avif">
  <img src="/image-large.jpg" width="1200" height="800" alt="">
</picture>
```

## Privacy And Data Saver

Respect user constraints.

Best practices:

- Avoid unnecessary prefetch on constrained networks.
- Avoid autoplaying heavy media.
- Respect `Save-Data` where available.
- Provide lower-data alternatives.
- Avoid excessive analytics.
- Avoid collecting performance data with sensitive payloads.

```js
if (navigator.connection?.saveData) {
  disableNonEssentialPrefetch();
}
```

## Practical Optimization Order

A common default optimization sequence:

1. Measure the problem.
2. Identify whether the bottleneck is network, server, rendering, JavaScript, memory, or third-party code.
3. Fix the largest critical-path issue first.
4. Remove unnecessary work.
5. Defer non-critical work.
6. Split expensive work.
7. Cache carefully.
8. Optimize assets.
9. Re-measure.
10. Add budget or regression guard if the issue is likely to return.

## Default Recommendations I Would Apply Automatically

For most modern web projects, I would default to:

- Semantic HTML.
- Server-rendered or static initial content where suitable.
- Production builds with minification and compression.
- Modern ESM JavaScript.
- Route-level code splitting.
- Dynamic imports for heavy features.
- Minimal third-party scripts.
- Responsive AVIF/WebP images with dimensions.
- No lazy loading for LCP images.
- Lazy loading for below-the-fold images/iframes.
- WOFF2 fonts with `font-display`.
- System fonts unless custom fonts are needed.
- CSS Grid/Flexbox instead of JS layout.
- Container queries where useful.
- `content-visibility` for large offscreen sections when tested.
- Passive scroll/touch listeners.
- Debounced input-driven network requests.
- `AbortController` for stale async work.
- Web Workers for heavy CPU tasks.
- `Map` and `Set` for hot lookup paths.
- `Intl` APIs for formatting.
- Bounded caches.
- Cleanup for listeners, observers, workers, timers, and object URLs.
- Performance budgets in CI for serious applications.
- Real-device testing for user-facing performance work.

This is the baseline “common knowledge” I would expect to bring to performance development without needing it repeated in a project-specific guide.
