---
name: scrollability-affordance-hints
description: Build scroll-shadow overlays, gradient fades, or directional arrow indicators that appear only when there's actually more content to scroll to in that direction.
web-feature-ids:
  - container-scroll-state-queries
---

# Scrollability Affordance Hints

## Overview

Visual hints, like shadows or gradients, help users understand that they can scroll to see more content. This guide shows how to build these hints using CSS `container-scroll-state-queries`, which allows styling elements based on the scrollable state of their container without relying on JavaScript scroll listeners or observers.

## Implementation

### 1. Establish the Scroll Container

The scroll container must be declared as a scroll-state query container.

```css
.scroller {
  overflow-y: auto;
  /* Establish this element as a scroll-state query container */
  container-type: scroll-state;
  position: relative;
}
```

### 2. Style the Indicators

Place the indicator elements (like shadows, gradients, or arrows) inside the container and style them. By default, they should not be visible. When they are shown, they should not be interactive, by setting `pointer-events: none`.

```css
.indicator-top, .indicator-bottom {
  position: sticky;
  left: 0;
  right: 0;
  height: 20px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none; /* Let clicks pass through */
}

.indicator-top {
  top: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.2), transparent); /* Example: Shadow */
}

.indicator-bottom {
  bottom: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.2), transparent); /* Example: Shadow */
}
```

### 3. Query the Scroll State

Use the `@container` rule with the `scroll-state` function. Check if the container is scrollable up or down to show the respective indicator.

```css
/* Show top indicator when the user can scroll up */
@container scroll-state(scrollable: top) {
  .indicator-top {
    opacity: 1;
  }
}

/* Show bottom indicator when the user can scroll down */
@container scroll-state(scrollable: bottom) {
  .indicator-bottom {
    opacity: 1;
  }
}
```

## Accessibility considerations

Scrollability affordance hints are intended to supplement existing browser behaviour and help people be aware of larger scrollable regions. As a result of these hints being supplemental, and secondary to the primary hint (which would be the default scrollbar, or a sufficiently contrasting custom scrollbar), these scrollability affordance hints do not have to meet a specific contrast threshold. If the author wants to remove the scrollbar (which is not recommended for many usability reasons), then the scrollability affordance hint must have a contrast ratio of 3:1 against any immediately adjacent colours (to meet WCAG success criterion 1.4.11 Non-text Contrast), so that people are able to easily determine that scrolling is possible.

## Fallback strategies

{{ BASELINE_STATUS("container-scroll-state-queries") }}

### Basic Fallback
If the feature is not supported, the indicators will remain invisible.
When these are hints and not critical for functionality, it can be acceptable to omit them in unsupported browsers.

### CSS-only fallback (background attachment)
If the scroller has a solid background color, draw the hints with backgrounds instead. This works in every browser and needs no JavaScript or extra elements.
Each shadow is a `scroll` background, which stays at the edge of the scrollport.
Each shadow has a cover: a `local` background in the scroller's own color, which scrolls with the content.
At either end of the content its cover sits on top of its shadow and hides it; once the user scrolls away from that end, the cover moves away and the shadow shows.

```css
@supports not (container-type: scroll-state) {
  .scroller {
    background:
      /* Covers: scroll with the content. Must use the scroller's own background color. */
      linear-gradient(var(--surface) 30%, transparent) top / 100% 2.5rem no-repeat local,
      linear-gradient(transparent, var(--surface) 70%) bottom / 100% 2.5rem no-repeat local,
      /* Shadows: stay at the edges of the scrollport */
      radial-gradient(farthest-side at 50% 0, rgb(0 0 0 / .2), transparent) top / 100% .75rem no-repeat,
      radial-gradient(farthest-side at 50% 100%, rgb(0 0 0 / .2), transparent) bottom / 100% .75rem no-repeat,
      var(--surface);
  }
}
```

The hints paint behind the content, so content with its own opaque background hides them. Prefer this fallback over the Intersection Observer one whenever the scroller has a solid background.

### Advanced Fallback (Intersection Observer)

If the hints are required, use an `IntersectionObserver` to toggle classes when sentinel elements at the top and bottom of the scroller move in and out of the scrollport.

Use empty sentinels rather than the first and last children: a child larger than the scroller is never fully visible, and sticky indicators inside the scroller are always visible. Observe the first and last children (with `threshold: 1`) instead only when no child can be larger than the scroller and the indicators are not children of the scroller, e.g. a row of tabs whose hint is a mask on the scroller itself.

```html
<!-- Sentinel elements placed at the ends of the scroller -->
<div class="sentinel-top"></div>
<!-- Content goes here -->
<div class="sentinel-bottom"></div>
```

```css
/* Marker styling to ensure it does not affect layout */
.sentinel-top, .sentinel-bottom {
  height: 0;
  width: 0;
  visibility: hidden;
}

.scroller.scrolled-down .indicator-top {
  opacity: 1;
}

.scroller.can-scroll-down .indicator-bottom {
  opacity: 1;
}
```

```javascript
if (!CSS.supports('container-type', 'scroll-state')) {
  const topSentinel = document.querySelector('.sentinel-top');
  const bottomSentinel = document.querySelector('.sentinel-bottom');
  const scroller = document.querySelector('.scroller');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.target === topSentinel) {
        // If top sentinel is not intersecting, we have scrolled down
        scroller.classList.toggle('scrolled-down', !entry.isIntersecting);
      }
      if (entry.target === bottomSentinel) {
        // If bottom sentinel is intersecting, we reached the bottom
        scroller.classList.toggle('can-scroll-down', !entry.isIntersecting);
      }
    });
  }, { root: scroller });

  observer.observe(topSentinel);
  observer.observe(bottomSentinel);
}
```
