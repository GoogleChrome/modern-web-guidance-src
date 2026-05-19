---
name: state-aware-sticky-headers
description: Build sticky section headers or navbars that visually transform when they're actually "stuck" at the top, changing their color scheme or gaining a shadow.
web-feature-ids:
  - container-scroll-state-queries
sources:
  - https://webstatus.dev/features/container-scroll-state-queries
---

# State-Aware Sticky Headers

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
Set `container-type: scroll-state` on the `position: sticky` element, not on its scrollable ancestor. Always specify a `container-name`, since these queries may be nested and unnamed containers will collide. You can also combine it with size queries, e.g., `container-type: scroll-state inline-size`.

```css
.sticky-container {
  position: sticky;
  top: 0;
  /* MANDATORY: Always specify a container name to avoid collisions if CQs are nested */
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

**Important:** The scroll state is queried by **descendants** of the scroll-state container. The styles in the `@container` query will not apply to the `.sticky-container` itself, but to its children (like `.sticky-header`). You cannot style the container element itself with its own scroll-state query.


### 3. Target the Stuck State
Use the `@container scroll-state(...)` query to apply styles when the header is stuck.

```css
/* Apply styles when the named container is stuck at the top */
@container section-header scroll-state(stuck: top) {
  .sticky-header {
    background: #0056b3;
    color: white;
    box-shadow: 0 4px 6px rgb(0 0 0 / 0.15);
  }
}
```

**Tip:** You can also use logical properties like `stuck: inset-block-start` or `stuck: inset-inline-start` to better support internationalization (i18n) and right-to-left (RTL) layouts by querying flow-relative edges rather than physical ones.

### Notes on Dimension Changes

Without scroll anchoring disabled, changing layout-affecting properties (height, padding, font-size) when stuck can cause visual flickering. Scroll anchoring on the in-flow content below the sticky element adjusts the scroll offset to compensate for the layout change, which pushes the element back out of its stuck position and triggers an oscillation.

Disable scroll anchoring on the scroll container to avoid this:

```css
:root {
  overflow-anchor: none;
}
```

Apply it to whichever element is the scroll container (typically `:root` for the document scroller). With this in place, you can freely change any property in the stuck state, including box-model properties and transforms.

### Fallback strategies
{{ BASELINE_STATUS("container-scroll-state-queries") }}

Scroll state queries are a progressive enhancement. In browsers that do not support `container-type: scroll-state`, the header will still stick to the top (due to `position: sticky`), but it will not visually transform. For most use cases, this is the recommended approach.

**Tip:** If your "stuck" styling requires a different background color for readability, consider setting your layout up so that the default styling works everywhere (Progressive Enhancement). If you must use a fallback, you can gate the `position: sticky` behaviour itself inside an `@supports (container-type: scroll-state)` query.

If the visual transformation is absolutely critical to the design (e.g., the stuck state introduces a background or compaction without which the content is unreadable), you can implement a robust JavaScript fallback using `IntersectionObserver`. You must duplicate your CSS styles under an `.is-stuck` class. The following generic polyfill checks `getComputedStyle` to traverse up and find the correct scroll container (defaulting to the viewport), matching the behavior of `@container scroll-state(stuck: top)`:

```javascript
function getScrollParent(node) {
  if (node == null || node === document.body || node === document.documentElement) {
    return null; // default to viewport
  }
  if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) {
    const overflow = getComputedStyle(node).overflow;
    if (overflow !== 'visible' && overflow !== 'clip') {
      return node;
    }
  }
  return getScrollParent(node.parentNode);
}

document.querySelectorAll('.sticky-container').forEach(container => {
  const root = getScrollParent(container);
  
  const topOffset = parseFloat(getComputedStyle(container).top) || 0;
  
  const observer = new IntersectionObserver(
    ([e]) => {
      // Toggle the fallback class on the sticky header container
      e.target.classList.toggle('is-stuck', e.intersectionRatio < 1);
    },
    { 
      root: root,
      threshold: [1],
      rootMargin: `-${topOffset + 1}px 0px 0px 0px` 
    }
  );
  
  observer.observe(container);
});
```

*Note: This generic IntersectionObserver pattern can also be used as a polyfill for the `scroll-state(scrollable)` query.*
