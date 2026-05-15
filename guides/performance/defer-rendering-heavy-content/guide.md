---
name: defer-rendering-heavy-content
description: Reduce rendering times in content-heavy web pages (e.g. pages with long feeds, lots of articles, or complex dashboards), by deferring rendering for any content that is not immediately visible to the user.
web-feature-ids:
  - hidden-until-found
  - content-visibility
---

# Defer rendering heavy content

Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.

To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.

## When to use which

| Scenario / Example | Feature Applied | Performance Benefit |
| :--- | :--- | :--- |
| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
| **3. Searchable & Deferred** (Collapsible specs/FAQ) | **`hidden="until-found"`** | Same benefits as previous, defers load-time rendering fully, but remains searchable via native Find-in-page. The browser automatically unhides and scrolls to the target on match. |

## How to implement `content-visibility: auto`

### Choosing off-screen content

**MANDATORY**: You MUST carefully identify which elements receive `content-visibility: auto`.
- **DO** target large, self-contained layout blocks that are strictly **below the initial fold** (e.g., card items in an infinite feed, trailing comments, or bottom-heavy layout sections).
- **DO NOT** apply this property to elements within the initial, above-the-fold viewport. Doing so forces the browser to evaluate visibility boundaries before rendering, which paradoxically delays critical page load performance.
- **DO** target elements with deep or complex internal DOM structures to maximize rendering cost savings.

### Implementation steps

1. **MANDATORY**: Identify heavy sections that are confirmed to be off-screen on initial load.
2. **MANDATORY**: Apply `content-visibility: auto` to each of these off-screen elements.
3. **MANDATORY**: Provide an estimated layout structure size using `contain-intrinsic-size` on each element.

### How to use `contain-intrinsic-size`

**MANDATORY**: You MUST pair `content-visibility: auto` with `contain-intrinsic-size`. Failure to do so forces the browser to collapse the element to a 0px height when off-screen, causing severe layout shifting and scrollbar jumping as the user scrolls.

The `contain-intrinsic-size` CSS shorthand property acts as a placeholder dimension. Using the `auto` keyword enables the browser to "remember" the exact size once the element is finally rendered, using that calculated size over the placeholder if the element goes off-screen again.

### Example code

```css
/* DO ONLY apply this class to items OUTSIDE the initial layout viewport */
.heavy-section-deferred {
  /* MANDATORY: Skips rendering calculations when off-screen */
  content-visibility: auto;
  
  /* Mandatory: Provide an estimated size to prevent layouts shifts.
    - 'auto' is optional and enables the browser to remember the actual size
      once rendered. It must be paired with a <length> value to be used for
      the first render.
    - 'none' tells the browser not to apply any intrinsic width to this element.
      It can be used for either the height or the width value.
    - '150px' is the estimated height of this element. This can be any valid
      CSS <length> value.
   */
  contain-intrinsic-size: auto none auto 150px; 
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

## Fallback strategies

### `content-visibility` fallback

{{ BASELINE_STATUS("content-visibility") }}

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

{{ BASELINE_STATUS("hidden-until-found") }}

When `hidden="until-found"` is not supported elements will remain hidden. Use feature detection targeting `onbeforematch` and extract or reveal content accordingly. Feature detection MUST check for the existence of `onbeforematch` in `HTMLElement.prototype`.

```javascript
if (!('onbeforematch' in HTMLElement.prototype)) {
  document.querySelectorAll('[hidden="until-found"]').forEach(el => {
    // Unsupported browsers show content to maintain searchability
    el.removeAttribute('hidden'); 
  });
}
```
