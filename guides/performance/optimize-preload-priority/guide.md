---
name: optimize-preload-priority
description: Preload critical initial assets—such as late-discovered LCP images, essential fonts, stylesheets, and ES module scripts—and tune their relative loading priority to reduce load delays.
web-feature-ids:
    - fetch-priority
    - link-rel-preload
    - modulepreload
---

# Optimize preload priority

Preloading resources with `<link rel="preload">` or `<link rel="modulepreload">` tells the browser to discover and fetch critical assets early before the HTML parser or runtime scripts would otherwise encounter them. Because preloads inherit the default network priority of their resource destination (which is low for images) and static ES module imports form a dependency graph, pairing preload hints with `fetchpriority` controls both early discovery and relative bandwidth priority.

> [!NOTE]
> Preload hints speed up *discovery* of late-found resources and static ES module graphs; to reprioritize `<script>` or `<img>` elements that the HTML parser has already discovered, see {{ GUIDE_REF("optimize-script-priority") }} and {{ GUIDE_REF("optimize-image-priority") }}.

## How to implement

1. **Identify late-discovered critical assets**: Find assets needed for initial rendering or interactivity that the HTML preload scanner cannot discover immediately—such as LCP images referenced in CSS or `<video poster>`, critical web fonts, stylesheets hidden behind `@import` or injected at runtime, and entry ES modules with static imports.
2. **Elevate critical image preloads**: Image preloads default to low priority. Add `fetchpriority="high"` to `<link rel="preload" as="image">` for the LCP candidate so it starts earlier and receives more bandwidth.
3. **Preload critical stylesheets and fonts**: Use `<link rel="preload" as="style">` for critical CSS discovered late (via `@import` or runtime injection), optionally adding `fetchpriority="high"` for critical styles or `fetchpriority="low"` when warming non-critical stylesheets. Critical fonts (`as="font"`) already default to high priority—omit `fetchpriority="high"` on them, use `fetchpriority="low"` on secondary fonts, and always include `crossorigin` (even when same-origin).
4. **Preload ES module graphs with `modulepreload`**: Use `<link rel="modulepreload">` (never `<link rel="preload" as="script">`) for ES modules so the browser fetches, parses, and compiles the module graph. Add `fetchpriority="high"` to prioritize critical interactive entry modules and imports ahead of background scripts, or `fetchpriority="low"` to warm non-critical background modules without contending with initial assets.

## Example code

```html
<!-- Elevate priority for a video poster or CSS background image acting as the LCP candidate -->
<link rel="preload" href="/images/video-poster.jpg" as="image" fetchpriority="high">

<!-- Critical font defaults to high priority; always include crossorigin even when same-origin -->
<link rel="preload" href="/fonts/brand-font.woff2" as="font" type="font/woff2" crossorigin>

<!-- Deprioritize a secondary font to avoid contending with critical initial assets -->
<link rel="preload" href="/fonts/secondary-font.woff2" as="font" type="font/woff2" fetchpriority="low" crossorigin>

<!-- Preload critical CSS discovered late (e.g., via @import or runtime injection) -->
<link rel="preload" href="/styles/critical-theme.css" as="style" fetchpriority="high">

<!-- Fetch and parse a critical interactive ES module graph at high priority -->
<link rel="modulepreload" href="/js/interactive-app.js" fetchpriority="high">

<!-- Warm a non-critical background ES module at low priority -->
<link rel="modulepreload" href="/js/background-sync.js" fetchpriority="low">
```

## Best practices

- **MANDATORY**: Use `fetchpriority="high"` on Largest Contentful Paint (LCP) image preloads, capped at 1–2 critical image preloads so priority boosts are not diluted.
- **MANDATORY**: Use `<link rel="modulepreload">` instead of `<link rel="preload" as="script">` for ES modules. `preload as="script"` does not preload static `import` dependencies and can trigger a duplicate fetch if its credentials mode (`crossorigin`) mismatches `<script type="module">`.
- **DO** cap preloads **per resource type**—such as at most 1–2 critical images, 2–3 essential fonts, 1–2 late-discovered critical stylesheets, and critical entry/import modules—to prevent bandwidth contention without omitting needed CSS or module preloads.
- **DO** use `<link rel="preload" as="style">` for critical CSS discovered late (`@import` chains or runtime-injected stylesheets), and `fetchpriority="low"` when preloading non-critical stylesheets or secondary fonts.
- **DO** omit `fetchpriority="high"` on critical font preloads (fonts already default to high priority) and always include the `crossorigin` attribute on `<link rel="preload" as="font">`—even for same-origin fonts.
- **DO** specify the `as` attribute accurately on `<link rel="preload">` so request headers, credentials, and cache keys match the consumer (`<link rel="modulepreload">` defaults to a script-like module destination without needing `as`).
- **DO** prefer making critical resources directly discoverable in static HTML (`<img>`, `<link rel="stylesheet">`, `<script type="module">`) rather than relying on preloads when markup can be authored directly.
- **DO NOT** use the deprecated `importance` attribute; it has been replaced by `fetchpriority`.

## Fallback strategies

### Fetch priority

{{ BASELINE_STATUS("fetch-priority") }}

If your Baseline target does not support `fetchpriority`, treat it as a progressive enhancement on `<link rel="preload">` and `<link rel="modulepreload">`. Browsers without support ignore `fetchpriority` and still fetch the preloaded resource using their default priority for that destination, provided `<link rel="preload">` sets valid `as` (and `type` / `crossorigin` where required).

### Preloading ES modules

{{ BASELINE_STATUS("modulepreload") }}

`<link rel="modulepreload">` is a progressive discovery hint that requires no fallback; always keep the executing `<script type="module">` entry point in the document.
