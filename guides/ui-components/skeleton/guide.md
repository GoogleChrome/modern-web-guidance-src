---
name: skeleton
description: Build skeleton placeholders from existing semantic content using one loading hook and border-shape, so loading states reserve space and reduce layout shifts.
web-feature-ids:
  - border-shape
  - color-mix
  - registered-custom-properties
  - prefers-reduced-motion
  - inert
  - lh
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

Skeleton colors belong to the surface. Register `--skeleton-tone` with `@property` (`<color>`, inherits) and derive it from the surface with `color-mix()`, mixing a little of the text color into the surface color, so a darker surface gets a darker skeleton. Derive a lighter `--skeleton-highlight` the same way for the shimmer. Use the container's real background and text tokens.

## 3. Elements

Treat each element type differently. Text, links and list items share one rule (hide content, fill with the tone, shape with `border-shape`). Buttons and inputs reuse the same shape with fixed sizing. Media and avatars use a plain fill.

```css
.skeleton[aria-busy="true"] :is(p, h2, li, a) {
  /* lh units keep bars proportional to each element's own font size and line-height */
  --pill-height: .68lh;
  --pill-radius: .16lh; /* Example value; half the height gives fully round ends */
  --pill-gap: .3lh;
  --line-one: 78%;      /* Per-bar widths are overridable custom properties */
  display: block;
  min-block-size: var(--pill-height);
  overflow: hidden;      /* Clips surplus real text so it cannot add lines */
  user-select: none;
  color: transparent;
  text-decoration: none; /* Link underlines would otherwise show through */
  background: var(--skeleton-tone);
  /* One bar: a closed rounded rectangle, width --line-one */
  border-shape: shape(from var(--pill-radius) 0,
    hline to calc(var(--line-one) - var(--pill-radius)),
    arc to var(--line-one) var(--pill-radius) of var(--pill-radius) var(--pill-radius) cw,
    vline to calc(var(--pill-height) - var(--pill-radius)),
    arc to calc(var(--line-one) - var(--pill-radius)) var(--pill-height) of var(--pill-radius) var(--pill-radius) cw,
    hline to var(--pill-radius),
    arc to 0 calc(var(--pill-height) - var(--pill-radius)) of var(--pill-radius) var(--pill-radius) cw,
    vline to var(--pill-radius),
    arc to var(--pill-radius) 0 of var(--pill-radius) var(--pill-radius) cw,
    close);
}
```

For more than one bar, append a `move to` and another closed rounded rectangle to the same `shape()` for each extra bar, offset vertically by `n × (--pill-height + --pill-gap)` and sized by its own `--line-two`, `--line-three` and so on. `shape()` cannot repeat a path from a count, so each bar is written out. Set `min-block-size` to the total height of all bars.

| Element | Treatment |
|---|---|
| `h1`–`h3` | 1–2 bars with a larger `--pill-height`, so hierarchy matches the real template |
| `p` | 3 bars (2 in compact cards), last one shorter like a real paragraph |
| `li` | 1 bar each, with a small circle subpath for the bullet; vary widths |
| `a` | 1 short bar (`--line-one: 42%`) |
| `button` | One fully rounded pill, fixed block size (for example `2.4em`) and inline size, no padding or border, no text |
| `input` | One pill with a small radius, full width, fixed block size, no padding or border |
| Media | `background-color: var(--skeleton-tone)` plus `aspect-ratio` to reserve space |
| Avatar | Same as media with `border-radius: 50%` |

DO NOT replace media with `content: linear-gradient()`: it is inconsistent across browsers, and the media can disappear or reflow the text.

## 4. Simplify

A skeleton is a simplification, not a copy. Keep what defines the silhouette (media, title, a few lines of body, the primary action) and hide the rest.

- Cap long text at 2–4 bars and collections at a few items, however much content exists.
- To cap items, use a fixed `:nth-child(n + N)` selector with `display: none`. If the count must come from a custom property, read it in a small script, because CSS cannot use a custom property inside `:nth-child()`.
- Remove whole cards or rows with `display: none`. For items inside a card, use `visibility: hidden` so the card height does not change when the real content arrives.
- Decide what to hide by asking whether removing it changes the container's height. If it does, keep or reserve it.

## 5. Shimmer

Add a shimmer so users can tell the placeholders are actively loading and not broken.

On each card, add an `::after` overlay (`position: absolute; inset: 0; pointer-events: none`) filled with a 110° `linear-gradient` that is transparent, then `--skeleton-highlight`, then transparent. Use `background-attachment: fixed` so the sweep is one continuous pass across all cards, `mix-blend-mode: screen`, and a keyframe animation of `background-position` over about 1.8s, linear and infinite. The card needs `position: relative`.

DO NOT animate the `border-shape` path or the bars' visibility: it flashes in Chrome. Animate the overlay.

MANDATORY: Under `@media (prefers-reduced-motion: reduce)`, set `animation: none` on the overlay. The placeholders stay visible.

## Fallbacks

### border-shape

{{ BASELINE_STATUS("border-shape") }}

If your Baseline target does not support `border-shape`, use `@supports (border-shape: shape(from 0 0, close))` to scope the bar shapes, and let other browsers show a solid `--skeleton-tone` fill with `border-radius` on the same elements, sized by `min-block-size` in `lh` units. Multi-line bars and variable lengths are the progressive enhancement. The layout reservation still prevents shift.

### color-mix()

{{ BASELINE_STATUS("color-mix") }}

### Registered custom properties

{{ BASELINE_STATUS("registered-custom-properties") }}

Without `@property`, the tone still resolves as a normal custom property. Only animated interpolation of the tone is lost.
