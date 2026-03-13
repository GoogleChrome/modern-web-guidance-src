---
name: defer-rendering-heavy-content
description: Reduce rendering times in content-heavy web pages (e.g. pages with long feeds, lots of articles, or complex dashboards), by deferring rendering for any content that is not immediately visible to the user.
web-feature-ids:
  - hidden-until-found
  - content-visibility
---

# Defer rendering heavy content

Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles—can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.

To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.

## When to use which

| Scenario / Example | Feature Applied | Performance Benefit |
| :--- | :--- | :--- |
| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
| **3. Searchable & Deferred** (Collapsible specs/FAQ) | **`hidden="until-found"`** | Same benefits as previous, defers load-time rendering fully, but remains searchable via native Find-in-page. The browser automatically unhides and scrolls to the target on match. |

## How to implement `content-visibility: auto`

1. **Identify heavy sections:** Locate large, self-contained layout blocks that are initially off-screen (e.g., card items in an infinite feed).
2. **Apply CSS:** Add `content-visibility: auto` and provide an estimated height or width using `contain-intrinsic-size`.

### Example code

```css
.heavy-section {
  /* Skips rendering calculations when off-screen */
  content-visibility: auto;
  
  /* Mandatory: Provide an estimated height to prevent layouts shifts */
  contain-intrinsic-size: 0px 500px; 
}
```

## How to implement `content-visibility: hidden`

1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
2. **Apply CSS:** Add `content-visibility: hidden` to the element.
3. **Reveal the element:** When the element should be revealed, change the `content-visibility` property to `visible` or `auto`.

### Example code

```css
.cached-view {
  /* Hides content but caches rendering state */
  content-visibility: hidden;
}

.cached-view.is-active {
  content-visibility: visible;
}
```

Because `content-visibility: hidden` excludes the element and its children from the accessibility tree and find-in-page search, **DO NOT** use it if the content must remain discoverable while hidden. For searchable hidden content, use `hidden="until-found"`.

## How to implement `hidden="until-found"`
  
The `hidden="until-found"` attribute forces the browser to apply an internal `content-visibility: hidden` rule. This hides content until a user utilizes "Find in page" or navigates via document fragments directly into the container.

1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
2. **Apply the attribute:** Add `hidden="until-found"` directly onto the collapsible container element.
3. **Handle state synchronization:** If reveal states require DOM updates (such as toggling an aria-expanded attribute or rotating a chevron icon), use the `beforematch` event listener.

### Example code

```html
<div class="heavy-section" hidden="until-found">
  <p>Heavy content.</p>
</div>
```

```javascript
// Optional: Handle state synchronization
const heavySection = document.querySelector('.heavy-section');

heavySection.addEventListener('beforematch', (event) => {
  // Logic to execute immediately before the browser reveals the match
});
```

## Best Practices

- **DO** use `contain-intrinsic-size` with `content-visibility: auto`. Failure to do so forces height recalculations on scroll, causing viewport layout jumping or visual glitches.
- **DO NOT** apply `content-visibility: auto` to elements inside the initial fold viewport, as this delays critical page rendering.
- **DO NOT** apply standard `display: none` or `visibility: hidden` to elements designed to use `hidden="until-found"`, as this permanently excludes them from search discovery.
- **DO** verify that `hidden="until-found"` handles interactive states gracefully on trigger.

## Browser support and fallback strategies

{{ BASELINE_STATUS("content-visibility") }}

{{ BASELINE_STATUS("hidden-until-found") }}

### `content-visibility` fallback

When `content-visibility` is not supported it will be ignored by the browser. In most cases `content-visibility: auto` will not need a fallback, though without it performance gains will be lost. An unsupported browser will leave `content-visibility: hidden` elements completely visible. Use feature detection to implement a fallback.

```css
/* Default for everyone */
.inactive {
  display: none;
}

/* Modern Browsers only */
@supports (content-visibility: hidden) {
 .inactive {
    display: block; /* Turn the layout box back on */
    content-visibility: hidden;
  }
}
```

### `hidden="until-found"` fallback
When `hidden="until-found` is not supported elements will remain hidden.Use feature detection targeting `onbeforematch` and extract or reveal content accordingly.

```javascript
if (!('onbeforematch' in HTMLElement.prototype)) {
  document.querySelectorAll('[hidden="until-found"]').forEach(el => {
    // Unsupported browsers show content to maintain searchability
    el.removeAttribute('hidden'); 
  });
}
```
