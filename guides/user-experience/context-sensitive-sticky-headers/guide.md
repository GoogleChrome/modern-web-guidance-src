---
name: context-sensitive-sticky-headers
description: Build sticky section headers or navbars that visually transform when they're actually "stuck" at the top, collapsing, changing their color scheme, gaining a shadow, or switching to a more compact layout.
web-feature-ids:
  - container-scroll-state-queries
sources:
  - https://webstatus.dev/features/container-scroll-state-queries
---

# Context-Sensitive Sticky Headers

Sticky headers are a common UI pattern, but they often need to change their appearance when they become "stuck" to maintain readability or save space. Traditional solutions required JavaScript scroll listeners, which can cause performance issues. Modern CSS allows you to handle this natively using **Scroll State Queries**.

## Implementation Steps

### 1. Create the Sticky Container
You need a container that will act as the sticky element and the container for the scroll state query.

```html
<!-- Wrap in a section to define the containment area for the sticky element -->
<div class="section">
  <div class="sticky-container">
    <div class="sticky-header">
      Section Header
    </div>
  </div>
  <div class="content">
    <!-- Content goes here -->
  </div>
</div>
```

### 2. Apply CSS for Sticky Behavior and Container Type
Define the container as `position: sticky` and set `container-type: scroll-state`. You can also combine it with size queries, e.g., `container-type: scroll-state inline-size`.

```css
.sticky-container {
  position: sticky;
  top: 0;
  /* Strongly recommended to avoid collisions with other scroll-state containers */
  container-type: scroll-state;
  container-name: section-header;
  z-index: 10;
}

.sticky-header {
  /* Base styles for the header */
  background: #f0f0f0;
  padding: 20px;
  transition: background-color 0.3s, box-shadow 0.3s;
}
```

> [!IMPORTANT]
> The scroll state is queried by **descendants** of the scroll-state container. The styles in the `@container` query will not apply to the `.sticky-container` itself, but to its children (like `.sticky-header`). You cannot style the container element itself with its own scroll-state query.


### 3. Target the Stuck State
Use the `@container scroll-state(...)` query to apply styles when the header is stuck.

```css
/* Apply styles when the named container is stuck at the top */
@container section-header scroll-state(stuck: top) {
  .sticky-header {
    background: #0056b3;
    color: white;
    box-shadow: 0 4px 6px rgba(0,0,0,0.15);
    padding: 10px 20px; /* Switch to a more compact layout */
  }
}
```

> [!TIP]
> You can also use logical properties like `stuck: inset-block-start` or `stuck: inset-inline-start` to better support internationalization (i18n) and right-to-left (RTL) layouts by querying flow-relative edges rather than physical ones.

### Notes on Dimension Changes
Changing the stuck element's box size (padding, height, font-size) is a common and valid pattern. Be aware that the browser performs a two-pass rendering update to resolve scroll-state queries, so a size change on the stuck state may produce a one-frame settle. Using `transition` on the changing properties smooths this visually. Avoid changes large enough to un-stick the element (e.g., collapsing to `height: 0`), which would cause the query to oscillate.

### Fallback strategies
{{ BASELINE_STATUS("container-scroll-state-queries") }}

Scroll state queries are a progressive enhancement. In browsers that do not support `container-type: scroll-state`, the header will still stick to the top (due to `position: sticky`), but it will not visually transform.

If the visual transformation is critical for the design or accessibility, you can use a JavaScript fallback with `IntersectionObserver` to detect when the element sticks and toggle a class.

```javascript
// Feature detection
if (!CSS.supports('container-type', 'scroll-state')) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      // Toggle class when element moves above the top edge
      entry.target.classList.toggle('is-stuck', entry.intersectionRatio < 1);
    },
    { 
      threshold: [1],
      // The -1px top margin shrinks the root's intersection rect by 1px at the top.
      // This forces the observer to fire when the sticky element (at top: 0)
      // crosses that line, dropping the intersectionRatio below 1.
      // Note: This is an approximation and assumes top: 0 and viewport scrolling.
      rootMargin: '-1px 0px 0px 0px',
      // root: document.querySelector('.scroller') // MANDATORY if scrolling inside an element instead of the viewport
    }
  );
  
  const element = document.querySelector('.sticky-container');
  if (element) {
    observer.observe(element);
  }
}
```
