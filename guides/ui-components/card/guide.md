---
name: card
description: "Build a semantic, content-aware card using article as the component, hgroup for headings, and a parent layout wrapper to query sizes and container dimensions."
web-feature-ids:
  - has
  - container-queries
guides:
  - size-aware-styling
  - content-based-styling
---

# Semantic, Content-Aware Card Component

Traditional component libraries rely heavily on complex, bloated class naming methodologies (like BEM or utility classes) to style internal elements. This results in verbose HTML markup (`class="card-item card-item--compact card-item--has-image"`), leading to maintainability issues and code duplication.

By combining modern CSS features—**CSS Container Queries** and the **`:has()` parent selector**—you can create a highly semantic, resilient card component.

---

## The Parent Layout Container Pattern

A fundamental rule of CSS Container Queries is that **a container cannot query itself**. An element defined with `container-type: inline-size` cannot use `@container` queries to modify its own grid tracks, padding, or layout areas. 

To resolve this limitation while keeping your card component completely semantic and flat, utilize the **Parent Layout Container Pattern**:
1. **The Card Layout Wrapper (`.card-layout`)**: The parent layout cell (representing a slot in a CSS Grid, product catalog, dashboard, or sidebar) defines the container query context.
2. **The Card Component (`<article class="card">`)**: The card itself queries the parent layout container (`card-container`) to dynamically adjust its grid template columns, areas, and spacing.

---

## How to Implement

### 1. Semantic HTML Structure
Place the semantic `<article class="card">` inside a `.card-layout` wrapper. 

Utilize the HTML `<article>` element as the card's root. By definition, a card represents a self-contained, independent, and reusable composition of content (such as a product listing, directory item, or article preview). Using `<article>` satisfies critical semantic and accessibility expectations, allowing screen readers and assistive technologies to cleanly discover and announce the card as a standalone section of the page.

#### Variation A: Card with Image Media
```html
<div class="card-layout">
  <article class="card">
    <img src="dish.jpg" alt="Poached Eggs" />
    <hgroup>
      <h3><a href="#recipe">Poached Eggs</a></h3>
      <p>Breakfast Special</p>
    </hgroup>
    <p>Two perfectly poached organic eggs served on toasted sourdough with microgreens.</p>
    <footer>
      <button>Favorite</button>
      <a href="#cart">Add to Cart</a>
    </footer>
  </article>
</div>
```

#### Variation B: Card without Media (Text-Only)
```html
<div class="card-layout">
  <article class="card">
    <hgroup>
      <h3><a href="#philosophy">Culinary Philosophy</a></h3>
      <p>Crafted with Passion</p>
    </hgroup>
    <p>Sourcing exclusively local, organic ingredients supports sustainable agriculture...</p>
    <footer>
      <button>Learn More</button>
    </footer>
  </article>
</div>
```

---

### 2. Base Grid and Container Definition
Define the parent layout wrapper as the container, and let the `<article class="card">` elements naturally stack inside a single-column layout:

```css
/* 1. Parent Layout Wrapper defines the query context */
.card-layout {
  container-type: inline-size;
  container-name: card-container;
  width: 100%; /* Spans full width of parent column/grid cell */
}

/* 2. The Card Component Grid Base (Preserves natural HTML order) */
article.card {
  display: grid;
  grid-template-columns: 1fr; /* Natural stacked flow respecting HTML source order */
  width: 100%;
  padding: 1.5rem;
  gap: 0.75rem;
  position: relative; /* Essential for nested focus expansion */
}

/* Style children based strictly on HTML tag semantics */
article.card > :is(img, picture, svg) {
  width: 100%;
  height: 140px;
  object-fit: cover;
}

/* Target heading group */
article.card > hgroup {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

article.card > hgroup > :is(h1, h2, h3, h4, h5, h6) {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  text-wrap: balance; /* Balance heading lines */
}

article.card > hgroup > p {
  margin: 0;
  font-size: 0.825rem;
}

article.card > p {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.55;
  text-wrap: pretty; /* Avoid orphans */
}

article.card > footer {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
```

---

### 3. Smart Layout Reconfiguration with `:has()`

By querying the parent layout container (`card-container`), style the descendant `<article.card>` dynamically. 

By employing `:has()`, you can target cards containing image elements specifically, leaving text-only cards in their natural single-column layout:

```css
@container card-container (min-width: 32.01rem) {
  /* Establish two-column sidebar layout ONLY if a media element is present */
  article.card:has(> :is(img, picture, svg)) {
    grid-template-columns: 140px 1fr;
    gap: 0.5rem 1.25rem;
  }

  /* Force the media element to column 1, spanning all content rows */
  article.card:has(> :is(img, picture, svg)) > :is(img, picture, svg) {
    grid-column: 1;
    grid-row: 1 / span 10;
    align-self: start;
    height: 100%;
    min-height: 140px;
  }

  /* Force all other siblings to column 2, stacking naturally */
  article.card:has(> :is(img, picture, svg)) > :not(:is(img, picture, svg)) {
    grid-column: 2;
  }
}
```

---

## Strategic Implementation & Best Practices

- **DO** map styles directly to semantic tags (`article`, `img`, `hgroup`, `p`, `footer`) rather than adding helper layout classes. This keeps the markup clean and enforces accessibility.
- **DO NOT** hardcode widths directly on card components. Let the parent container's layout track determine the card's dimensions.
- **DO** define the container query context on the **parent layout wrapper** (`.card-layout`) rather than the card itself, so the card is able to query and rearrange its own columns.
- **DO NOT** use viewport media queries (`@media`) for component structure. Use Container Queries so the card adapts based on where it is rendered (e.g., narrow sidebar vs wide grid cell).
- **DO** design custom keyboard focus indicators by delegating focus to the card container:
  ```css
  /* Style focus state when any child inside the card receives keyboard focus */
  article.card:has(:focus-visible) {
    outline: 2px solid var(--focus-ring-color, currentColor);
    outline-offset: 4px;
  }
  ```
- **DO NOT** wrap an entire card in a block-level anchor `<a>` tag or bind generic Javascript click handlers to `div`s. This ruins keyboard focus and screen reader semantics.

---

## Fallback Strategies

### Standalone Viewport Fallback (When Parent Container Context is Unavailable)

If you must render a card in a legacy layout context where wrapping it in a `.card-layout` container is not an option, define a **Viewport Media Query Fallback**. 

To prevent global CSS media queries from leaking and conflicting with nested container layouts in supporting browsers, use an **explicit opt-in data attribute** (such as `data-viewport-fallback="true"`) to trigger standard viewport-based responsive transitions:

```html
<!-- Stands alone directly on the page, no parent .card-layout wrapper! -->
```

```css
/* Standard viewport-based fallback, activated only via explicit opt-in */
@media (min-width: 48rem) {
  article.card[data-viewport-fallback="true"]:has(> :is(img, picture, svg)) {
    grid-template-columns: 140px 1fr;
    gap: 0.5rem 1.25rem;
  }

  article.card[data-viewport-fallback="true"]:has(> :is(img, picture, svg)) > :is(img, picture, svg) {
    grid-column: 1;
    grid-row: 1 / span 10;
    align-self: start;
    height: 100%;
    min-height: 140px;
  }

  article.card[data-viewport-fallback="true"]:has(> :is(img, picture, svg)) > :not(:is(img, picture, svg)) {
    grid-column: 2;
  }
}
```

### Progressive Enhancement Assessment
The mobile-first grid layout (stacked rows) behaves as an excellent, readable fallback layout for legacy environments that do not support container size queries or `:has()`. Layout transitions and automatic adjustments are applied as progressive enhancements.

{{ FEATURE_FALLBACKS("container-queries") }}
{{ FEATURE_FALLBACKS("has") }}
