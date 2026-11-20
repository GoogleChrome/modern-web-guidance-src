---
name: element-shape
description: Use CSS to create shapes for elements, including circles, ellipses, polygons, and complex shapes, as well as controlling the shape of elements for clipping, masking, and hit-testing.
web-feature-ids:
  - border-shape
  - corner-shape
  - border-radius
  # - shapes-polygon-round (not yet in web-features; re-enable once published)
  - clip-path
  - shape-function
guides:
  - complex-shapes
  - shaped-cutouts
---

# Shape elements with CSS

Shape the element itself with CSS instead of nesting extra elements, using images, or drawing SVG backgrounds. Pick the simplest tool that produces the outline, because only some tools also reshape the border, shadow, focus ring, and hit-testing.

## Choose the tool (simplest to most complex)

- Circles, ellipses, pills, and blobs: `border-radius`.
- Different corner geometry (squircle, bevel, scoop, notch): `corner-shape` on top of `border-radius`.
- Custom outline that must keep its border, shadow, and hit area: `border-shape`.
- Custom outline without a border, where a clipped fill is enough: `clip-path` with `polygon()`, rounded `polygon()`, or `shape()`.
- Soft, feathered, or free-form textured edges: masking with `mask-image`, which does not reshape borders, `box-shadow`, or pointer hit-testing (see {{ GUIDE_REF("complex-shapes") }}).
- Masked notches or knockout cutouts using SVG or CSS gradient masks: see {{ GUIDE_REF("shaped-cutouts") }}.

## Circles, ellipses, pills, and blobs

- Circle: `border-radius: 50%` with `aspect-ratio: 1`, so the computed width equals the height.
- Pill: `border-radius: calc(infinity * 1px)`, never a large fixed pixel value.
- Ellipse or organic blob: `border-radius` with slash syntax (`horizontal radii / vertical radii`) so each corner gets separate horizontal and vertical radii.

## Change corner geometry

Keep a non-zero `border-radius` and set `corner-shape` to `squircle`, `bevel`, `scoop`, `notch`, or `superellipse(<number>)`. Borders, shadows, and outlines follow the corners. Keep the `border-radius` meaningful on its own, because it is the shape unsupported browsers render. Asymmetric corner radii (via `border-radius` shorthand or corner properties such as `border-start-start-radius`) combined with `bevel` give slanted tags.

## Shape the box with border-shape

Use `border-shape` with `polygon()` or `shape()` for outlines such as speech bubbles with tails, chevrons, ribbons, and diamonds. It reshapes the background, border, `box-shadow`, outline, and hit-testing together, so keep a visible `border` or `box-shadow` on the element rather than relying on `clip-path`, and set `border-radius: 0`.

## Clip with rounded polygons and shape()

- An element clipped with `clip-path` must not carry its own `box-shadow` because the clip cuts it off; put `filter: drop-shadow()` on a wrapping ancestor instead (`border-shape` reshapes `box-shadow` directly, and `filter: drop-shadow()` works on it too).
- Round polygon vertices with `polygon(round <length>, ...)` in `clip-path`.
- For a responsive curved cutout, use `clip-path: shape()` with percentage coordinates (`from`, `line`, `curve`, `smooth`, `arc`, `vline`, `hline`, `close`), and set `border-radius: 0` when it applies.
- Express the outline's dimensions (tail height, notch size, wave depth) as custom properties, so the fallback outline and the primary one stay in sync.

## Keep shaped interactive elements usable

- Use a native `<button>` (or link), not a `<div>`, so it stays focusable and keyboard operable.
- `clip-path` and `border-shape` make clipped-away corners ignore pointer events, so a click on the empty corner reaches whatever is behind and does not trigger the click handler. Do not enlarge the hit area with extra elements.
- Give every shaped interactive element a visible `:focus-visible` indicator. A plain `outline` with an offset works for `border-shape`; with `clip-path` the outline is clipped, so draw the indicator inside the shape or on the wrapper.
- Under `@media (forced-colors: active)`, set a visible border color (such as `ButtonText`) on shaped elements that rely on a background fill, since fills are removed.
- Disable hover transforms under `@media (prefers-reduced-motion: reduce)`.

## Fallbacks

{{ BASELINE_STATUS("corner-shape") }}

Put every `corner-shape` declaration inside `@supports (corner-shape: squircle)`. Unsupported browsers keep the plain rounded corners, which is an acceptable graceful degradation.

{{ BASELINE_STATUS("border-shape") }}

If your Baseline target does not support `border-shape`, declare the `border-shape` outline inside `@supports (border-shape: circle(50%))` and provide a `clip-path` with the same outline inside `@supports not (border-shape: circle(50%))`. In the fallback, make the border color transparent, remove `box-shadow` from the element, and wrap the element so `filter: drop-shadow()` on the wrapper restores the shadow. The fallback outline matches, but the border, outline, and hit-testing follow the clip instead of the shape.

```css
.badge { border: 2px solid var(--accent); box-shadow: var(--shadow); }

@supports (border-shape: circle(50%)) {
  .badge { border-shape: polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 12% 50%); }
}

@supports not (border-shape: circle(50%)) {
  .badge-wrap { filter: drop-shadow(0 10px 18px var(--shadow-color)); }
  .badge {
    border-color: transparent;
    box-shadow: none;
    clip-path: polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 12% 50%);
  }
}
```

{{ BASELINE_STATUS("shape-function") }}

If your Baseline target does not support `shape()`, gate the `shape()` cutout with `@supports (clip-path: shape(from 0% 0%, line to 100% 100%))` and use a `polygon()` with the same overall outline (straight edges instead of curves) outside it.

If your Baseline target does not support rounded polygons, declare the plain `polygon()` first and the `polygon(round <length>, ...)` version inside `@supports (clip-path: polygon(round 10px, 0 0, 100% 0, 50% 100%))`. Unsupported browsers render the same outline with sharp vertices, which is an acceptable graceful degradation.

For `calc(infinity * 1px)` pill radii, keep a large pixel value in a custom property as the default and override it inside `@supports (width: calc(infinity * 1px))`.
