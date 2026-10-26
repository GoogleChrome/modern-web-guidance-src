---
name: skeleton
description: Build skeleton placeholders from existing semantic content using one loading hook and border-shape, so loading states reserve space and reduce layout shifts.
web-feature-ids:
  - border-shape
  - color-mix
  - prefers-reduced-motion
  - inert
  - cap
  - function
  - lh
  - line-clamp
  - user-select
---

# Skeleton loading pattern

A skeleton is a simplified placeholder shown while content loads. It reduces perceived wait time and layout shift.

Style the real semantic elements in place instead of inserting placeholder `<div>`s. One hook on the container (`aria-busy="true"`, scoped by a class such as `.skeleton`) applies a different treatment per element type: text becomes rounded bars, media and avatars become solid blocks, and buttons, inputs and chips keep their own shape and take the fill. The markup does not change to suit the skeleton, and items can be empty or contain real text.

`border-shape` draws the text bars. Each bar is one closed subpath of a single `shape()`, so bars can have rounded ends and variable lengths, which `text-decoration` and gradient tricks cannot do.

For indeterminate activity when layout is unknown, see {{ GUIDE_REF("spinner") }}. For determinate loading, see {{ GUIDE_REF("progress") }}.

## 1. Loading state

MANDATORY: Put `aria-busy="true"` on the container and scope every skeleton style to it, so removing the attribute restores the real content.

```html
<!-- Announce loading once; hide the placeholders from assistive tech.
     The status element is empty here and stays on the page; script sets its text. -->
<p class="loading-status" role="status"></p>
<section class="cards skeleton" aria-busy="true" inert aria-hidden="true">
  <article>
    <div class="media"></div>
    <h2></h2>
    <p></p>
    <a href="/more"></a>
    <button type="button">Subscribe</button>
  </article>
</section>
```

- `inert` blocks interaction. `aria-hidden="true"` stops screen readers reading stale or empty text. The visually hidden `role="status"` message gives one generic announcement instead.
- MANDATORY: Keep the status element on the page, empty, before the skeleton appears, and set its text afterward. Live regions announce changes only, so text that arrives together with the element is not announced. Use one status element per independently loading area, outside its skeleton container so it survives the toggle.
- DO NOT depend on `<figure>` or other markup that exists only for the skeleton.
- When loading finishes, toggle `aria-busy`, `inert` and `aria-hidden` together and clear the status text, so the stale message is not read later and the next load announces again.

```js
const status = document.querySelector('.loading-status');
// Set the text after the region exists; the 100ms delay is an example value
const startLoading = (message) => setTimeout(() => { status.textContent = message; }, 100);
const finishLoading = () => { status.textContent = ''; };
```

## 2. Colors

Skeleton colors belong to the surface. Define `--skeleton-tone` on the container and derive it from the surface with `color-mix(in oklab, …)`, mixing a little of the text color into the surface color, so a darker surface gets a darker skeleton. Derive a lighter `--skeleton-highlight` the same way for the shimmer. Mix in `oklab`, not `srgb`, which blends unevenly. Use the container's real background and text tokens.

MANDATORY: Handle forced colors. It replaces text and background colors, so the transparent text would show and the bar and block fills would disappear. Opt the skeleton out with `forced-color-adjust: none` on the container (the property inherits to everything inside it) and use a system color for the tone, so the placeholders follow the user's theme.

```css
@media (forced-colors: active) {
  .skeleton[aria-busy="true"] {
    forced-color-adjust: none;
    --skeleton-tone: GrayText;
    --skeleton-highlight: GrayText; /* Same as the tone, so there is no shimmer */
  }
}
```

## 3. Text

Text, standalone links and list items share one rule that hides the content and applies the fill. Each element then sets its own bars in a `--bars` custom property, built from a small `--bar()` CSS function, so headings, paragraphs and links differ in bar count and length and not in the rule. Links inside a paragraph, list item or heading are not styled separately: they are hidden along with the surrounding text, so the selector excludes them. `:where()` keeps its specificity unchanged.

```css
/* One rounded bar. --i is the line index, --end is where the bar ends, --start offsets it.
   Reads --bar-height, --bar-gap and --bar-radius from the element it is used on. */
@function --bar(--i <number>, --end <length-percentage>, --start <length>: 0px) {
  --y: calc(var(--i) * (var(--bar-height) + var(--bar-gap)));
  result: move to calc(var(--start) + var(--bar-radius)) var(--y),
    hline to calc(var(--end) - var(--bar-radius)),
    arc to var(--end) calc(var(--y) + var(--bar-radius)) of var(--bar-radius) var(--bar-radius) cw,
    vline to calc(var(--y) + var(--bar-height) - var(--bar-radius)),
    arc to calc(var(--end) - var(--bar-radius)) calc(var(--y) + var(--bar-height)) of var(--bar-radius) var(--bar-radius) cw,
    hline to calc(var(--start) + var(--bar-radius)),
    arc to var(--start) calc(var(--y) + var(--bar-height) - var(--bar-radius)) of var(--bar-radius) var(--bar-radius) cw,
    vline to calc(var(--y) + var(--bar-radius)),
    arc to calc(var(--start) + var(--bar-radius)) var(--y) of var(--bar-radius) var(--bar-radius) cw,
    close;
}

.skeleton[aria-busy="true"] :is(p, h2, li, a:where(:not(:is(p, li, h1, h2, h3) a))) {
  /* Bar height follows the element's own glyphs, and the gap fills the rest of the line,
     so bars sit on the real line pitch for any font size or leading. No per-element overrides. */
  --bar-height: 1cap;
  --bar-radius: calc(var(--bar-height) / 4); /* Half the height gives fully round ends */
  --bar-gap: calc(1lh - var(--bar-height));
  display: block;
  min-block-size: calc(var(--lines, 1) * 1lh); /* Reserves the height of the real text lines */
  line-clamp: var(--lines, 1); /* Limits real text to the bar count (see Fallbacks) */
  overflow: hidden;      /* Clips whatever the clamp or fallback cuts off */
  user-select: none;
  color: transparent;
  text-decoration: none; /* Link underlines would otherwise show through */
  background-color: var(--skeleton-tone);
  border-shape: var(--bars); /* Each element below sets its own --bars */
}

/* Each bar is --bar(line index, end position); --lines is the bar count (default 1) */
.skeleton[aria-busy="true"] h2 {
  --bars: shape(from 0 0, --bar(0, 88%));
}

.skeleton[aria-busy="true"] p {
  --lines: 3;
  --bars: shape(from 0 0, --bar(0, 100%), --bar(1, 92%), --bar(2, 68%));
}

.skeleton[aria-busy="true"] a:where(:not(:is(p, li, h1, h2, h3) a)) {
  --bars: shape(from 0 0, --bar(0, 42%));
}
```

Set the shape on `--bars` and read it with `border-shape: var(--bars)`. Do not call `--bar()` directly inside a `border-shape: shape()` declaration: some browsers then discard the rules that follow it.

Derive the bar size from the element instead of tuning it per element: `cap` follows the element's font size, so a heading gets taller bars than body text with no override, and `lh` gives the line pitch, so bars land where the real lines would and the placeholder takes the same height as the text for any leading. Do not size bars in `lh` alone, which scales with line-height rather than glyph size, or with fixed values that need a different number for each element.

Draw the bullet as a shape, not with `::marker`: the `overflow: hidden` above clips an outside marker, and a marker cannot take the shimmer background. Remove the list's own padding and marker, and draw the dot inside the `li` box with a second function that draws a circle with two arcs, then start the bar at the real list's indent. This applies to bulleted lists; do not use the dot for a numbered list.

```css
@function --dot(--size <length>) {
  result: move to 0 calc(var(--bar-height) / 2),
    arc to var(--size) calc(var(--bar-height) / 2) of calc(var(--size) / 2) calc(var(--size) / 2) cw,
    arc to 0 calc(var(--bar-height) / 2) of calc(var(--size) / 2) calc(var(--size) / 2) cw,
    close;
}

.skeleton[aria-busy="true"] ul {
  padding: 0;
  list-style: none;
}

.skeleton[aria-busy="true"] li {
  --text-start: 1.25em; /* Same indent as the real list, so the text does not shift */
  --line-one: 72%;      /* Vary this per item */
  --bars: shape(from 0 0,
    --dot(calc(var(--bar-height) * .8)),
    --bar(0, var(--line-one), var(--text-start)));
}
```

Set `--lines` to the bar count (default `1`). `line-clamp` limits the real text to that many lines, and the `lh`-based `min-block-size` reserves their height, because `line-clamp` alone does not reserve height. A `min-block-size` does not stop surplus text from growing the box, so where `line-clamp` is unsupported, use the fallback below.

For more than one bar, call `--bar()` once per bar with its index and end position. `shape()` cannot repeat a path from a count, so each call is written out. Bars are offset by `n × 1lh`, and `--lines` is the bar count so `min-block-size` reserves the total height.

| Element | Treatment |
|---|---|
| `h1`–`h3` | 1 bar, sized by the heading's own font size so hierarchy matches the real template. For headings that usually wrap, add a second `--bar()` and set `--lines: 2` |
| `p` | 3 bars, last one shorter like a real paragraph |
| `li` | 1 bar each, with a small circle for the bullet; vary widths. Start the bar at the real list's indent so the text does not shift when content arrives |
| `a` | Standalone link (not inside `p`, `li` or a heading): 1 short bar (ending at 42%). Inline links are hidden with the surrounding text |

## 4. Media and avatars

Style the real `<img>`, `<video>` or `<canvas>` in place. Do not swap in a placeholder `<div>`. Push the picture out of the box so the tone shows through, and reserve space with `aspect-ratio`. This needs definite dimensions, so set `inline-size` (or `block-size`) as well.

```css
.skeleton[aria-busy="true"] :is(img, video, canvas) {
  background-color: var(--skeleton-tone);
  aspect-ratio: 16 / 10;
  object-position: -9999px 0; /* A length, not a percentage, moves the picture outside the box so it is clipped */
}

.skeleton[aria-busy="true"] .avatar {
  border-radius: 50%;
  aspect-ratio: 1;
}
```

- Use a length for `object-position`. A percentage does not move the picture out of the box.
- DO NOT use `content: linear-gradient()` to remove the picture: it is not interoperable and does not work on `<video>` or `<canvas>`.
- Neither technique works on an inline `<svg>`.
- Remove the `controls` attribute from a skeleton `<video>`, since the browser's controls still draw over the placeholder.

## 5. Controls and chips

Elements that are themselves the visible shape and have no children with their own skeleton treatment (buttons, inputs, badges and chips) already have a shape: keep their own size, padding, border width and `border-radius`, and only hide the content and apply the skeleton fill. DO NOT replace them with text bars or give them a fixed block size, which would shift the layout when the real control arrives.

Containers such as a card, `<footer>` or `<nav>` keep their real background and layout. Style the text, media and controls inside them instead.

```css
.skeleton[aria-busy="true"] :is(button, input) { /* Add badge and chip selectors here */
  color: transparent;
  border-color: transparent; /* Keeps the border width, so the box does not change size */
  caret-color: transparent;
  background-image: none;    /* Drop a real gradient; the shimmer sets its own */
  user-select: none;
  background-color: var(--skeleton-tone);
}

.skeleton[aria-busy="true"] input::placeholder {
  color: transparent;
}

.skeleton[aria-busy="true"] button > * { /* Add badge and chip selectors here too */
  visibility: hidden; /* Icons and nested elements keep their space but disappear */
}
```

Put a representative label in the skeleton markup (as in the example above) so the control gets its natural size. If the label is unknown, give an empty button a line box with `::before { content: "\200b" }` and size its inline axis with `ch` or `em`, not a fixed length.

| Element | Treatment |
|---|---|
| `button` | Own padding, border and radius, with the tone as its fill and the label hidden |
| `input` | Own size, padding, border and radius, with the tone as its fill; value and placeholder hidden |
| Badge, chip | Own padding and radius, with the tone as its fill and the text hidden |

## 6. Simplify

A skeleton is a simplification, not a copy. Keep what defines the silhouette (media, title, a few lines of body, the primary action) and hide the rest.

- Cap long text at 3–4 bars by calling `--bar()` that many times. `line-clamp` (or its fallback) and `overflow: hidden` keep surplus text from adding lines. Cap collections at a few items as described below.
- To cap items, use a fixed `:nth-child(n + N)` selector with `display: none`. If the count must come from a custom property, read it in a small script, because CSS cannot use a custom property inside `:nth-child()`.
- Remove whole cards or rows with `display: none`. For items inside a card, use `visibility: hidden` so the card height does not change when the real content arrives.
- Decide what to hide by asking whether removing it changes the container's height. If it does, keep or reserve it.

## 7. Shimmer

Add a shimmer so users can tell the placeholders are actively loading and not broken.

Paint the shimmer on each placeholder shape's own `background`, not on a parent overlay, so every element works alone and you can apply the skeleton to just the part of a card that is updating. Keep the tone as `background-color` and add a 110° `linear-gradient` as `background-image` that is transparent, then `--skeleton-highlight`, then transparent. Use `background-attachment: fixed` so all shapes share one coordinate space and sweep in sync, and a keyframe animation of `background-position` over about 1.8s, linear and infinite. Do not use `mix-blend-mode`: it assumes a light surface, and the themed `--skeleton-tone` and `--skeleton-highlight` already adapt to any surface.

With `background-attachment: fixed` the sweep is sized to the viewport, so a small loading area catches the highlight only briefly on each pass. Shorten the duration for small areas.

DO NOT animate the `border-shape` path or the bars' visibility: it flashes. Animate the background.

MANDATORY: Apply the shimmer (gradient and animation) only under `@media (prefers-reduced-motion: no-preference)`. Without it, the placeholders stay visible as a flat `--skeleton-tone` fill.

## Fallbacks

### border-shape

{{ BASELINE_STATUS("border-shape") }}

If your Baseline target does not support `border-shape`, use `@supports (border-shape: shape(from 0 0, close))` to scope the bar shapes, and let other browsers show a solid `--skeleton-tone` fill with `border-radius` on the same elements, sized by `min-block-size` in `lh` units. Multi-line bars and variable lengths are the progressive enhancement. The layout reservation still prevents shift.

```css
@supports not (border-shape: shape(from 0 0, close)) {
  .skeleton[aria-busy="true"] :is(p, h2, li, a:where(:not(:is(p, li, h1, h2, h3) a))) {
    border-radius: var(--bar-radius);
  }
}
```

### @function

{{ BASELINE_STATUS("function") }}

If your Baseline target does not support `@function`, do not use CSS functions at all: write each bar out as a `shape()` subpath in `--bars`, and the same for the bullet's two arcs. Browsers without `@function` otherwise drop the `--bars` value and show a solid `--skeleton-tone` fill without bars. A single bar ending at 42%:

```css
.skeleton[aria-busy="true"] a:where(:not(:is(p, li, h1, h2, h3) a)) {
  --bars: shape(from var(--bar-radius) 0,
    hline to calc(42% - var(--bar-radius)),
    arc to 42% var(--bar-radius) of var(--bar-radius) var(--bar-radius) cw,
    vline to calc(var(--bar-height) - var(--bar-radius)),
    arc to calc(42% - var(--bar-radius)) var(--bar-height) of var(--bar-radius) var(--bar-radius) cw,
    hline to var(--bar-radius),
    arc to 0 calc(var(--bar-height) - var(--bar-radius)) of var(--bar-radius) var(--bar-radius) cw,
    vline to var(--bar-radius),
    arc to var(--bar-radius) 0 of var(--bar-radius) var(--bar-radius) cw,
    close);
}
```

For each further bar, add a `move to` and another closed rounded rectangle to the same `shape()`, adding `n × (--bar-height + --bar-gap)` to every y coordinate and giving it its own end position.

### line-clamp

{{ BASELINE_STATUS("line-clamp") }}

If your Baseline target does not support `line-clamp`, cap the height instead. `overflow: hidden` clips what exceeds it, and the cap equals the bar count's height in `lh` units, so layout is unchanged.

```css
@supports not (line-clamp: 1) {
  .skeleton[aria-busy="true"] :is(p, h2, li, a:where(:not(:is(p, li, h1, h2, h3) a))) {
    max-block-size: calc(var(--lines, 1) * 1lh);
  }
}
```
