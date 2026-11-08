---
name: single-line-overflow
description: "Show text that must stay on one line, such as a tab label, table cell, navigation item, or file name, in a space it may not fit, without breaking the layout or losing the text."
web-feature-ids:
  - text-overflow
  - overflow-wrap
  - hyphens
  - container-queries
  - scroll-driven-animations
  - container-scroll-state-queries
  - masks
  - interpolate-size
  - text-fit
  - resize-observer
guides:
  - interest-triggered-tooltips
---

# Single-line text overflow

Text that has to stay on one line (tab and chip labels, table cells, sidebar items, file names, media titles) is often longer than its space, especially with user content and translations.
Keep the full text in the DOM and only adapt how it renders: the full text is the accessible name, and what find-in-page, copy, and search see.

First check that one line is really required. If the text may wrap, let it wrap: `overflow-wrap: anywhere` breaks long unbreakable strings such as URLs, and `hyphens: auto` breaks long words.

## Choosing a strategy

The strategies combine. Start with one of the first three, then add a reveal or a shorter version as needed.

- **Truncate with an ellipsis** (default). The start of the text identifies it, and the ellipsis tells users it is cut.
- **Fade out the end** instead, when the text is a preview rather than an identifier (message snippets, descriptions), or when many truncated items sit together and the ellipses add noise.
- **Keep the end visible** when the end differentiates: file names with extensions, paths, identifiers with a common prefix.
- **Reveal the full text on hover and focus** when users compare similar items in place (document lists, tabs, table cells). Scroll the text inside its box, or expand the element.
- **Swap in a shorter version** when one exists: weekday and month names, units, labels with an established abbreviation. This is also the only option for SVG `<text>`, such as chart labels, which supports none of the properties below.
- **Scale the text down** only for display text (headings, big numbers in dashboard tiles). Never shrink UI labels or body text.

## Truncating with an ellipsis

```css
.label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- Apply it to the element that directly contains the text. It must be a block container: not the flex or grid container, not an inline element.
- MANDATORY: Let the containing flex or grid item shrink. Items refuse to shrink below their content by default (`min-inline-size: auto`). When the truncated element is the item itself, `overflow: hidden` already allows it; when it is a descendant (such as a label inside a button), set `min-inline-size: 0` on the item.
- In tables, set `table-layout: fixed` and an inline size on the table. With automatic layout, cells grow to fit their text instead of truncating it.
- An element's own `overflow: hidden` does not clip its own focus outline, so buttons and links can truncate their text directly. Outlines are clipped by an ancestor that clips overflow, such as a scrolling row of items; give those items an inset outline (`outline-offset: -2px`).
- DO NOT shorten the string in script (`slice`, character counts). It breaks the accessible name, search, and copy, and it guesses wrong about glyph widths and translations.
- DO NOT use `direction: rtl` to put the ellipsis at the start. It reorders punctuation and digits. To keep the end visible, split the text instead (below).

## Fading out the end

Replace the ellipsis with a mask that fades the end of the text. Only fade when the text overflows, or text that fits fades for no reason. An element with `overflow: hidden` is a scroll container, so its scroll timeline is only active when its content overflows. An animation on that timeline applies exactly when the text is truncated:

```css
/* --fade-size is the configured size, --fade the live value the animation turns on.
   Both registered: unregistered custom properties neither animate nor transition. */
@property --fade-size {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

@property --fade {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

.label {
  white-space: nowrap;
  overflow: hidden;
  /* Example value: how much of the text fades */
  --fade-size: 2rem;
  /* Use `to left` for right-to-left text */
  mask-image: linear-gradient(to right, black calc(100% - var(--fade)), transparent);
  /* Applies only when the text overflows: with no overflow the timeline is inactive and the animation has no effect */
  animation: fade-end linear both;
  animation-timeline: scroll(self inline);
}

@keyframes fade-end {
  from, to {
    --fade: var(--fade-size);
  }
}
```

Keep the two properties separate. The reveal below transitions `--fade-size`, and a keyframe that set the mask directly would not follow that transition.

## Keeping the end visible

Split the text into a start that truncates and an end that never shrinks, such as the file extension or the last few characters. The split is in the markup (or done once in script when rendering), never by cutting characters out.

```html
<span class="filename"><span class="start">quarterly-report-final-v2</span><span class="end">.pdf</span></span>
```

```css
.filename {
  display: flex;
}

.start {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.end {
  flex: none;
}
```

## Revealing the full text on hover and focus

Reveal on `:hover` and `:focus-visible` of the interactive element, never on hover alone. Move the text only when `prefers-reduced-motion` is `no-preference`; otherwise leave the ellipsis. Touch has no hover, so the full text must also be reachable another way (see below).

Choose by how the element is sized:

- **Scroll the text inside its box** when the element's width comes from its container: a grid track, a fixed-layout table column, a block in a sidebar, a `flex: 1` item. Nothing else moves, so it works in dense layouts.
- **Expand the element** when its width comes from its content, such as tabs or chips with a `min-inline-size` and `max-inline-size`. Siblings shift to make room, so do not use it in grids or tables, where it breaks alignment.

### Scrolling the text

The element is a size container, so its child can compute "container width minus my width" with container query units. The inner `span` is the only extra markup: it becomes the box that moves. The same class works on non-interactive elements such as list items, where hover still reveals.

```html
<a class="label" href="…"><span>Meeting notes from Tuesday afternoon</span></a>
```

```css
.label {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* Lets the inner span measure the available width as 100cqi.
     Inline-size containment removes the element's content from its intrinsic size,
     which is why this only suits elements sized by their container. */
  container-type: inline-size;
}

@media (prefers-reduced-motion: no-preference) {
  .label:is(:hover, :focus-visible) {
    text-overflow: clip;

    & > span {
      /* Needs its own box to be translated. It stays inline otherwise, so the ellipsis renders. */
      display: inline-block;
      inline-size: max-content;
      /* Container width minus text width: negative when truncated, clamped to 0 when the text fits */
      translate: min(0px, 100cqi - 100%);
      /* Example value. Set only here: when the pointer leaves, the text snaps back behind the ellipsis */
      transition: translate 2s linear;
    }
  }
}
```

The duration is fixed, so longer text scrolls faster. Pick it for the longest text you expect.

With a fade instead of an ellipsis, the text would scroll under the fade and its end would stay unreadable. Shrink the fade in step with the scroll, so it is gone when the end arrives:

```css
@media (prefers-reduced-motion: no-preference) {
  .label:is(:hover, :focus-visible) {
    --fade-size: 0px;
    /* Same duration as the scroll. Set only here, so the fade is back as soon as the text snaps back. */
    transition: --fade-size 2s linear;
  }
}
```

### Expanding the element

Let the element grow to its text, and transition the growth. Set `interpolate-size: allow-keywords` so the transition can interpolate to `max-content`.

```css
.chip {
  /* Example values */
  min-inline-size: 6rem;
  max-inline-size: 12rem;
  interpolate-size: allow-keywords;

  &:is(:hover, :focus-visible) {
    /* min-inline-size overrides max-inline-size, so the full label always fits */
    min-inline-size: max-content;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: min-inline-size .3s;
  }
}
```

## Swapping in a shorter version

Put both versions in the markup and switch them with a container query on the cell or item. Use a short form that is understood on its own (Sat, Nov, kg), because it becomes the accessible name while shown.

```html
<!-- The wrapper is the container: size containment has no effect on table cells themselves -->
<td><div class="day"><span class="long">Saturday</span><span class="short">Sat</span></div></td>
```

```css
.day {
  container-type: inline-size;
}

.short {
  display: none;
}

/* Example threshold: relative units resolve against the container's own font */
@container (inline-size < 6em) {
  .long {
    display: none;
  }

  .short {
    display: inline;
  }
}
```

## Scaling display text down

Use `text-fit: shrink` with a lower limit, and keep an ellipsis as the fallback for text that is still too long at that limit.

```css
.stat {
  white-space: nowrap;
  /* Example value: never below 60% of the font size. Always set a limit, or the text can become unreadable. */
  text-fit: shrink 60%;
  /* Takes over when the text does not fit even at the limit */
  overflow: hidden;
  text-overflow: ellipsis;
}
```

`text-fit` does not change the computed `font-size` and does not grow content-sized containers, so the element needs an inline size from its layout.

## Detecting whether the text is truncated

No property reports truncation. Derive it from overflow: the element is truncated when it can scroll toward its inline end.

- **In CSS, on the element itself**, use a scroll-driven animation on its own inline scroll timeline, as in the fade above. Any declarations in the keyframes apply only while the text overflows.
- **In CSS, on descendants and pseudo-elements**, make the element a scroll-state container and query it. For example, to hint that hovering reveals more:

  ```css
  .label {
    container-type: scroll-state;
  }

  @container scroll-state(scrollable: inline-end) {
    .label > span {
      text-decoration: underline dotted;
    }
  }
  ```

- **In script**, when the result drives something CSS cannot (adding a tooltip, setting an attribute), compare `scrollWidth` to `clientWidth` in a `ResizeObserver`. Run the check again when the text changes: `ResizeObserver` reacts only to size changes.

  ```js
  const observer = new ResizeObserver(entries => {
    for (const { target } of entries) {
      target.classList.toggle('truncated', target.scrollWidth > target.clientWidth);
    }
  });
  observer.observe(label);
  ```

## Making the full text reachable

- Truncation is visual only. Screen readers announce the full text, find-in-page matches it, and copying copies it. This is why the string must never be cut in script.
- Hover and focus reveal nothing on touch. Give the full text another route: the selected item shows it untruncated (a selected tab is never shrunk), a row opens a detail view, or the text is also shown in full elsewhere.
- Use a tooltip only when it says more than the label (a file's full path, a description). A tooltip is exposed as the element's description, so one that only repeats the label makes screen readers announce it twice. See {{ GUIDE_REF("interest-triggered-tooltips") }} for tooltips. DO NOT rely on `title` alone: it is unreachable from the keyboard and on touch.

## Fallback strategies

### Fallbacks & browser support for scroll-driven animations

{{ BASELINE_STATUS("scroll-driven-animations") }}

Without scroll-driven animations the fade never shows, and the text is clipped with no indication. If your Baseline target does not support them, use the script detection above to toggle a class that applies the mask, or use an ellipsis instead.

```js
if (!CSS.supports('animation-timeline', 'scroll()')) {
  // Observe the labels with the ResizeObserver above
}
```

```css
/* Same as the keyframes */
.label.truncated {
  --fade: var(--fade-size);
}
```

### Fallbacks & browser support for scroll-state container queries

{{ BASELINE_STATUS("container-scroll-state-queries") }}

Hints on descendants are an enhancement: without them the text still truncates. Where the hint matters, toggle a class with the script detection instead.

### Fallbacks & browser support for `interpolate-size`

{{ BASELINE_STATUS("interpolate-size") }}

Without it, the element expands instantly instead of transitioning. No fallback is needed.

### Fallbacks & browser support for `text-fit`

{{ BASELINE_STATUS("text-fit") }}

Without it, the text truncates with the ellipsis declared alongside. For text of predictable length, such as numbers, `font-size: clamp(1.5rem, 12cqi, 4rem)` on a size container approximates the scaling, but scales with the container rather than the text.

### Fallbacks & browser support for container queries

{{ BASELINE_STATUS("container-queries") }}

Container queries and their units are widely available. No fallback is needed.

### Fallbacks & browser support for masks

{{ BASELINE_STATUS("masks") }}

`mask-image` is widely available. No fallback is needed.
