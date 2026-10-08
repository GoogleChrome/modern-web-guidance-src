---
name: card
description: "Build a card component that adapts its presentation to its own available space and contents."
web-feature-ids:
  - has
  - container-queries
  - subgrid
guides:
  - size-aware-styling
---

# Build a Card

## Overview

A card groups one related piece of content or one choice. It is a visual pattern, not a fixed semantic or interaction model, so preserve the content's meaning and use the native interaction that matches its purpose.

## Guidelines

Choose the card's semantics from what the card itself represents:

- an `article` when it is independently understandable content (any links and buttons inside it remain separate native controls);
- one native link when the whole card is a single destination;
- a radio button or checkbox with an associated `<label>`, or an `option` in a native `<select>`, when the card is a choice.

Keep media, title, supporting content, and actions in meaningful source order; don't use CSS `order` to contradict it (see {{ GUIDE_REF("css-layout") }}).

## Implementation

When a card’s layout should change with its available width—for example, switching from stacked media and content to a side-by-side layout—put the size-query container on a wrapper around the card. See {{ GUIDE_REF("size-aware-styling") }} for the container-query setup.

```html
<div class="card-container">
  <article class="card">
    <img src="recipe.jpg" alt="Poached eggs on toast">
    <hgroup>
      <h3><a href="/recipes/poached-eggs">Poached eggs</a></h3>
      <p>Breakfast special</p>
    </hgroup>
    <div class="content">
      <p>Two poached eggs served on toasted sourdough.</p>
    </div>
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

For card images or video that should fill a fixed-ratio area, set `aspect-ratio` on the media or its container and use `object-fit: cover` to fill it without distortion (cropping may occur). Otherwise, preserve the media’s intrinsic ratio. Give informative images an appropriate text alternative; use `alt=""` for decorative images.

### Align cards in a grid

When cards need shared internal tracks, `subgrid` can align them without changing source order:

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
.card > .content { grid-row: 3; }
.card > footer { grid-row: 4; }
```

## Interaction models

### Content cards

Use an `<article>` for independently understandable card content. Keep links and buttons as separate native controls. When the card also links to a primary destination, link its title and stretch the pointer hit area across the card with `::after`; elevate secondary controls with `position: relative; z-index: 1` so they remain operable:

```css
.card {
  position: relative; /* Containing block for the stretched link */
}

.card h3 a::after {
  content: ""; /* Stretch the title link across the card */
  position: absolute;
  inset: 0;
}

.card footer :is(button, a) {
  position: relative; /* Keep secondary controls above the overlay */
  z-index: 1;
}
```

### Single-destination cards

When the whole card is one destination and has no independent actions, make it one native link. Do not nest links, buttons, or form controls inside it:

```html
<a class="card" href="/recipes/poached-eggs">
  <h3>Poached eggs</h3>
  <p>Two poached eggs served on toasted sourdough.</p>
</a>
```

### Choice cards

Style native controls and their labels as cards. Use radios for one choice and checkboxes for independent choices:

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

Style the selected option card with `:has(:checked)` using more than color alone (such as border thickness or font weight):

```css
.option-card:has(:checked) {
  /* Pair any color change with non-color indicators (example border width and weight) so selection is never conveyed by color alone */
  border-width: 2px;
  font-weight: 600;
}
```

For choices in a dropdown picker, use a native `<select>` with `appearance: base-select` and style `::picker(select)` and `<option>` elements rather than replacing the select with `<div>` cards; see {{ GUIDE_REF("custom-select-picker-layouts") }}. Use a `<button>` when selecting a card triggers an immediate action rather than setting form state.

## Accessibility

Keep native links, buttons, and form controls keyboard-operable, with accessible names and visible focus indicators. Use `.card:has(:focus-visible)` to give the card a subtle focus ring for context, but never remove or replace the focused link or control's own `:focus-visible` indicator. For related semantic, focus, and control guidance, see {{ GUIDE_REF("accessibility") }}.
