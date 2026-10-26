---
name: skeleton
description: Build skeleton placeholders from existing semantic content using one loading hook and border-shape, so loading states reserve space and reduce layout shifts.
web-feature-ids:
  - border-shape
  - color-mix
  - prefers-reduced-motion
  - inert
  - cap
  - lh
  - line-clamp
  - user-select
---

# Skeleton loading pattern

A skeleton is a simplified placeholder shown while content loads. It reduces perceived wait time and layout shift.

Style the real semantic elements in place instead of inserting placeholder `<div>`s. One hook on the container (`aria-busy="true"`, scoped by a class such as `.skeleton`) applies a different treatment per element type: text becomes rounded bars, media and avatars become solid blocks, and buttons and inputs become a single pill. The markup does not change to suit the skeleton, and items can be empty or contain real text.

`border-shape` draws the text bars. Each bar is one closed subpath of a single `shape()`, so bars can have rounded ends and variable lengths, which `text-decoration` and gradient tricks cannot do.

For indeterminate activity when layout is unknown, see {{ GUIDE_REF("spinner") }}. For determinate loading, see {{ GUIDE_REF("progress") }}.

## 1. Loading state

MANDATORY: Put `aria-busy="true"` on the container and scope every skeleton style to it, so removing the attribute restores the real content.

```html
<!-- Announce loading once; hide the placeholders from assistive tech -->
<p class="loading-status" role="status">Loading cards…</p>
<section class="cards skeleton" aria-busy="true" inert aria-hidden="true">
  <article>
    <div class="media"></div>
    <h2></h2>
    <p></p>
    <a href="/more"></a>
    <button type="button"></button>
  </article>
</section>
```

- `inert` blocks interaction. `aria-hidden="true"` stops screen readers reading stale or empty text. The visually hidden `role="status"` message gives one generic announcement instead.
- DO NOT depend on `<figure>` or other markup that exists only for the skeleton.
- When loading finishes, toggle `aria-busy`, `inert` and `aria-hidden` together.

## 2. Colors

Skeleton colors belong to the surface. Define `--skeleton-tone` on the container and derive it from the surface with `color-mix()`, mixing a little of the text color into the surface color, so a darker surface gets a darker skeleton. Derive a lighter `--skeleton-highlight` the same way for the shimmer. Use the container's real background and text tokens.

## 3. Text

Text, links and list items share one rule: hide the content, fill with the tone, and shape with `border-shape`.

```css
.skeleton[aria-busy="true"] :is(p, h2, li, a) {
  /* Bar height follows the element's own glyphs, and the gap fills the rest of the line,
     so bars sit on the real line pitch for any font size or leading. No per-element overrides. */
  --bar-height: 1cap;
  --bar-radius: calc(var(--bar-height) / 4); /* Half the height gives fully round ends */
  --bar-gap: calc(1lh - var(--bar-height));
  --line-one: 78%;      /* Per-bar widths are overridable custom properties */
  display: block;
  min-block-size: calc(var(--lines, 1) * 1lh); /* Reserves the height of the real text lines */
  overflow: hidden;      /* Clips surplus real text so it cannot add lines */
  user-select: none;
  color: transparent;
  text-decoration: none; /* Link underlines would otherwise show through */
  background-color: var(--skeleton-tone);
  /* One bar: a closed rounded rectangle, width --line-one */
  border-shape: shape(from var(--bar-radius) 0,
    hline to calc(var(--line-one) - var(--bar-radius)),
    arc to var(--line-one) var(--bar-radius) of var(--bar-radius) var(--bar-radius) cw,
    vline to calc(var(--bar-height) - var(--bar-radius)),
    arc to calc(var(--line-one) - var(--bar-radius)) var(--bar-height) of var(--bar-radius) var(--bar-radius) cw,
    hline to var(--bar-radius),
    arc to 0 calc(var(--bar-height) - var(--bar-radius)) of var(--bar-radius) var(--bar-radius) cw,
    vline to var(--bar-radius),
    arc to var(--bar-radius) 0 of var(--bar-radius) var(--bar-radius) cw,
    close);
}
```

Derive the bar size from the element instead of tuning it per element: `cap` follows the element's font size, so a heading gets taller bars than body text with no override, and `lh` gives the line pitch, so bars land where the real lines would and the placeholder takes the same height as the text for any leading. Do not size bars in `lh` alone, which scales with line-height rather than glyph size, or with fixed values that need a different number for each element.

Draw the bullet as a subpath, not with `::marker`: the `overflow: hidden` above clips an outside marker, and a marker cannot take the shimmer background. Remove the list's own padding and marker, and draw the dot inside the `li` box. This applies to bulleted lists; do not use the dot for a numbered list.

Optionally clamp the real text to the bar count as an enhancement, with a `--lines` custom property (default `1`). `overflow: hidden` and the `lh`-based `min-block-size` stay as the baseline, because `line-clamp` alone does not reserve height.

```css
@supports (line-clamp: 1) {
  .skeleton[aria-busy="true"] :is(p, h2, li, a) {
    line-clamp: var(--lines, 1);
  }
}
```

For more than one bar, append a `move to` and another closed rounded rectangle to the same `shape()` for each extra bar, offset vertically by `n × (--bar-height + --bar-gap)` (which is `n × 1lh`) and sized by its own `--line-two`, `--line-three` and so on. `shape()` cannot repeat a path from a count, so each bar is written out. Set `--lines` to the bar count so `min-block-size` reserves the total height.

| Element | Treatment |
|---|---|
| `h1`–`h3` | 1–2 bars, sized by the heading's own font size so hierarchy matches the real template |
| `p` | 3 bars (2 in compact cards), last one shorter like a real paragraph |
| `li` | 1 bar each, with a small circle subpath for the bullet; vary widths. Start the bar at the real list's indent so the text does not shift when content arrives |
| `a` | 1 short bar (`--line-one: 42%`) |

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
- DO NOT use `content: linear-gradient()` to remove the picture: it does not work in Safari, or on `<video>` and `<canvas>`.
- Neither technique works on an inline `<svg>`.
- Remove the `controls` attribute from a skeleton `<video>`, since the browser's controls still draw over the placeholder.

## 5. Other surfaces

Anything else that defines the layout but is not text or media (buttons, inputs, badges, chips and similar) becomes a single fixed-height shape with no visible content. Reuse the text `border-shape` with one bar, or use a plain fill with `border-radius`.

| Element | Treatment |
|---|---|
| `button` | One fully rounded pill, fixed block size (for example `2.4em`) and inline size, no padding or border, no text |
| `input` | One pill with a small radius, full width, fixed block size, no padding or border |
| Badge, chip | One small pill or rectangle with a fixed block size and no text |

## 6. Simplify

A skeleton is a simplification, not a copy. Keep what defines the silhouette (media, title, a few lines of body, the primary action) and hide the rest.

- Cap long text at 2–4 bars by defining that many subpaths in the `shape()`. `overflow: hidden` and the `lh` height keep surplus text from adding lines. Cap collections at a few items as described below.
- To cap items, use a fixed `:nth-child(n + N)` selector with `display: none`. If the count must come from a custom property, read it in a small script, because CSS cannot use a custom property inside `:nth-child()`.
- Remove whole cards or rows with `display: none`. For items inside a card, use `visibility: hidden` so the card height does not change when the real content arrives.
- Decide what to hide by asking whether removing it changes the container's height. If it does, keep or reserve it.

## 7. Shimmer

Add a shimmer so users can tell the placeholders are actively loading and not broken.

Paint the shimmer on each placeholder shape's own `background`, not on a parent overlay, so every element works alone and you can apply the skeleton to just the part of a card that is updating. Keep the tone as `background-color` and add a 110° `linear-gradient` as `background-image` that is transparent, then `--skeleton-highlight`, then transparent. Use `background-attachment: fixed` so all shapes share one coordinate space and sweep in sync, and a keyframe animation of `background-position` over about 1.8s, linear and infinite. Do not use `mix-blend-mode`: it assumes a light surface, and the themed `--skeleton-tone` and `--skeleton-highlight` already adapt to any surface.

With `background-attachment: fixed` the sweep is sized to the viewport, so a small loading area catches the highlight only briefly on each pass. Shorten the duration for small areas.

DO NOT animate the `border-shape` path or the bars' visibility: it flashes in Chrome. Animate the background.

MANDATORY: Apply the shimmer (gradient and animation) only under `@media (prefers-reduced-motion: no-preference)`. Without it, the placeholders stay visible as a flat `--skeleton-tone` fill.

## Fallbacks

### border-shape

{{ BASELINE_STATUS("border-shape") }}

If your Baseline target does not support `border-shape`, use `@supports (border-shape: shape(from 0 0, close))` to scope the bar shapes, and let other browsers show a solid `--skeleton-tone` fill with `border-radius` on the same elements, sized by `min-block-size` in `lh` units. Multi-line bars and variable lengths are the progressive enhancement. The layout reservation still prevents shift.

### line-clamp

{{ BASELINE_STATUS("line-clamp") }}

If your Baseline target does not support `line-clamp`, omit the `@supports` block. `overflow: hidden` and the `lh`-based `min-block-size` already clip surplus text and reserve the height, so layout is unchanged.
