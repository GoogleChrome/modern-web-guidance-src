---
name: fluid-scaling
description: Scale items like font size, spacing, and media sizes smoothly based on the parent container's size rather than using fixed breakpoints
web-feature-ids:
  - container-queries
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries
  - https://css-tricks.com/css-container-queries/
  - https://www.joshwcomeau.com/css/container-queries-introduction/
  - https://web.dev/learn/css/container-queries
  - https://www.joshwcomeau.com/css/container-queries-unleashed/
  - https://frontendmasters.com/blog/container-queries-and-units/
  - https://www.smashingmagazine.com/2024/06/what-are-css-container-style-queries-good-for/
  - https://web.dev/articles/baseline-in-action-fluid-type
  - https://web.dev/blog/how-to-use-container-queries-now
---

## Overview

Fluid scaling allows components to adapt their internal proportions (like font sizes and spacing) smoothly as their container resizes. This creates a more cohesive design than jumping between fixed breakpoints. This approach is recommended because it ensures components look good regardless of where they are placed in a layout, promoting component isolation and reusability.

## Implementation

### 1. Define a container

To use container query units, you must first define a containment context on a parent element.

```css
.component-wrapper {
  /* Define the container type. Use 'inline-size' for width-based scaling. */
  /* You can also use 'size' for both width and height, but it requires explicit sizing. */
  container-type: inline-size;
  
  /* Optional: Name the container for specific targeting */
  container-name: fluid-card;
}
```

### 2. Use container query units

Use container query units (`cqi`, `cqb`, etc.) to set sizes relative to the container's dimensions.

*   `cqi`: 1% of the container's inline size (width in horizontal writing modes).
*   `cqb`: 1% of the container's block size (height in horizontal writing modes).

**Note**: Container units can be used directly on any property without needing an `@container` query rule. They automatically resolve based on the nearest ancestor with a defined `container-type`.

```css
.component-title {
  /* Scale font size based on container width */
  /* 10cqi means 10% of the container's width */
  font-size: 10cqi;
}

.component-body {
  /* Scale padding based on container width */
  padding: 5cqi;
}
```

### 3. Constrain values with `clamp()`

To prevent sizes from becoming too small or too large, use the CSS `clamp()` function.

```css
.component-title {
  /* Clamp font size between 1rem and 3rem, scaling with 5% of container width */
  font-size: clamp(1rem, 5cqi, 3rem);
}
```

### Fallback strategies

{{ BASELINE_STATUS("container-queries") }}

If container queries are not supported by the browser, you should provide a fallback using viewport units or standard media queries.

```css
.component-title {
  /* Fallback for browsers that do not support container units */
  font-size: clamp(1rem, 5vw, 3rem);
}

@supports (font-size: 1cqi) {
  .component-title {
    /* Use container units where supported */
    font-size: clamp(1rem, 5cqi, 3rem);
  }
}
```

This fallback ensures that the text still scales, but it will be based on the screen width rather than the component's width. This is usually a safe fallback.
