---
name: css-layout
description: Modern CSS layouts such as flex-box, grid, subgrid, container queries, anchor positioning, and intrinsic sizing. Use this skill when architecting responsive UI components, page layouts, or component-driven designs.
---

# CSS Layouts and Responsive Design

This skill defines standard practices for modern CSS layouts. Coverage focuses on flex-box, grid, subgrid, container queries, anchor positioning, intrinsic sizing, and modern viewport units. Each feature is annotated with its current Baseline status so that fallbacks can be applied only where they're actually needed — modern CSS rarely needs a polyfill, but it does need feature detection at the bleeding edges (e.g., subgrid, anchor positioning, masonry).

[1 Fundamentals](#1-fundamentals)
[1.1 Decision matrix](#11-decision-matrix)
[1.2 Quick selection guide](#12-quick-selection-guide)
[1.3 Working principles](#13-working-principles)
[2 Flexbox](#2-flexbox)
[2.1 Available properties for the container](#21-available-properties-for-the-container)
[2.2 Available properties for the child items](#22-available-properties-for-the-child-items)
[2.3 Code example: flex-box component](#23-code-example-flex-box-component)
[3 Grid and subgrid](#3-grid-and-subgrid)
[3.1 Available properties for the container](#31-available-properties-for-the-container)
[3.2 Available properties for the child items](#32-available-properties-for-the-child-items)
[3.3 Subgrid](#33-subgrid)
[3.4 Code example: grid and subgrid](#34-code-example-grid-and-subgrid)
[3.5 Fallback: subgrid strategy](#35-fallback-subgrid-strategy)
[4 Container queries](#4-container-queries)
[4.1 Code example: fluid typography using container query units](#41-code-example-fluid-typography-using-container-query-units)
[4.2 Responsive triggers decision matrix](#42-responsive-triggers-decision-matrix)
[5 Native overlays, anchor positioning, and stacking contexts](#5-native-overlays-anchor-positioning-and-stacking-contexts)
[5.1 Code example: popover with anchor positioning and fallback](#51-code-example-popover-with-anchor-positioning-and-fallback)
[5.2 Overlay mechanics decision matrix](#52-overlay-mechanics-decision-matrix)
[6 Overflow tracking and layout stability](#6-overflow-tracking-and-layout-stability)
[6.1 Code example: layout stability and truncation](#61-code-example-layout-stability-and-truncation)
[7 Viewport mechanics and track distribution](#7-viewport-mechanics-and-track-distribution)
[7.1 Code example: viewport units and grid distribution](#71-code-example-viewport-units-and-grid-distribution)
[8 Grid lanes (aka masonry)](#8-grid-lanes-aka-masonry)
[8.1 Code example: multi-column as a masonry stand-in](#81-code-example-multi-column-as-a-masonry-stand-in)
[9 Resources](#9-resources)

## 1 Fundamentals

Lean on the browser's layout engine when possible for better performance. Reach for intrinsic sizing, logical properties, and `aspect-ratio` before resorting to hardcoded dimensions or complicated media-queries.

### 1.1 Decision matrix

| Approach | Dimensions | Main Strength | Logic Type |
| --- | --- | --- | --- |
| **flex-box** | 1D | Content distribution along a single axis | Content-first |
| **grid** | 2D | Structural integrity across rows and columns | Layout-first |
| **subgrid** | 2D (inherited tracks) | Aligning grandchildren to an outer grid | Relationship-first |
| **multi-column** | 1D flow | Newspaper-style content reflow | Flow-first |
| **grid-lanes** (aka masonry) | 2D | Packing items of varied sizes without dead space | Flow-first (limited availability) |

### 1.2 Quick selection guide

1. **Is it a simple row OR column?** Use **flex-box**.
2. **Is it a complex page structure with rows AND columns?** Use **grid**.
3. **Does a nested element need to line up with the outer grid?** Use **subgrid**.
4. **Is the content a long flow of prose that should split into balanced columns?** Use **multi-column**.
5. **Are items different heights but need to be packed tightly?** Use a CSS Grid with `grid-auto-flow: dense` today; reach for native masonry only when it ships in your Baseline target (see [§3](#3-grid-and-subgrid)).

### 1.3 Working principles

- Use logical properties for content-focused layouts where the directional flow of the content should impact the order or directionality of the layout: `margin-inline`, `padding-block`, `inset-inline-start`, `border-inline-end`, etc. They flip automatically under `dir="rtl"` and vertical writing modes.
- Match the display type to the dimensionality of the layout: `flex` for one-dimensional layouts, `grid` for two-dimensional layouts.
- Apply the **content-first vs layout-first** mental model. Use flex-box when items determine the layout (content dictates flow). Use grid when you want to define the skeleton first (layout dictates placement).
- Prefer **flex-box** for linear components (navbars, item lists, toolbars) and small components.
- Prefer **grid** for two-dimensional page structures or complex component grids.
- Use the `place-*` shorthands (`place-content`, `place-items`, `place-self`) to align across both axes simultaneously in a single declaration.
- Reach for **intrinsic sizing** (`min-content`, `max-content`, `fit-content()`) and flexible tracks (`fr`, `minmax()`) before fixed `width`/`height` — let content or track logic express the constraint where it can. This leads to more maintainable and responsive layouts with fewer media queries and less reliance on hardcoded dimensions.
- Use `aspect-ratio` to reserve space for media and prevent layout shift before assets load.

**Code example** - intrinsic sizing and `aspect-ratio`:

```css
.sidebar {
  /* Size to its longest unbreakable token (e.g., longest word). */
  inline-size: max-content;
}

.main-content {
  /* Expand up to available space but no further. */
  inline-size: fit-content;
}

.media {
  /* Reserve space before image loads to prevent CLS. */
  aspect-ratio: 16 / 9;
  inline-size: 100%;
  block-size: auto;
}

.centered-card {
  display: grid;
  /* place-content sets justify-content + align-content. */
  place-content: center;
  min-block-size: 100dvh;
}
```

## 2 Flexbox

One-dimensional layout — items flow along a single main axis (row or column). This layout is especially powerful for creating responsive components and layouts that can adapt to varying content-sizes and container widths.

The most common use cases for flexbox are:

- A row or column of variably-sized items that should wrap to the next line if the container is too narrow.
- A row or column of items that should expand dynamically to fill the available space.
- A row or column of items that should be dynamically distributed according to the defined layout settings (e.g. `justify-content` and `align-items`).

```css
.flex-container {
  display: flex;
  /* Row is the main axis, allow items to wrap to the next line if the container is too narrow. */
  flex-flow: row wrap;
  gap: 1rem;
  /* Evenly lay out items horizontally. */
  justify-content: space-between;
  /* Center items vertically. */
  align-items: center;
}
```

Be sure the container or its children have a definite size. When the flexbox container is meant to resize to contain its children and those children are also resizing to fill the container, the rendered result will likely lead to overflow issues and/or unexpected layout results. This is a common issue when using flexbox to create a responsive layout.

### 2.1 Available properties for the container

Available properties and their usage (for the container element):

- MANDATORY: `display: flex`: must be present on the container element to establish a flex context.
- `flex-wrap`: sets whether the items should wrap to the next line if the container is too narrow. Valid values are `nowrap` (default), `wrap`, and `wrap-reverse`.
  - IMPORTANT: Use `flex-wrap: wrap` to prevent horizontal overflow on small viewports. When using `nowrap` without `overflow: hidden` or `overflow: auto`, the items will overflow the container.
- `flex-direction`: sets the direction of the **main** axis. This property will determine the directionality of the `justify-content` and `align-items` properties. Valid values are `row` (default), `row-reverse`, `column`, and `column-reverse`.
  - Note that `*-reverse` values reverse the directionality of the **main** axis, but not the **cross** axis.
- `row-gap` and `column-gap`: sets the spacing between items along their respective axis. Valid values are a length, a percentage, or a calc() expression.
- `justify-content`: sets the alignment of items along the **main** axis. Note that this directionality is dependent on the `flex-direction` property. Valid values are `flex-start` (default), `flex-end`, `center`, `space-between`, `space-around`, and `space-evenly`.
  - IMPORTANT: When `flex-direction` is `row` (default), `justify-content` aligns items along the inline axis (left to right). When `flex-direction` is `column`, `justify-content` aligns items along the block axis (top to bottom). This is one of the most common gotchas when using flexbox and is often misinterpreted.
  - Though similarly named, `space-around` and `space-evenly` are not the same. `space-around` distributes space between items, with equal space before and after each item, while `space-evenly` distributes space between items, with equal space before, **between**, and after each item.
- `align-items`: sets the alignment of items along the **cross** axis. Valid values are `flex-start` (default), `flex-end`, `center`, `stretch`, and `baseline`.
  - IMPORTANT: Prefix any positional alignment value with the `safe` or `unsafe` keyword (e.g., `align-items: safe center`) to control whether overflow can clip focusable content. `safe` falls back to `start` when content would otherwise be clipped.
  - IMPORTANT: When `flex-direction` is `row` (default), `align-items` aligns items along the block axis (top to bottom). When `flex-direction` is `column`, `align-items` aligns items along the inline axis (left to right). Similarly to `justify-content`, this is one of the most common gotchas when using flexbox and is often misinterpreted.
- SHORTHAND: `flex-flow`: a shorthand for `flex-direction` and `flex-wrap`.
- SHORTHAND: `gap`: a shorthand for `row-gap` and `column-gap`.
  - Prefer the standard `gap` property for spacing between items rather than child margins. (Flexbox `gap` is Baseline Widely Available; Safari shipped support in 14.1 / April 2021.)

### 2.2 Available properties for the child items

Available properties and their usage (for the contained children elements):

- `justify-self`: sets the alignment of an individual item along the **main** axis. Valid values are `flex-start` (default), `flex-end`, `center`, `space-between`, `space-around`, and `space-evenly`.
  - Push individual items to the end of the main axis with `margin-inline-start: auto` (or `margin-block-start: auto`) — `justify-self` has no effect on flex items, so auto margins are the standard escape hatch.
- `align-self`: sets the alignment of an individual item along the **cross** axis. Valid values are `flex-start` (default), `flex-end`, `center`, `stretch`, and `baseline`.
  - Use `align-self` on individual items to override cross-axis alignment per item as a means of overriding the `align-items` property for a specific item.
  - IMPORTANT: As with `align-items`, prefix any positional alignment value with `safe` or `unsafe` (e.g., `align-self: safe center`) to control overflow handling for focusable content.
- `order`: sets the visual order of the items among their siblings. Valid values are integers, negative integers, and `auto` (default).
  - IMPORTANT: Preserve DOM order for keyboard tab flow. `order` and `flex-direction: row-reverse` change visual order **only** — the DOM order still drives sequential focus, so reordering visually creates a tab path that doesn't match what the user sees.
- `flex-grow`: sets the growth factor of an individual item. Valid values are a number, 0 (default), or `auto`.
- `flex-shrink`: sets the shrink factor of an individual item. Valid values are a number, 1 (default), or `auto`.
- `flex-basis`: sets the base size of an individual item. Valid values are a length, a percentage, or a calc() expression.
- SHORTHAND: `flex`: a shorthand for `flex-grow`, `flex-shrink`, and `flex-basis`. i.e., `flex: <grow> <shrink> <basis>` (e.g., `flex: 1 1 200px`).

### 2.3 Code example: flex-box component

```css
.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.card-item {
  /* grow, shrink, basis */
  flex: 1 1 250px;
}

.card-item-action {
  /* Push the action to the end of the main axis. */
  margin-inline-start: auto;
}

.toolbar {
  display: flex;
  /* Prevent clipping when the container is narrower than its content. */
  align-items: safe center;
}
```

## 3 Grid and subgrid

CSS grid facilitates the creation of 2-dimensional layouts where you can either define both rows and columns explicitly or let the engine derive them. This is a powerful tool for creating complex layouts and is a key part of the modern CSS layout system.

Subgrid is a feature of CSS grid that allows you to create nested grids that inherit the tracks of their parent grid.

The most common use cases for CSS grid are:

- Defining regions of a page or section where you want the children elements to be distributed according to the defined layout settings (e.g. `grid-areas`).
- A structured set of items that should be distributed according to the defined layout settings (e.g. `grid-template-columns` and `grid-template-rows`).
- A collection of cards that should equally fill the available space in the container and be responsive to the viewport.
- Cards with variable content whose internal elements (titles, metadata, CTAs) must line up across siblings.

### 3.1 Available properties for the container

Available properties and their usage (for the container element):

- MANDATORY: `display: grid`: must be present on the container element to establish a grid context.
- Use `grid-template-areas` for complex, readable layout definitions.
  - Areas can be self-documenting if the names are descriptive and meaningful.
- `grid-template-columns` and `grid-template-rows`: sets the width/height of the columns and rows (collectively referred to as tracks) in the grid. Valid values are a length, a percentage, or a calc() expression.
  - To create a grid with equal-width tracks, use `repeat(<number of tracks>, <size of each item>)`.
  - Use `fr` unit to distribute available fractional space proportionally.
  - To create a grid of variably-sized tracks, use `repeat(auto-fill, 200px)`. This will create as many tracks as needed to fill the container, with each track being at least 200px.
  - Track size is determined by the size argument passed to `repeat()` (e.g., `200px` or `minmax(200px, 1fr)`), **not** by item content. `auto-fit` and `auto-fill` differ only in how they treat empty repeated tracks:
    - `auto-fill` **preserves** empty repeated tracks, so the placeholder space is kept.
    - `auto-fit` **collapses** empty repeated tracks to 0, allowing filled tracks (with `1fr`) to absorb the slack and stretch to fill the row.
  - Use `minmax(min, max)` to make tracks flexible but bounded (e.g., `repeat(auto-fill, minmax(200px, 1fr))`). This will create as many tracks as needed to fill the container, with each track being at least 200px but no more than the size of one full-width track.
- `grid-template-areas`: sets the areas of the grid. Valid values are a list of area names.
- `grid-auto-flow`: sets the flow of the grid. Valid values are `row` (default), `column`, `row dense`, and `column dense`.
  - Adding the `dense` keyword will attempt to pack items into the available space, even if it means leaving gaps. IMPORTANT: it can reorder items visually and break the logical DOM order that assistive technology and keyboard users follow.
- `grid-auto-rows`: sets the height of the rows in the grid. Valid values are a length, a percentage, or a calc() expression.
- `grid-auto-columns`: sets the width of the columns in the grid. Valid values are a length, a percentage, or a calc() expression.

On top of the above properties, grids also support `gap`, `align-content` and `justify-content` properties for the container, as well as `align-items` and `justify-items` properties for the child items. These function in the same way for grid as they do for flexbox.

Example of how to use `auto-fit` and `auto-fill` to create a stretching and filling grid:

```css
/* Stretching grid: empty tracks collapse, filled tracks fill the row. */
.stretching-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

/* Filling grid: empty tracks remain, items maintain their min size. */
.filling-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
```

### 3.2 Available properties for the child items

Available properties and their usage (for the contained children elements):

- `grid-column` and `grid-row`: allows an item to override its default position in the grid. Valid values are a number, a percentage, or a calc() expression.
  - Use `span <n>` (e.g., `grid-column: span 3`) to size an item across multiple tracks. Subgrid only inherits parent tracks for the cells the child actually spans.
  - Use the `<start> / <end>` form (e.g., `grid-column: 3 / 5`) to position an item at a specific start and end track line.
- `grid-area`: allows an item to be assigned to a specific area of the grid (as defined in `grid-template-areas`).

### 3.3 Subgrid

Subgrid can be used to align nested children to the outer grid's tracks and can be assigned to either axis (columns or rows). (e.g., `grid-template-columns: subgrid`, `grid-template-rows: subgrid`, or both.)

Use Subgrid to solve the "ragged edge" problem in card lists where internal elements (titles, metadata, CTAs) must line up across siblings.

When item count is variable, only apply subgrid to one axis. If the child has more items than the parent has cells, using subgrid on both axis places extras into the last track; use `grid-auto-rows`/`grid-auto-columns` for the implicit axis instead.

{{ BASELINE_STATUS("subgrid") }}

### 3.4 Code example: grid and subgrid

Example of a page layout using grid and subgrid.

```html
<main class="page-layout">
  <header>Header</header>
  <aside>Sidebar</aside>
  <section class="card-grid">
    <div class="card"></div>
    <div class="card"></div>
  </section>
  <footer>Footer</footer>
</main>
```

 Note how the grid-template-areas are formatted to make the rows and columns visually align with the content, which is a good practice for maintainability and positive developer experience.

```css
/* Creates a 3-column grid with 3 distinct rows; leverages named areas to control the placement of the content within the grid. */
.page-layout {
  display: grid;
  /* Allotted the total width of the grid to the three equal columns. */
  grid-template-columns: repeat(3, 1fr);
  grid-template-areas:
    "header  header  header"
    "sidebar main    main"
    "footer  footer  footer";
  /* Space between the rows and columns. */
  gap: 1.5rem;
}

header {
  grid-area: header;
}

aside {
  grid-area: sidebar;
}

/* An internal grid for the nested cards. */
.card-grid {
  grid-area: main;

  display: grid;
  /* Attempts to fill the available space with columns a minimum width of 240px and a maximum width of 1fr. */
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  /* Two rows: title block, body block. */
  grid-template-rows: auto 1fr;
  gap: 1rem;
}

.card {
  /* Each card spans both rows of the parent track... */
  grid-row: span 2;
  display: grid;
  /* ...and inherits those rows so titles and bodies line up across cards. */
  grid-template-rows: subgrid;
}

footer {
  grid-area: footer;
}
```

### 3.5 Fallback: subgrid strategy

```css
.card {
  grid-row: span 2;
  display: grid;
  /* Fallback for browsers that don't support subgrid. */
  grid-template-rows: auto 1fr;
  /* If subgrid is not supported, it will fall back to the previous declaration. */
  grid-template-rows: subgrid;
}
```

## 4 Container queries

Query the size (or computed style) of a parent container rather than the viewport.

MANDATORY: You must establish a containment context with `container-type` on a wrapper to enable size queries on its descendants. This is a contract communicating that the wrapper has a fixed size and can be queried without causing reflow and layout shifts.

Available properties and their usage:

- `container-type`: type of container to query (see below).
- `container-name`: name containers when nested contexts could collide; queries can target a specific name.
- SHORTHAND: `container`: a shorthand for `container-type` and `container-name` (e.g., `container: inline-size card`).

Container type can be one of the following values:

- `inline-size` (for width-based queries) and `size` (for both width and height queries). Note that `block-size` is NOT a valid value.
  - IMPORTANT: When using these values, the size of the element's children can no longer impact the size of the container (computed as if it has no children). It will also make style (assuming browser support) and inline-size queries and values available to the container's children.
  - When applying `container-type: size` (both axes), give the container a definite `block-size`. Without one, descendants collapse because size containment forces the container to ignore its content.
- `normal` indicates a container is not a queryable container for any size queries but can still be used for style queries.

Available container query units:

| Unit | Relative to |
|---|---|
| `cqi` | 1% of the inline size of the container |
| `cqb` | 1% of the block size of the container |
| `cqw` | 1% of the width of the container |
| `cqh` | 1% of the height of the container |
| `cqmin` | smallest value of either `cqi` or `cqb` |
| `cqmax` | largest value of either `cqi` or `cqb` |

Note that container query units fall back to the **small viewport** (`svw`/`svh`) when no qualifying ancestor container is found.

{{ BASELINE_STATUS("container-queries") }}

### 4.1 Code example: fluid typography using container query units

```css
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

@container card (inline-size > 400px) {
  .card-content {
    display: flex;
    gap: 2rem;
  }
}

.item-title {
  /* Fluid type bound to the container width, not the viewport. */
  font-size: clamp(1rem, 4cqi, 2rem);
}
```

### 4.2 Responsive triggers decision matrix

| Feature | Container queries (`@container`) | Media queries (`@media`) |
| ----- | ----- | ----- |
| **Context** | Nearest qualifying ancestor (size or style containment) | Global viewport / user agent |
| **Reusable** | High — one component adapts in any context | Low — coupled to viewport |
| **Use cases** | Adaptive cards, sidebar widgets, layout-aware components | Page-level breakpoints, navigation, document-wide theming |

**Mental model**: Container queries = component context. Media queries = global page layout and user preferences (`prefers-color-scheme`, `prefers-reduced-motion`, etc.).

## 5 Native overlays, anchor positioning, and stacking contexts

Manage overlays and layering with native primitives instead of complex JavaScript stacks.

| Feature | Baseline status |
| ----- | ----- |
| `<dialog>` | **Baseline Widely Available** (cross-browser since March 2022). |
| `popover` attribute | **Baseline Newly Available** (April 2024). |
| CSS Anchor Positioning (`anchor-name`, `position-anchor`, `anchor()`, `anchor-size()`, `position-area`, `position-try-fallbacks`) | **Limited Availability** — Chromium-only at the time of writing. Always feature-detect. |

- Use the `popover` attribute for menus, tooltips, and other non-modal flyouts — popovers live in the top layer, so layering doesn't need `z-index` management.
  - `popover="auto"` (or bare `popover`): light-dismissable; only one `auto` popover open at a time.
  - `popover="manual"`: programmatic show/hide only; multiple can coexist.
  - `popover="hint"`: like `auto` but closes other `hint` popovers without closing `auto` popovers — designed for hover/focus tooltips that should layer over an open menu.

- Use `<dialog>` and `.showModal()` for modal interactions that require focus trapping and an inert backdrop.
- Use `anchor-size()` to size a popover to its trigger (e.g., a dropdown matching the input width) where supported.
- Use `position-area` or `anchor()` on insets to position an overlay relative to its trigger.
- Use `position-try-fallbacks: flip-block` (or `flip-inline`, or named `@position-try` rules) to let the browser reposition an overlay automatically when it overflows the viewport.
- Feature-detect anchor positioning with `@supports (anchor-name: --x)` and provide a fallback (`position: absolute` with manual offsets, or the OddBird CSS Anchor Positioning polyfill) for non-Chromium browsers.
- Use `pointer-events: none` to let clicks pass through decorative overlays.
- Pick one of `popover="auto"` / `"manual"` *or* `.showModal()` for a given element — they're mutually exclusive runtime states. A `<dialog>` opened with `.show()` (or via the `popover` attribute) behaves as a popover; calling `.showModal()` overrides this and puts the dialog in modal mode, with focus trapping and an inert backdrop.

### 5.1 Code example: popover with anchor positioning and fallback

```css
#trigger {
  anchor-name: --trigger;
}

[popover] {
  /* Fallback: explicit positioning for browsers without anchor positioning. */
  position: absolute;
  inset-block-start: 100%;
  inset-inline-start: 0;
}

@supports (anchor-name: --x) {
  [popover] {
    position-anchor: --trigger;
    position-area: block-end span-inline-end;
    inline-size: anchor-size(width);
    /* Native overflow handling — flip across the block axis if needed. */
    position-try-fallbacks: flip-block;
  }
}
```

### 5.2 Overlay mechanics decision matrix

| Feature | Popover API (`popover`) | `<dialog>` |
| ----- | ----- | ----- |
| **Modality** | Non-modal (does not block background) | Modal (`.showModal()`) or non-modal (`.show()`) |
| **Focus trapping** | Standard tab flow (no trap) | Modal mode locks focus inside dialog |
| **Light-dismiss** | Auto-closes on outside click / Esc (for `auto` and `hint`) | Esc only in modal mode; outside click dismissal requires JS |
| **Top layer** | Yes (always) | Yes (modal only) |

**Mental model**: Popover = transient/non-modal (flyouts, toasts, tooltips). `<dialog>` = blocking/modal (requires user action).

## 6 Overflow tracking and layout stability

Manage layout shifts, scrollbars, and clipping predictably.

- Use `overflow: auto` rather than `overflow: scroll` — `auto` shows scrollbars only when content overflows, while `scroll` forces them even when not needed.
- Use `scrollbar-gutter: stable` to reserve space for scrollbars and prevent layout shifts when content grows. (Baseline Widely Available since Feb 2024.)
- Use `overflow: clip` rather than `overflow: hidden` to clip content **without** establishing a scroll container. Unlike `hidden`, `clip` cannot be programmatically scrolled and lets you opt into spillover with `overflow-clip-margin`.
- Use `overscroll-behavior: contain` (or `none`) on scrollable containers to prevent scroll chaining from bubbling into the parent or document.
- Use the `-webkit-line-clamp` + `display: -webkit-box` + `-webkit-box-orient: vertical` triad for multi-line truncation. Despite the prefix, this pattern is fully specified and not deprecated.
- Prefer the unprefixed `line-clamp` shorthand once your Baseline target supports it (Newly Available, partial cross-browser support — feature-detect with `@supports`).
- Use `touch-action` (e.g., `pan-y`, `pan-x`, `none`) to optimize gesture handling on touch surfaces.

### 6.1 Code example: layout stability and truncation

```css
.scrollable-list {
  max-block-size: 400px;
  overflow-y: auto;
  /* Reserve space for the scrollbar to avoid jarring shifts. */
  scrollbar-gutter: stable;
  /* Stop scroll from chaining into the page on rubber-band gestures. */
  overscroll-behavior: contain;
}

.snippet {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  /* Browsers will ignore the property if not yet supported. */
  line-clamp: 3;
  overflow: hidden;
}
```

## 7 Viewport mechanics and track distribution

Handle the edge cases of mobile viewport shifts:

- Use **dynamic viewport units** (`dvh`, `dvw`, `dvi`, `dvb`) for mobile layout containers that need to account for browser UI shifting (URL bar collapse/expand). All `dv*`/`sv*`/`lv*` units are Baseline Widely Available since 2024.
- Use `ch` units for `max-inline-size` on text blocks to maintain optimal reading lengths (~60–70 characters per line).
- Use the inline-axis viewport unit `100vi` (or `100dvi` / `100svi`) where logical-axis layout is preferred over physical width.
- Use `100%`, `100dvw`, or `100svw` (not `100vw`) for full document width — `100vw` ignores vertical scrollbars and produces horizontal overflow on platforms with always-visible scrollbars (most desktop OSes). Pick the dynamic or static variant based on whether you want the value to track viewport changes.

### 7.1 Code example: viewport units and grid distribution

```css
/* Mobile-friendly full viewport — collapses with the URL bar. */
.hero-mobile {
  block-size: 100dvh;
}

/* Logical-axis full inline width — safe in vertical writing modes too. */
.full-bleed {
  inline-size: 100dvi;
}
```

## 8 Grid lanes (aka masonry)

Native CSS masonry is **not yet Baseline** as the specification is still in development. Firefox supports an earlier `grid-template-rows: masonry` syntax behind the `layout.css.grid-template-masonry-value.enabled` flag; no other engines ship it in stable as of this writing.

The currently agreed-upon name for this feature is "grid lanes" (e.g., `display: grid-lanes`).

- Use a Grid layout with `grid-auto-flow: dense` for tight packing of items with explicit row/column spans, accepting that DOM order may not match visual order.
- Use columns (`columns: 3; column-gap: 1rem`) for content-heavy masonry-like flow when items are document fragments rather than equal-weight cards.
- Treat `grid-template-rows: masonry` as a progressive enhancement only — feature-detect with `@supports` and don't ship it as a hard requirement until your Baseline target catches up.

### 8.1 Code example: multi-column as a masonry stand-in

```css
.gallery {
  columns: 3 200px;
  column-gap: 1rem;
}

.gallery > * {
  /* Prevent items from breaking across columns. */
  break-inside: avoid;
  margin-block-end: 1rem;
}

@supports (grid-template-rows: masonry) {
  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    grid-template-rows: masonry;
    gap: 1rem;
    columns: unset;
  }
}
```

## 9 Resources

- **MDN — CSS Grid Layout**: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout>
- **MDN — Subgrid**: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid>
- **MDN — CSS Flexible Box Layout**: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout>
- **MDN — Aligning Items in a Flex Container**: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Aligning_items_in_a_flex_container>
- **MDN — CSS Container Queries**: <https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries>
- **MDN — CSS Anchor Positioning**: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning>
- **MDN — `position-area`**: <https://developer.mozilla.org/en-US/docs/Web/CSS/position-area>
- **MDN — `popover` attribute**: <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/popover>
- **MDN — `<dialog>`**: <https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog>
- **MDN — `aspect-ratio`**: <https://developer.mozilla.org/en-US/docs/Web/CSS/aspect-ratio>
- **MDN — `line-clamp`**: <https://developer.mozilla.org/en-US/docs/Web/CSS/line-clamp>
- **MDN — `scrollbar-gutter`**: <https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter>
- **MDN — `overscroll-behavior`**: <https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior>
- **MDN — Viewport-percentage lengths**: <https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-percentage_lengths>
- **MDN — CSS Masonry Layout**: <https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Masonry_layout>
- **W3C — CSS Grid Layout Module Level 3 (Masonry)**: <https://www.w3.org/TR/css-grid-3/>
- **W3C — CSS Anchor Positioning Module Level 1**: <https://www.w3.org/TR/css-anchor-position-1/>
- **W3C — CSS Containment Module Level 3**: <https://www.w3.org/TR/css-contain-3/>
- **web.dev — Use container queries in production**: <https://web.dev/blog/cq-stable>
- **web.dev — Tooltips, the popover API**: <https://web.dev/blog/popover-api>
- **Chrome for Developers — CSS anchor positioning API**: <https://developer.chrome.com/blog/anchor-positioning-api>
- **OddBird — CSS Anchor Positioning Polyfill**: <https://github.com/oddbird/css-anchor-positioning>
- **Web Platform Status (Baseline) — webstatus.dev**: <https://webstatus.dev/>
