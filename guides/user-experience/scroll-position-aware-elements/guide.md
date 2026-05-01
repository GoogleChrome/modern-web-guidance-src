---
name: scroll-position-aware-elements
description: Build floating buttons or widgets (back-to-top, scroll-to-bottom, chat launchers, etc.) that appear and disappear based on whether the user has scrolled at all.
web-feature-ids:
  - container-scroll-state-queries
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Conditional_rules/Container_scroll-state_queries
  - https://developer.chrome.com/blog/css-scroll-state-queries
  - https://css-tricks.com/scrollytelling-on-steroids-with-scroll-state-queries/
  - https://una.im/scroll-state-scrolled
---

## Overview

Floating buttons, like a "Back to Top" link, improve user experience by appearing only when they are useful. This guide shows how to build these elements using CSS `container-scroll-state-queries`, which allows styling elements based on the scroll position of their container without relying on JavaScript scroll listeners.

## Implementation

### 1. Establish the Scroll Container

The scroll container must be declared as a scroll-state query container.

```css
.scroller {
  overflow-y: auto;
  /* Establish this element as a scroll-state query container */
  container-type: scroll-state;
}
```

### 2. Style the Floating Element

Place the element inside the container and style it. By default, it should be hidden.

```css
.back-to-top {
  position: sticky;
  bottom: 20px;
  opacity: 0;
  transition: opacity 0.3s ease;
}
```

### 3. Query the Scroll State

Use the `@container` rule with the `scroll-state` function. To check if the user has scrolled down, check if the container is scrollable to the top.

```css
/* When the container can be scrolled toward the top, it means the user has scrolled down */
@container scroll-state(scrollable: top) {
  .back-to-top {
    opacity: 1;
  }
}
```

## Fallback strategies

{{ BASELINE_STATUS("container-scroll-state-queries") }}

### Basic Fallback
If the feature is not supported, the floating element will remain invisible because of the default `opacity: 0`. To ensure functionality, you can choose to make the element always visible in unsupported browsers.

```css
/* Fallback for browsers that do not support the feature */
.back-to-top {
  opacity: 1; /* Always visible */
}

/* Override for supported browsers to handle dynamic visibility */
@supports (container-type: scroll-state) {
  .back-to-top {
    opacity: 0;
  }
  
  @container scroll-state(scrollable: top) {
    .back-to-top {
      opacity: 1;
    }
  }
}
```

### Advanced Fallback (Intersection Observer)
If dynamic visibility is required, use an `IntersectionObserver` to toggle a class when a sentinel element at the top of the scroller goes out of view.

```html
<!-- Sentinel element placed at the top of the scroller -->
<div class="scroll-sentinel"></div>
```

```css
/* Marker styling to ensure it does not affect layout */
.scroll-sentinel {
  height: 0;
  width: 0;
  visibility: hidden;
}

.scrolled .back-to-top {
  opacity: 1;
}
```

```javascript
const sentinel = document.querySelector('.scroll-sentinel');
const scroller = document.querySelector('.scroller');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    // If the sentinel is NOT intersecting, it means the user has scrolled down
    if (!entry.isIntersecting) {
      scroller.classList.add('scrolled');
    } else {
      scroller.classList.remove('scrolled');
    }
  });
}, { root: scroller });

observer.observe(sentinel);
```
