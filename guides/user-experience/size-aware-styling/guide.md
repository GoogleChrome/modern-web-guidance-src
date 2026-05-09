---
name: size-aware-styling
description: Build a component whose styles can be conditionally dependent on its own width or height, rather than the width or height of the viewport. For example a card component that can change its layouts depending on how large it is, or a call-to-action button that can conditionally display helper text based on its width.
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
  - https://web.dev/articles/baseline-in-action-container-queries
  - https://web.dev/blog/how-to-use-container-queries-now
---

## Overview

Size-aware styling allows components to change their layout or appearance based on the space available to them, rather than the size of the whole screen. This is useful for components like cards or navigation bars that might be placed in different parts of a layout (like a narrow sidebar or a wide main area).

Using container queries is recommended because it makes components truly modular. You do not need to know where the component will live or write complex media queries to handle every possible layout.

## Implementation

### 1. Define the container

MANDATORY: You must first tell the browser which element is the container to be measured.

```css
.card-container {
  /* Define the container type. Use 'inline-size' for width-based queries. */
  /* You can also use 'size' for both width and height, but it requires explicit sizing. */
  container-type: inline-size;
}
```

### 2. Apply styles based on container size

Use the `@container` rule to apply styles when the container reaches a certain size.

```css
/* Default styles for small containers (stacked layout) */
.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Styles for larger containers (side-by-side layout) */
/* This triggers when the container is wider than 400px */
@container (min-width: 400px) {
  .card {
    flex-direction: row;
    align-items: center;
  }
  
  .card-image {
    width: 150px;
    height: 150px;
  }
}
```

### 3. Conditionally show content

You can also use container queries to hide or show extra details when there is more room.

```css
.card-details {
  /* Hide extra details by default in small spaces */
  display: none;
}

@container (min-width: 600px) {
  .card-details {
    /* Show details when there is plenty of room */
    display: block;
  }
}
```

### Fallback strategies

{{ BASELINE_STATUS("container-queries") }}

For browsers that do not support container queries, the best approach is to use a safe default layout (like the stacked vertical layout) and progressively enhance it using media queries if the general screen size allows it.

```css
/* Default safe stacked layout */
.card {
  display: flex;
  flex-direction: column;
}

/* Fallback using media queries for older browsers */
@media (min-width: 600px) {
  .card {
    flex-direction: row;
  }
}

/* Overwrite with container queries where supported */
@supports (container-type: inline-size) {
  @media (min-width: 600px) {
    .card {
      /* Reset media query fallback if needed, or let container query handle it */
      flex-direction: column;
    }
  }
  
  @container (min-width: 400px) {
    .card {
      flex-direction: row;
    }
  }
}
```

This ensures that users on older browsers still get a usable layout, even if it does not adapt perfectly to every specific container width.
