---
name: css-layout
description: Action-oriented guidelines for modern CSS layouts, including Flexbox, Grid, Container Queries, and Subgrid. Use this skill when architecting responsive UI components, page layouts, or component-driven designs.
---


# CSS Layouts and Responsive Design

This skill defines standard practices for modern CSS layouts, focusing on Flexbox, Grid, Container Queries, and intrinsic sizing.

## 1. Modern Layout Fundamentals
Leverage the browser's layout engine by using intrinsic sizing before resorting to hardcoded dimensions.

### Layout Decision Matrix

| Approach | Dimensions | Main Strength | Logic Type |
| --- | --- | --- | --- |
| **Flexbox** | 1D | Content distribution | Content-first |
| **Grid** | 2D | Structural integrity | Layout-first |
| **Subgrid** | 2D (Inherited) | Grandchild alignment | Relationship-first |
| **Masonry** | 1.5D / 2D | Eliminating dead space | Flow-first |

### Summary: Quick Selection Guide
1. **Is it a simple row or column?** Use **Flexbox**.
2. **Is it a complex page structure with rows AND columns?** Use **Grid**.
3. **Does a nested element need to line up with the outer grid?** Use **Subgrid**.
4. **Are items different heights but need to be packed tightly?** Use **Masonry**.


### DOs and DON'Ts
- **DO** use Logical Properties based on **Inline Axis** (main text direction) and **Block Axis** (stacking direction) for automatic RTL support.
- **DO** choose the right display type: `flex` for one-dimensional layouts, `grid` for two-dimensional layouts.
- **DO** use the **Content-first vs Layout-first** mental model: Use Flexbox when items determine the layout (content dictates flow), and Grid when you want to define the skeleton first (layout dictates placement).
- **DO** prefer **Flexbox** for linear components (navbars, item lists) and small components.
- **DO** prefer **Grid** for two-dimensional page structures or complex component grids.
- **DO** value **Intrinsic Sizing** (`min-content`, `max-content`, `fit-content`) to allow content to naturally drive layout.
- **DO** use `shape-outside` combined with `float` to wrap text around non-rectangular shapes (polygons, circles).
- **DO** use `list-style-position: inside` to make list markers part of the content box for better multi-line alignment.

### Code Example: Shapes and Intrinsic Sizing
```css
.profile-pic {
  float: left;
  width: 150px;
  height: 150px;
  shape-outside: circle(50%); /* Text wraps around circle */
}
```

```css
.sidebar {
  width: max-content; /* Size to fit its longest word/content */
}

.main-content {
  width: fit-content; /* Expand up to available space but no further */
}
```

## 2. Flexbox


Laying out items in a single dimension (row or column).

### DOs
- **DO** use the `flex` shorthand: `flex: <grow> <shrink> <basis>` (e.g., `flex: 1 1 200px`).
- **DO** use `flex-wrap: wrap` to prevent horizontal overflow on small screens.
- **DO** prefer standard `gap` for spacing between items rather than child margins.
- **DO** use `margin-inline-start: auto` (or similar) to push items to the end of a flex container (since `justify-self` is not supported in Flexbox).

### DON'Ts
- **DON'T** use `justify-self` or `align-self` when `margin: auto` can achieve the same result more robustly.
- **DON'T** use `order` or `flex-direction: row-reverse` to change visual order if it breaks the logical tab flow for keyboard users.

### Code Example: Flexbox Component

```css
.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.card-item {
  flex: 1 1 250px; /* Grow, shrink, base size */
}

.card-item-action {
  margin-inline-start: auto; /* Push push button to the right */
}
```

## 3. CSS Grid and Subgrid


Two-dimensional layout control.

### DOs
- **DO** use the `fr` unit to distribute available fractional space proportionally.
- **DO** use `minmax(min, max)` to ensure tracks are flexible but bounded (e.g., `repeat(auto-fill, minmax(200px, 1fr))`).
- **DO** use `grid-template-areas` for complex, readable layout definitions.
- **DO** use **Subgrid (`grid-template-rows: subgrid`)** to align nested children to the parent grid definition.
- **DO** use **Subgrid** to solve the "ragged edge" problem in components like card lists where internal elements (like titles) must line up perfectly across columns.

### DON'Ts
- **DON'T** use `grid-auto-flow: dense` blindly; it can reorder items visually and break accessibility DOM order.
- **DON'T** use explicit fixed widths inside grid tracks if `fr` or `minmax` can handle it.

### Code Example: Grid and Subgrid

```css
.page-layout {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-areas:
    "header header header"
    "sidebar main main"
    "footer footer footer";
  gap: 1.5rem;
}

.card {
  display: grid;
  grid-template-rows: subgrid; /* Align card internal layout to parent */
  grid-span: 3;
}
```

## 4. Container Queries and Advanced Sizing
Querying the size of a parent container rather than the viewport for component-level adaptability.

### DOs and DON'Ts
- **DO** use `container-type: inline-size` on a wrapper to enable width-based queries for children.
- **DO** use the full set of container units: `cqi` (inline), `cqb` (block), `cqw` (width), `cqh` (height), `cqmin`, and `cqmax`.
- **DO** remember that container units default to standard viewport units (`svw`/`svh`) if no container parent is found.
- **DON'T** read layout size inside a query that modifies the container itself (infinite loop risk).

### Code Example: Container Responsive Component
```css
/* Define container */
.card-wrapper {
  container-type: inline-size;
}

/* Adapt child based on parent width */
@container (min-width: 400px) {
  .card-content {
    display: flex;
    gap: 2rem;
  }
}

.item-title {
  font-size: 4cqi; /* Fluid based on container size */
}
```

### Responsive Triggers Decision Matrix

| Feature | Container Queries (`@container`) | Media Queries (`@media`) |
|---|---|---|
| **Reference** | Nearest containment parent | Global Viewport |
| **Reusability** | ✅ High | ❌ Low |
| **Typical Use Case** | Adaptive cards, sidebar widgets | Page layout grids, Navigation breakpoints |

**Single-Sentence Mental Model**: "Container Queries = Component context, Media Queries = Global page layout."

## 5. Native Overlays and Stacking Contexts
Manage overlays and layering predictably using native primitives instead of complex JavaScript.

### DOs and DON'Ts
- **DO** use the `popover` attribute for menus and tooltips (non-modal content).
- **DO** use `<dialog>` and `.showModal()` for modal interactions that require focus entrapment.
- **DO** use `anchor-size()` to size popovers dynamically relative to their anchor dimensions.
- **DO** use `position-try-fallbacks: flip-block` to let the browser automatically reposition when an overlay overflows viewport edges.
- **DO** use `pointer-events: none` to let clicks pass through decorative overlays or ignore inert layers.

### Code Example: Popovers and Anchors
```css
/* Tethering a popover to match trigger width */
#trigger { 
  anchor-name: --my-anchor; 
}

[popover] {
  position: absolute;
  position-anchor: --my-anchor;
  position-area: bottom span-right;
  width: anchor-size(width);
  position-try-fallbacks: flip-block; /* Native overflow handling */
}
```

### Overlay Mechanics Decision Matrix

| Feature | Popover API (`popover`) | `<dialog>` |
|---|---|---|
| **Modality** | Non-modal (Doesn't block background) | Modal (Blocks background via `.showModal()`) |
| **Focus Trapping** | ❌ Natural tab flow | ✅ Locks focus inside dialog |
| **Light-Dismiss** | ✅ Auto-closes on click-outside / ESC | ❌ Requires JS / Form submit |

**Single-Sentence Mental Model**: "Popover = Transient/Non-modal (Flyouts, Toasts), `<dialog>` = Blocking/Modal (Requires action)."


## 6. Overflow Tracking and Layout Stability

Manage layout shifts and scroll conditions predictably.

### DOs and DON'Ts
- **DO** use `overflow: auto` to only show scrollbars when necessary.
- **DO** use `scrollbar-gutter: stable` to reserve space for scrollbars and prevent jarring layout shifts when content grows.
- **DO** use `overflow: clip` instead of `hidden` when you want to clip content without allowing any programmatic scrolling (acts as a performance hack).
- **DO** use `-webkit-line-clamp` combined with `display: -webkit-box` for multi-line truncation.
- **DO** use `touch-action` (e.g., `pan-y` or `pan-x`) to optimize scrolling interactions on mobile.

### DON'Ts
- **DON'T** use `overflow: scroll` habitually as it forces scrollbars even if they aren't needed.

### Code Example: Layout Stability

```css
.scrollable-list {
  max-height: 400px;
  overflow-y: auto;
  scrollbar-gutter: stable; /* Reserve space for scrollbars */
}

.snippet {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden; /* Multi-line truncation */
}
```


## 7. Advanced Layout Metrics and Viewport Mechanics
Manage edge cases involving mobile viewport shifts and track distributions.

### DOs and DON'Ts
- **DO** use **Dynamic Viewport Units** (`dvh`, `svh`, `lvh`) for mobile layout containers to account for browser UI shifting (URL bars expanding/collapsing).
- **DO** understand the difference between `auto-fill` and `auto-fit` in CSS Grid:
  - `auto-fill` creates tracks even if they are empty (keeps empty space preserved).
  - `auto-fit` collapses empty tracks (stretches filled tracks to cover full width).
- **DO** use `ch` units for `max-width` on text blocks to maintain optimal reading lengths (~60-70 characters).
- **DON'T** use `width: 100vw` blindly on mobile devices as it may ignore vertical scrollbars and cause horizontal overflow. Use `%` or `100i` where applicable.

### Code Example: Advanced Viewport and Grid
```css
/* Mobile friendly full viewport */
.hero-mobile {
  height: 100dvh; /* Accounts for dynamic URL bars */
}

/* Track distribution spanning gap */
.stretching-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* Fill full container */
}

.filling-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); /* Keep track gaps */
}
```
