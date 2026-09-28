---
name: card
description: "Build a card component that adapts its presentation to its own available space and contents."
web-feature-ids:
  - has
  - container-queries
guides:
  - size-aware-styling
  - content-based-styling
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

Place the `article` inside a wrapper that represents the card's allocated layout
space. Make that wrapper the query container: a container cannot query its own
inline size, so the wrapper lets the card adapt to the width available in its
parent layout. Make the heading link to the primary destination, and keep
secondary actions separate from that link:

```html
<div class="card-container">
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

Start with a complete stacked layout that works at every card width. Cards may
appear in grid columns, sidebars, or related-content areas, so use the card's
allocated inline size rather than the viewport to decide when to change its
layout. For the container-query pattern, see
{{ GUIDE_REF("size-aware-styling") }}.

When the card's container is wide enough, a card that has media may place that
media beside its title, supporting content, and actions. Keep the media and
content in a meaningful DOM order, and do not require a separate component or
special markup when media is absent.

Use `:has()` only when the presence or absence of content changes the card's
presentation. For example, the wider layout can apply only to cards containing
direct media, while cards without media retain the default stacked layout. Do
not use it when an ordinary class, element selector, or unconditional layout
rule expresses the same requirement more clearly. See
{{ GUIDE_REF("content-based-styling") }}.

Keep media within a deliberate aspect ratio or size constraint and use
non-distorting cropping where appropriate. Ensure that the resulting layout
does not hide, overlap, or reorder the card's title, supporting content, or
actions.

The card's layout should preserve the source order used in the composition
example:

1. media, when present;
2. title and supporting content;
3. related actions.

Do not use CSS `order` to create a visual sequence that differs from the DOM
sequence. See {{ GUIDE_REF("css-layout") }}.

The card's focus treatment should provide context while each focused link or
control retains its own visible focus indicator. For focus appearance and
control semantics, see {{ GUIDE_REF("accessibility") }}.


## Keep the card's structure intentional

Do not turn the whole card into one large link when it has independent actions.
Make the title link to the card's primary destination and keep secondary actions
as separate native controls. Avoid using CSS `order` to create a visual sequence
that differs from the DOM sequence; see {{ GUIDE_REF("css-layout") }}.

Use the focus and interaction guidance in {{ GUIDE_REF("accessibility") }} for
interactive card content rather than implementing component-specific keyboard
behavior.
