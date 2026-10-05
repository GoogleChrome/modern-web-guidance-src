---
name: card
description: "Build a card component that adapts its presentation to its own available space and contents."
web-feature-ids:
  - has
  - container-queries
  - subgrid
guides:
  - size-aware-styling
  - content-based-styling
---

# Build a Card

## Overview

A card groups one related piece of content or one choice. It is a visual pattern,
not a fixed semantic or interaction model. The implementation must preserve the
content's meaning, use the native interaction that matches its purpose, and remain
usable when optional styling or layout enhancements are unavailable.

## Guidelines

Choose semantics from the card's purpose:

- use an `article` for independently understandable content;
- use one native link when the whole card is one destination;
- use separate links or buttons when it has independent actions;
- use labeled radios or checkboxes when cards represent choices;
- use a native `select` when the interaction is a select.

Keep media, title, supporting content, and actions in meaningful source order.
Optional media, metadata, and actions must not make the remaining content
ambiguous. Do not duplicate markup or use CSS `order` to contradict source order;
see {{ GUIDE_REF("css-layout") }}.

## Implementation

Start with a complete stacked layout. Adapt the card to its allocated inline size,
not the viewport, when it appears in grids, sidebars, or other variable-width
layouts. A media card may place media beside its content when there is enough
space; a card without media must remain complete without special markup.

Put the query container on a wrapper around the card when the card's own layout
needs to respond to that space. A card cannot query its own size. For the
container-query pattern, see {{ GUIDE_REF("size-aware-styling") }}.

```html
<div class="card-container">
  <article class="card">
    <img src="recipe.jpg" alt="Poached eggs on toast">
    <hgroup>
      <h3><a href="/recipes/poached-eggs">Poached eggs</a></h3>
      <p>Breakfast special</p>
    </hgroup>
    <p>Two poached eggs served on toasted sourdough.</p>
    <footer>
      <button type="button">Favorite</button>
      <button type="button">Share</button>
    </footer>
  </article>
</div>
```

```css
.card-container {
  /* Query the wrapper's inline size because a card cannot query its own container size */
  container-type: inline-size;
}

.card {
  display: grid;
  gap: 0.75rem; /* Example spacing */
}

/* Switch to two columns only when the container is wide enough (32rem is an example threshold) AND media is present */
@container (min-width: 32rem) {
  .card:has(> :is(img, picture, video, svg)) {
    grid-template-columns: 9rem 1fr; /* Example media column width */
    grid-template-rows: auto 1fr auto; /* Size hgroup and footer to content; let body text flex */
    gap: 0.5rem 1.25rem;
  }

  .card:has(> :is(img, picture, video, svg)) > :is(img, picture, video, svg) {
    grid-column: 1;
    /* Span all explicit text rows (-1) instead of an arbitrary span count, which would create empty implicit tracks that still accumulate row-gap */
    grid-row: 1 / -1;
    block-size: 100%;
    object-fit: cover;
  }

  .card:has(> :is(img, picture, video, svg)) > :not(:is(img, picture, video, svg)) {
    grid-column: 2;
  }
}
```

The example shows a card with a primary destination and independent actions. A
card may instead include a badge or metadata in its header, a hero image, or a
footer containing a price and actions. Keep each region optional where the
content allows it, and use layout rather than duplicated markup to arrange them.

Constrain media to an intentional size or aspect ratio and avoid distortion. An
informative image needs an appropriate text alternative; decorative media should
use an empty alternative. A hero image may be decorative when the adjacent title
already communicates the same information.

### Align cards in a grid

Let the parent grid control columns and gaps. Align corresponding regions, such
as titles, descriptions, or actions, only when that improves comparison. Do not
force equal heights when natural content height is more appropriate.

When cards need shared internal tracks, `subgrid` can align them without changing
source order:

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); /* 18rem is an example minimum card width */
  /* Define 4 implicit tracks per wrapped card row: media, heading, flexible body (1fr), and footer */
  grid-auto-rows: auto auto 1fr auto;
  gap: 1.5rem; /* Example grid gap */
}

.card {
  display: grid;
  /* Span all 4 shared tracks; do not set container-type on .card or an intermediate wrapper, as layout containment disables subgrid */
  grid-row: span 4;
  grid-template-rows: subgrid;
  row-gap: 0.75rem;
}

/* Assign each region to its track so omitting optional media or footer does not shift sibling tracks */
.card > :is(img, picture, video, svg) { grid-row: 1; }
.card > hgroup { grid-row: 2; }
.card > p { grid-row: 3; }
.card > footer { grid-row: 4; }
```

Use `:has()` only when the card's content changes its presentation, such as when
media changes the layout or a text-only card receives a different treatment. Do
not use it when a class, element selector, or unconditional rule expresses the
requirement more clearly. See {{ GUIDE_REF("content-based-styling") }}.

## Interaction models

When the card is one destination and has no independent actions, it may be one
native link. Do not nest links, buttons, or form controls inside it:

```html
<a class="card" href="/recipes/poached-eggs">
  <h3>Poached eggs</h3>
  <p>Two poached eggs served on toasted sourdough.</p>
</a>
```

When a card has longer body copy or independent actions, do not wrap the whole
card in `<a>` (which concatenates all inner text into the link's accessible
name). Link the title to the primary destination, stretch its pointer hit area
across the card with `::after`, and elevate secondary controls with
`position: relative; z-index: 1` so each action remains independently operable:

```css
.card {
  /* Anchor the stretched primary link pseudo-element to the card bounds */
  position: relative;
}

.card h3 a::after {
  /* Expand the heading link's pointer target across the entire card without wrapping body text in <a> */
  content: "";
  position: absolute;
  inset: 0;
}

.card footer :is(button, a) {
  /* Stack secondary controls above the ::after overlay so they remain independently clickable */
  position: relative;
  z-index: 1;
}
```

When cards represent choices, style their native controls and labels as cards.
Use radios for one choice and checkboxes for independent choices:

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

Style the selected option card with `:has(:checked)` using more than color alone
(such as border thickness or font weight):

```css
.option-card:has(:checked) {
  /* Pair any color change with non-color indicators (example border width and weight) so selection is never conveyed by color alone */
  border-width: 2px;
  font-weight: 600;
}
```

When choices belong in a dropdown picker whose options are laid out as cards,
use a native `<select>` with `appearance: base-select` and style `::picker(select)`
and `<option>` elements rather than replacing the select with `<div>` cards; see
{{ GUIDE_REF("custom-select-picker-layouts") }}. Use `<button>` elements when
selecting a card triggers an immediate action rather than setting form state.

## Accessibility

Keep native links, buttons, and form controls keyboard-operable, with accessible
names and visible focus indicators. Use `.card:has(:focus-visible)` to give the
card a subtle focus ring for context, but never remove or replace the focused
link or control's own `:focus-visible` indicator.

Preserve the reading order when changing the visual layout. Do not make the card
or its actions depend on hover, pointer input, color alone, or a visual icon
without an accessible name. For related semantic, focus, and control guidance,
see {{ GUIDE_REF("accessibility") }}.

## Fallback strategies

Without container queries or `:has()`, the semantic HTML and stacked layout must
remain usable. Do not make enhanced layout or styling necessary for the card's
content or interaction. If a card's enhanced presentation depends on `:has()`,
provide the same essential content and interaction through the default structure
rather than requiring a script-only replacement.
