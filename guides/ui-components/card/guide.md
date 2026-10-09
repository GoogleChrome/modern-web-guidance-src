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

Choose semantics for the content and its interaction separately:

- use an `article` for independently understandable content, whether or not it links to a destination;
- use a native link for navigation. When the whole card is one destination, the link may wrap the `article` if the content merits article semantics and contains no other interactive elements;
- keep links and buttons for independent actions as separate native controls;
- use a radio button or checkbox with an associated `<label>`, or an `option` in a native `<select>`, when the card is a choice.

Keep media, title, supporting content, and actions in meaningful source order; don't use CSS `order` to contradict it (see {{ GUIDE_REF("css-layout") }}).

## Implementation

This example shows the structure of a content card with media, a linked title, supporting text, and separate actions. Choose the link and action pattern that matches the card’s behaviour; see [Interaction models](#interaction-models).

```html
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
```

For card images or video that should fill a fixed-ratio area, set `aspect-ratio` on the media or its container and use `object-fit: cover` to fill it without distortion (cropping may occur). Otherwise, preserve the media’s intrinsic ratio. Give informative images an appropriate text alternative; use `alt=""` for decorative images.

### Align cards in a grid

When cards need shared internal tracks, `subgrid` can align them without changing source order:

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); /* 18rem is an example minimum card width */
  /* Four tracks: media, heading, flexible body, and footer */
  grid-auto-rows: auto auto 1fr auto;
  gap: 1.5rem; /* Example grid gap */

  > .card {
    display: grid;
    /* Span the shared tracks; layout containment on the card prevents subgrid */
    grid-row: span 4;
    grid-template-rows: subgrid;
    row-gap: 0.75rem;

    /* Keep optional regions in their intended tracks */
    > :is(img, picture, video, svg) { grid-row: 1; }
    > hgroup { grid-row: 2; }
    > .content { grid-row: 3; }
    > footer { grid-row: 4; }
  }
}
```

## Interaction models

### Content cards

Use an `<article>` for independently understandable card content. Keep links and buttons as separate native controls. When the card also links to a primary destination, link its title and stretch the pointer hit area across the card with `::after`; elevate secondary controls with `position: relative; z-index: 1` so they remain operable:

```css
.card {
  position: relative; /* Containing block for the stretched link */

  h3 a::after {
    content: ""; /* Stretch the title link across the card */
    position: absolute;
    inset: 0;
  }

  footer :is(button, a) {
    position: relative; /* Keep secondary controls above the overlay */
    z-index: 1;
  }
}
```

### Single-destination cards

When the whole card is one destination and has no independent actions, use one native link. If the content is independently understandable, the link can wrap an `<article>`. Do not nest other links, buttons, or form controls inside the link:

```html
<a href="/recipes/poached-eggs">
  <article class="card">
    <h3>Poached eggs</h3>
    <p>Two poached eggs served on toasted sourdough.</p>
  </article>
</a>
```

### Choice cards

Style native controls and their labels as cards. Use radios for one choice and checkboxes for independent choices:

```html
<fieldset>
  <legend>Choose a delivery method</legend>
  <label class="card">
    <input type="radio" name="delivery" value="standard">
    <span>
      <strong>Standard delivery</strong>
      <span>Arrives in 3–5 working days</span>
    </span>
  </label>
  <label class="card">
    <input type="radio" name="delivery" value="express">
    <span>
      <strong>Express delivery</strong>
      <span>Arrives the next working day</span>
    </span>
  </label>
</fieldset>
```

Style the selected option card with `:has(:checked)` using more than color alone (such as border thickness or font weight):

```css
.card {
  &:has(:checked) {
    /* Pair any color change with non-color indicators, such as border width or weight */
    border-width: 2px;
    font-weight: 600;
  }
}
```

When choices belong in a dropdown picker whose options are laid out as cards, use a native `<select>` with `appearance: base-select` and style `::picker(select)` and `<option>` elements rather than replacing the select with `<div>` cards; see {{ GUIDE_REF("custom-select-picker-layouts") }} for more details and fallbacks. Use `<button>` elements when selecting a card triggers an immediate action rather than setting form state.

## Accessibility

Keep native links, buttons, and form controls keyboard-operable, with accessible names and visible focus indicators. Use `.card:has(:focus-visible)` to give the card a subtle focus ring for context, but never remove or replace the focused link or control's own `:focus-visible` indicator. For related semantic, focus, and control guidance, see {{ GUIDE_REF("accessibility") }}.
