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


## Choose semantics for the card's interaction model

When a card represents one destination and has no independent actions, it may be
one native link. Do not nest other links, buttons, or form controls inside it:

```html
<a class="card" href="/recipes/poached-eggs">
  <img src="recipe.jpg" alt="">
  <h3>Poached eggs</h3>
  <p>Two poached eggs served on toasted sourdough.</p>
</a>
```

When a card has independent actions, link its title to the primary destination
and keep secondary actions as separate native links or buttons. Preserve the DOM
sequence rather than using CSS `order`; see {{ GUIDE_REF("css-layout") }}.

When cards represent choices, use native form controls and style their labels as
cards. Use radios for one choice, checkboxes for independent choices, and a
native `select` when the interaction is a select:

```html
<fieldset class="option-cards">
  <legend>Choose a delivery method</legend>
  <label class="option-card">
    <input type="radio" name="delivery" value="standard">
    <span>Standard delivery</span>
  </label>
  <label class="option-card">
    <input type="radio" name="delivery" value="express">
    <span>Express delivery</span>
  </label>
</fieldset>
```

Do not replace links, buttons, or form controls with clickable `div` or `article`
elements. Keep native controls keyboard-operable and preserve visible focus;
see {{ GUIDE_REF("accessibility") }}.
