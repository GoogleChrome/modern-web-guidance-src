---
name: card
description: "Build a card component that adapts its presentation to its own available space and contents."
web-feature-ids:
  - has
  - container-queries
guides:
  - size-aware-styling
  - content-based-styling
  - css-layout
  - accessibility
---

# Build a Content-Aware Card

Use a card to group one independently understandable piece of content: an
article preview, product, profile, or saved item. Keep its source order
meaningful: media, title, supporting content, then related actions.

Use an `article` when the card can stand on its own outside its current page.
For the appropriate semantics and focus treatment for links and controls, see
{{ GUIDE_REF("accessibility") }}.

## Adapt to the card's placement

Cards commonly appear in a main-content grid, narrow sidebar, and compact
related-content area. Make the card respond to the width available to its slot,
not to the viewport. For container-query setup and sizing strategy, see
{{ GUIDE_REF("size-aware-styling") }}.

Put the query container on a wrapper around the card when a query needs to alter
the card's own layout. A container cannot query itself, so the wrapper lets the
card change from a stacked presentation to a media-and-content layout.

### Card composition

Place the `article` inside its query wrapper. Make the heading link to the
primary destination, and keep secondary actions separate from that link:

```html
<div class="card-slot">
  <article class="card">
    <img src="recipe.jpg" alt="Poached eggs on toast">
    <hgroup>
      <h3><a href="/recipes/poached-eggs">Poached eggs</a></h3>
      <p>Breakfast special</p>
    </hgroup>
    <p>Two poached eggs served on toasted sourdough with microgreens.</p>
    <footer>
      <button>Favorite</button>
      <a href="/recipes/poached-eggs">View recipe</a>
    </footer>
  </article>
</div>
```


### Card layout

Start with a stacked layout. Size media within the card, then apply a
two-column layout only when the card has media and its slot is wide enough:

```css
.card-slot {
  container-type: inline-size;
}

.card {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  padding: 1.5rem;
  border: 1px solid currentColor;
  border-radius: 0.5rem;
}

.card:has(:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}

.card > :is(img, picture, svg) {
  inline-size: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 0.25rem;
}

.card > hgroup {
  display: grid;
  gap: 0.25rem;
}

.card > hgroup > :is(h1, h2, h3, h4, h5, h6),
.card > hgroup > p,
.card > p {
  margin: 0;
}

.card > footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

@container (min-width: 32rem) {
  .card:has(> :is(img, picture, svg)) {
    grid-template-columns: 8.75rem 1fr;
    gap: 0.5rem 1.25rem;
    align-items: start;
  }

  .card:has(> :is(img, picture, svg)) > :is(img, picture, svg) {
    grid-column: 1;
    grid-row: 1 / span 10;
    align-self: start;
    block-size: 100%;
    min-block-size: 8.75rem;
  }

  .card:has(> :is(img, picture, svg)) > :not(:is(img, picture, svg)) {
    grid-column: 2;
  }
}

.card:not(:has(> :is(img, picture, svg))) {
  border-top: 0.25rem solid currentColor;
}
```

Use `:has()` only for content-dependent variation, such as applying the
two-column treatment only when a card has media. Keep the default stacked layout
complete and readable so cards without media do not require special markup. The
text-only border treatment is optional; use it only when it conveys a meaningful
content distinction. For broader content-based styling guidance, see
{{ GUIDE_REF("content-based-styling") }}.

The focus outline on the card provides context while its child retains its own
visible focus indicator. For focus appearance and control semantics, see
{{ GUIDE_REF("accessibility") }}.


## Keep the card's structure intentional

Do not turn the whole card into one large link when it has independent actions.
Make the title link to the card's primary destination and keep secondary actions
as separate native controls. Avoid using CSS `order` to create a visual sequence
that differs from the DOM sequence; see {{ GUIDE_REF("css-layout") }}.

Use the focus and interaction guidance in {{ GUIDE_REF("accessibility") }} for
interactive card content rather than implementing component-specific keyboard
behavior.
