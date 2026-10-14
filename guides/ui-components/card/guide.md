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

Keep the markup minimal and let CSS selectors recognize each region, so simple cards stay simple and richer cards stay possible. A card has up to four regions, in this source order, and any of them can be omitted:

- **Media**: an `<img>`, `<picture>`, `<video>`, or `<svg>` as the first child. For arbitrary hero content, use any element with a `.media` class.
- **Header**: a heading on its own. Use `<hgroup>` only when the heading has a subtitle or tagline, and `<header>` when the region carries more than a title, such as a byline or badge. When the card has a primary destination, the link goes inside the heading.
- **Content**: whatever the content is, from a single `<p>` to several paragraphs, a list, or a `<dl>`. Do not wrap a single element.
- **Footer**: a `<footer>` holding independent actions as native links and buttons.

The simplest card is an `<article>` containing a heading and a paragraph. Choose the link and action pattern that matches the card's behavior; see [Interaction models](#interaction-models).

For card images or video that should fill a fixed-ratio area, set `aspect-ratio` on the media or its container and use `object-fit: cover` to fill it without distortion (cropping may occur). Otherwise, preserve the media's intrinsic ratio. Give informative images an appropriate text alternative; use `alt=""` for decorative images.

### Align cards in a grid

When cards in a row should share the heights of their regions, use `subgrid`: make each card span four shared row tracks (media, header, content, footer) and place regions by element selector, treating everything that is not media, a heading, or a `<footer>` as content. A card that omits a region leaves its track empty, so the remaining regions still line up with neighboring cards. Each track holds one grid item, so wrap the content region in a `<div>` only when it has more than one element and cards share tracks. Cards that are not aligned with siblings need neither wrapper nor subgrid.

## Interaction models

### Content cards

Use an `<article>` for independently understandable card content. Keep links and buttons as separate native controls. 

When the card also links to a primary destination and needs to be clickable as a whole:
- Use a single opt-in, on the primary link itself.
- Link its title and stretch the pointer hit area across the card with `::after`

```css
.card:has(a.card-link) {
	position: relative;
}

.card a.card-link::after {
	content: "";
	position: absolute;
	inset: 0;
}
```

- Elevate interactive elements with `position: relative; z-index: 1` so they remain operable. Target types of elements (e.g. `a, button`) rather than requiring opt-in via classes. 
- Do NOT apply `z-index` to entire containers as that would make them capture pointer events that don't produce any action.

```css
.card:has(a.card-link) {
	/* Keep other interactive elements above the overlay */
	a:not(.card-link), button, input, x-button {
	    position: relative;
	    z-index: 1;
	}
}
```

- Style the card itself on hover/focus, rather than the stretched link:

```css
.card {
	a.card-link {
		&:focus-visible {
			outline: none; /* Draw it on the card instead */
		}
	}
	
	&:has(a.card-link:focus-visible) {
		/* Focus ring */
	}

	&:has(a.card-link:hover) {
		/* Hover styles */
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

For cards that represent predefined choices, use `<label class="card">` with a checkbox or radio as a direct child.

Style the selected option card with `:has(:checked)` using more than color alone (such as border thickness or font weight):

```css
.card {
  &:has(> :checked) {
    /* Pair any color change with non-color indicators, such as border width or weight */
    border-width: 2px;
    font-weight: 600;
  }
}
```

When choices belong in a dropdown picker whose options are laid out as cards, use a native `<select>` with `appearance: base-select` and style `::picker(select)` and `<option>` elements rather than replacing the select with `<div>` cards; see {{ GUIDE_REF("custom-select-picker-layouts") }} for more details and fallbacks. Use `<button>` elements when selecting a card triggers an immediate action rather than setting form state.

## Accessibility

Keep native links, buttons, and form controls keyboard-operable, with accessible names and visible focus indicators. Use `.card:has(:focus-visible)` to give the card a subtle focus ring for context, but never remove or replace the focused link or control's own `:focus-visible` indicator. For related semantic, focus, and control guidance, see {{ GUIDE_REF("accessibility") }}.
