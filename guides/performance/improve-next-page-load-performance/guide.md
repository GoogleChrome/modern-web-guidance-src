---
name: improve-next-page-load-performance
description: Improve page load performance by prefetching or prerendering pages that the user is likely to visit next.
web-feature-ids:
  - speculation-rules
---

# Improve next page load performance

One of the most effective ways to improve multi-page application (MPA) navigation performance is to initiate loading the next page *before* the user finishes navigating to it, using the Speculation Rules API (`<script type="speculationrules">`).

> [!IMPORTANT]
> **Default starting configuration:** Unless a developer explicitly requests `prerender` or a more aggressive `eagerness` setting, **start with `prefetch` using `"eagerness": "moderate"`** and a `where` document rule that excludes state-changing routes. This delivers most of the navigation speed benefit while avoiding excessive bandwidth use, server load, and analytics or client-state side effects.

## How it works

Speculative loading uses JSON rules inside a `<script type="speculationrules">` element to tell the browser which same-origin navigations can be prepared ahead of time:

- **`prefetch` (Recommended default):** Fetches only the target HTML document response ahead of time without requesting subresources or executing JavaScript. Because no scripts run until the user actually navigates, `prefetch` will not trigger premature analytics pageviews, third-party beacons, or client-side state mutations.
- **`prerender` (Opt-in progression):** Fetches the HTML document, loads subresources, executes JavaScript, and renders the page in a hidden background tab for near-instant activation. Because the page executes before the user visits it, `prerender` consumes significantly more client and server resources and will fire analytics or stateful scripts early unless they are explicitly deferred until activation.

Rules match links in one of two ways (the browser infers the rule type automatically, so **do not** include the legacy `"source"` property):

- **Document rules (`"where"`):** Match `<a href>` and `<area href>` elements in the current document using URL pattern conditions (`"href_matches"`) and CSS selector conditions (`"selector_matches"`), combined with `"and"`, `"or"`, and `"not"`.
- **List rules (`"urls"`):** Specify an explicit array of URL strings to speculate.

Each rule takes an optional `"eagerness"` property that controls when speculation triggers. Note that **the default `"eagerness"` differs by rule type**:

| Eagerness | When it triggers | Default for | Recommended usage |
|---|---|---|---|
| `"moderate"` | On clear user intent (such as hovering over a link for ~200ms on desktop or pointer/viewport signals on mobile) | — | **Recommended default** for site-wide `prefetch` document rules and general `urls` list rules |
| `"conservative"` | On pointer or touch down (`pointerdown` / `mousedown`) | `where` document rules | Good for higher-cost `prerender` document rules or resource-constrained sites |
| `"eager"` | As soon as the browser observes minimal intent (before hover) | — | Only for a small, targeted set of high-probability links; **never** on site-wide `"href_matches": "/*"` rules |
| `"immediate"` | Immediately as soon as the rule is parsed | `urls` list rules | Only for a very small list (typically 1–3 URLs, and never more than 10) of near-certain next pages |

## When to use it

- **Start with `prefetch` at `"eagerness": "moderate"`:** For most MPA sites (including static sites, content sites, and server-rendered frameworks like Astro), a single document rule that prefetches same-origin links with `"eagerness": "moderate"` is the safest and most effective baseline. Because `where` document rules default to `"conservative"` when `"eagerness"` is omitted, always set `"eagerness": "moderate"` explicitly.
- **Consider `prerender` only as a second stage:** Upgrade to `prerender` only when the developer explicitly requests it or after verifying that:
  1. Analytics, ad beacons, and client-side side effects check `document.prerendering` and wait for the `prerenderingchange` event before firing.
  2. Server and CDN infrastructure can handle full subresource loads for speculated pages that the user may not visit.
- **Scope rules to static or idempotent pages:** Always exclude URLs that mutate server or session state (such as `/logout`, `/cart`, or `/admin`) or links marked with `[rel~=nofollow]`.

## How to use it

Include a `<script type="speculationrules">` block in the `<head>` or `<body>` (for example, in your site's shared layout component). Use the `"tag"` property (at the top level or per rule) so the browser sends `Sec-Speculation-Tags` in speculative request headers for server-side monitoring.

### Recommended default: Document rule for prefetching same-origin links with `moderate` eagerness

Use this pattern as the default implementation when asked to improve cross-page load performance:

```html
<!-- Recommended default: prefetch same-origin links on hover ("moderate" eagerness).
     Adapt the excluded paths and selectors below to match your site's stateful routes. -->
<script type="speculationrules">
  {
    "tag": "default-page-prefetch",
    "prefetch": [
      {
        "where": {
          "and": [
            { "href_matches": "/*" },
            { "not": { "href_matches": "/logout" } },
            { "not": { "href_matches": "/cart/*" } },
            { "not": { "href_matches": "/*\\?*(^|&)add-to-cart=*" } },
            { "not": { "selector_matches": ".no-prefetch" } },
            { "not": { "selector_matches": "[rel~=nofollow]" } }
          ]
        },
        "eagerness": "moderate"
      }
    ]
  }
</script>
```

### URL list rule for prefetching specific known next pages

When a page has a small, predictable set of likely next destinations (such as the next step in a multi-step flow or a featured article), use a `"urls"` list rule. Always specify `"eagerness"` explicitly on list rules—omitting it defaults to `"immediate"`:

```html
<!-- Explicitly set "eagerness": "moderate" (or "immediate" for 1-3 near-certain next steps),
     because "urls" list rules otherwise default to "immediate". Example URLs shown. -->
<script type="speculationrules">
  {
    "tag": "next-step-prefetch",
    "prefetch": [
      {
        "urls": ["/onboarding/step-2", "/onboarding/faq"],
        "eagerness": "moderate"
      }
    ]
  }
</script>
```

### Opt-in progression: Adding `prerender` (`moderate` or `conservative` eagerness)

If the developer explicitly requests prerendering and the site's analytics and scripts are prerender-aware, opt into `"prerender"` using `"eagerness": "moderate"` for targeted high-value links (for example, matching a selector like `.prerender-link`) while keeping `"prefetch"` with `"eagerness": "moderate"` as the default for general links—or use `"eagerness": "conservative"` (on pointerdown) when layering `"prerender"` across the same broad link set. Do not combine `"eager"` prefetching with `"moderate"` prerendering across all links (`"href_matches": "/*"`):

```html
<!-- Advanced opt-in: prefetch general same-origin links on hover ("moderate"),
     and prerender opted-in links (.prerender-link) on hover ("moderate").
     Only use prerender after ensuring analytics and stateful scripts handle document.prerendering. -->
<script type="speculationrules">
  {
    "prefetch": [
      {
        "tag": "default-page-prefetch",
        "where": {
          "and": [
            { "href_matches": "/*" },
            { "not": { "href_matches": "/logout" } },
            { "not": { "href_matches": "/cart/*" } },
            { "not": { "selector_matches": ".no-prefetch" } },
            { "not": { "selector_matches": ".prerender-link" } },
            { "not": { "selector_matches": "[rel~=nofollow]" } }
          ]
        },
        "eagerness": "moderate"
      }
    ],
    "prerender": [
      {
        "tag": "opt-in-prerender",
        "where": {
          "selector_matches": ".prerender-link"
        },
        "eagerness": "moderate"
      }
    ]
  }
</script>
```

### Deferring analytics and side effects when using `prerender`

When `prerender` is enabled, JavaScript executes while the page is still in a hidden background state (`document.prerendering === true`). Gate analytics pageviews and side-effectful logic on the `prerenderingchange` event so metrics only record pages the user actually views:

```javascript
// Defer analytics and side effects until a prerendered page is activated by the user
function recordPageView() {
  // Replace with your site's analytics call
  navigator.sendBeacon('/analytics', JSON.stringify({ url: location.href }));
}

if (document.prerendering) {
  document.addEventListener('prerenderingchange', () => recordPageView(), { once: true });
} else {
  recordPageView();
}
```

## Best Practices

- **DO** default to `prefetch` with `"eagerness": "moderate"` when adding speculative loading to a site. Treat `prerender` as a later-stage opt-in after accounting for analytics and resource implications.
- **DO** prefer `where` document rules over `urls` list rules for general site navigation so a single shared rule covers same-origin links dynamically.
- **DO** set `"eagerness"` explicitly on every rule rather than relying on browser defaults (`"where"` rules default to `"conservative"`, while `"urls"` rules default to `"immediate"`).
- **DO** exclude URLs that trigger server or session state changes (such as `/logout`, `/add-to-cart`, or account actions) and opt-out selectors (`[rel~=nofollow]`, `.no-prefetch`) from document rules using `"not"` conditions.
- **DO** include a `"tag"` property so speculative requests include the `Sec-Speculation-Tags` HTTP header for server-side observability.
- **DO** gate analytics pageviews and client-side side effects on `document.prerendering` and the `prerenderingchange` event whenever `prerender` is used.
- **DO NOT** use `"eagerness": "eager"` or `"eagerness": "immediate"` on broad document rules (`"href_matches": "/*"`). Browsers cap non-eager speculations (such as `moderate` and `conservative`) at 2 concurrent speculations on a FIFO basis, whereas `immediate` and `eager` have higher limits (up to 10) and should only be used for a small number of high-certainty URLs.
- **DO NOT** include the deprecated `"source"` property (`"source": "list"` or `"source": "document"`); it is optional in the specification and automatically inferred from `"urls"` or `"where"`.
- **DO NOT** use speculation rules for client-side routed Single Page Applications (SPAs). Speculation rules only accelerate full-document multi-page navigations (MPAs).

## Browser support and fallback strategies

{{ BASELINE_STATUS("speculation-rules") }}

Speculative loading is a progressive enhancement. If your Baseline target includes browsers that do not support the Speculation Rules API, no polyfill or JavaScript fallback is needed: unsupported browsers safely ignore `<script type="speculationrules">` tags and perform standard document navigations when links are clicked.
