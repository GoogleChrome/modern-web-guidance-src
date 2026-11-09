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

This guide does not cover use cases where wrapping is an acceptable option.

There are two components to handling single-line text overflow:
1. How to display the truncated text
2. How can users find out what the full text is

{# TODO Handle SVG #}

## How to display truncated text

Truncation is visual only. Screen readers announce the full text, find-in-page matches it, and copying copies it. This is why the string must never be cut in script.

If scaling the text down is acceptable, you can use `text-fit: shrink` with a lower limit (e.g. `text-fit: shrink 60%` to never go below 60% of the font size), and combine with any of the strategies below for the remaining overflow, if any.
Note that `text-fit` does not change the computed `font-size` and does not grow content-sized containers, so the element needs an inline size from its layout.

### 1. Truncate with an ellipsis (at the end or middle)

```css
.label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- In flex/grid: Let the containing flex or grid item shrink. Items refuse to shrink below their content by default (`min-inline-size: auto`). When the truncated element is the item itself, `overflow: hidden` already allows it; when it is a descendant (such as a label inside a button), set `min-inline-size: 0` on the item.
- In tables, set `table-layout: fixed` and an inline size on the table. With automatic layout, cells grow to fit their text instead of truncating it.
- An element's own `overflow: hidden` does not clip its own focus outline, so buttons and links can truncate their text directly. Outlines are clipped by an ancestor that clips overflow, such as a scrolling row of items; give those items an inset outline (`outline-offset: -2px`).

#### Keeping the end visible

Wrap the part that may truncate, such as everything before the file extension or the last few characters, and leave the end as plain text after it. The split is in the markup (or done once in script when rendering), never by cutting characters out.

```html
<!-- No whitespace before the extension, or it renders as a space -->
<span class="filename"><span>quarterly-report-final-v2</span>.pdf</span>
```

```css
.filename {
  display: flex;
  white-space: nowrap;
}

/* The trailing text is an anonymous flex item, which never shrinks below its content */
.filename > span {
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### 2. Fade out the end

Use a mask that fades the end of the text. Only fade when the text overflows, or text that fits fades for no reason. An element with `overflow: hidden` is a scroll container, so its scroll timeline is only active when its content overflows. An animation on that timeline applies exactly when the text is truncated:

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
  /* Gradient directions and positions are physical, so flip them for right-to-left text */
  --fade-dir: right;
  --fade-pos: 100%;
  /* An opaque layer that is not clipped to the box, minus a band at the end.
     Masking only the band keeps everything else visible, including a focus outline outside the box. */
  mask:
    linear-gradient(black, black) no-clip subtract,
    linear-gradient(to var(--fade-dir), transparent, black) var(--fade-pos) 0 / var(--fade) 100% no-repeat no-clip;
  /* Applies only when the text overflows: with no overflow the timeline is inactive and the animation has no effect */
  animation: fade-end linear both;
  animation-timeline: scroll(self inline);

  &:dir(rtl) {
    --fade-dir: left;
    --fade-pos: 0;
  }
}

@keyframes fade-end {
  from, to {
    --fade: var(--fade-size);
  }
}
```

Keep the two properties separate. The reveal below transitions `--fade-size`, and a keyframe that set the mask directly would not follow that transition.

DO NOT use a single gradient as the mask. A mask is clipped to the border box by default, so it also hides the element's focus outline, which is outside the box.

### 3. Replace with a predefined shorter version

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

## Reveal full text on demand

Reveal on `:hover` and `:focus-visible` of the interactive element, never on hover alone. Move the text only when `prefers-reduced-motion` is `no-preference`; otherwise leave the ellipsis.

Hover and focus reveal nothing on touch. Give the full text another route: the selected item shows it untruncated (a selected tab is never shrunk), a row opens a detail view, or the text is also shown in full elsewhere.

Choose by whether the element may grow:

1. **Scroll the text inside its box** when nothing else may move: grids, tables, tab strips, dense lists. The element keeps its size.
2. **Expand the element** when it may grow to its text, such as a chip or a tag with a `min-inline-size` and `max-inline-size`. Siblings shift to make room, so do not use it in grids or tables, where it breaks alignment.
3. **Use a tooltip** when it would add information beyond the label, or when the full text can be exceedingly long (methods 1 and 2 are less tolerant of extreme variance)

### 1. Scroll the text inside its box

Move the text by the difference between the element's width and its own: a percentage margin resolves against the element, a percentage translate against the text itself. A scroll-state query limits this to truncated text, so text that fits stays put. The inner `span` is the only extra markup: it becomes the box that moves. The same class works on non-interactive elements such as list items, where hover still reveals.

```html
<a class="label" href="…"><span>Meeting notes from Tuesday afternoon</span></a>
```

```css
.label {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* Lets descendants query whether the text overflows. Unlike size containment, this does not affect the element's size. */
  container-type: scroll-state;
}

@media (prefers-reduced-motion: no-preference) {
  /* Outside the query: a container cannot query itself */
  .label:is(:hover, :focus-visible) {
    text-overflow: clip;
  }

  @container scroll-state(scrollable: inline-end) {
    .label:is(:hover, :focus-visible) > span {
      /* Needs its own box to be moved. It stays inline otherwise, so the ellipsis renders. */
      display: inline-block;
      /* Forward by the element's width, then back by the text's own width */
      margin-inline-start: 100%;
      /* 1px short, so the text still counts as overflowing and the query keeps matching */
      translate: calc(1px - 100%);
      /* Example value. Set only here: when the pointer leaves, the text snaps back behind the ellipsis */
      transition: margin-inline-start 2s linear, translate 2s linear;
    }

    /* The overflow is on the left, so the text moves right */
    .label:is(:hover, :focus-visible):dir(rtl) > span {
      translate: calc(100% - 1px);
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

### 2. Expand the element

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

### 3. Use a tooltip

A tooltip is exposed as the element's description, while the label stays its name.
If the tooltip only repeats the label, hide it from assistive technology (`aria-hidden="true"`), or screen readers announce the text twice.
If it adds information, leave it exposed: name and description are announced as different things.
DO NOT rely on `title` alone: it is unreachable from the keyboard and on touch.
See {{ GUIDE_REF("interest-triggered-tooltips") }} for tooltips.

## Detecting whether the text is truncated

No property reports truncation. Derive it from overflow: the element is truncated when it can scroll toward its inline end. `text-overflow` only changes painting, so this holds with an ellipsis too.

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

## Fallback strategies

### Fallbacks & browser support for scroll-driven animations

{{ BASELINE_STATUS("scroll-driven-animations") }}

Without scroll-driven animations the fade never shows, and the text is clipped with no indication. If your Baseline target does not support them, use an ellipsis instead, or toggle the fade from script: a `ResizeObserver` compares `scrollWidth` to `clientWidth` and sets a class, which turns the fade on the same way the keyframes do. Run the check again when the text changes: `ResizeObserver` reacts only to size changes.

```js
if (!CSS.supports('animation-timeline', 'scroll()')) {
  const observer = new ResizeObserver(entries => {
    for (const { target } of entries) {
      target.classList.toggle('truncated', target.scrollWidth > target.clientWidth);
    }
  });

  for (const label of document.querySelectorAll('.label')) {
    observer.observe(label);
  }
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

Without scroll-state queries the text still truncates, but the hint never shows and the scroll reveal never starts. Set a class from script instead and gate both on it.

```js
if (!CSS.supports('container-type', 'scroll-state')) {
  const observer = new ResizeObserver(entries => {
    for (const { target } of entries) {
      target.classList.toggle('truncated', target.scrollWidth > target.clientWidth);
    }
  });

  for (const label of document.querySelectorAll('.label')) {
    observer.observe(label);
  }
}
```

```css
/* Same as the scroll-state queries */
.label.truncated > span {
  text-decoration: underline dotted;
}

@media (prefers-reduced-motion: no-preference) {
  .label.truncated:is(:hover, :focus-visible) > span {
    display: inline-block;
    margin-inline-start: 100%;
    translate: calc(1px - 100%);
    transition: margin-inline-start 2s linear, translate 2s linear;
  }
}
```

### Fallbacks & browser support for `interpolate-size`

{{ BASELINE_STATUS("interpolate-size") }}

Without it, the element expands instantly instead of transitioning. No fallback is needed.

### Fallbacks & browser support for `text-fit`

{{ BASELINE_STATUS("text-fit") }}

Without it, the text is not scaled and the strategy it is combined with handles all of the overflow. For text of predictable length, such as numbers, `font-size: clamp(1.5rem, 12cqi, 4rem)` on a size container approximates the scaling, but scales with the container rather than the text.

### Fallbacks & browser support for container queries

{{ BASELINE_STATUS("container-queries") }}

Container queries and their units are widely available. No fallback is needed.

### Fallbacks & browser support for masks

{{ BASELINE_STATUS("masks") }}

Masks, including `mask-composite` and `mask-clip: no-clip`, are widely available. No fallback is needed.
