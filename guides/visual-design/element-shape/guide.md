---
name: element-shape
description: Use CSS to create shapes for elements, including circles, ellipses, polygons, and complex shapes, as well as controlling the shape of elements for clipping, masking, and hit-testing.
web-feature-ids:
  - border-shape
  - corner-shape
  - border-radius
  - shapes-polygon-round
  - clip-path
  - shape-function
guides:
  - complex-shapes
  - shaped-cutouts
---

# Shape elements with CSS

Shape the element itself with CSS instead of nesting extra elements, using images, or drawing SVG backgrounds. Pick the simplest tool that produces the outline, because only some tools also reshape the border and shadow.

## Choose the tool (simplest to most complex)

- Circles, ellipses, pills, and blobs: `border-radius`.
- Different corner geometry (squircle, bevel, scoop, notch): `corner-shape` on top of `border-radius`.
- Custom outlines `corner-shape` can't make (speech bubbles with tails, notched ribbons): `border-shape` with `polygon()` (or `polygon(round ...)`) or `shape()`, which shapes the border and `box-shadow` with the element.
- Clipping an image, media, or inner children to a shape without affecting the element's outer box, border, or shadow (or animated reveal wipes): `clip-path`.
- Soft, feathered, or free-form textured edges: masking with `mask-image`, which does not reshape borders, `box-shadow`, or pointer hit-testing (see {{ GUIDE_REF("complex-shapes") }}).
- Masked notches or knockout cutouts using SVG or CSS gradient masks: see {{ GUIDE_REF("shaped-cutouts") }}.

Text inside `clip-path`, `mask-image`, and `border-shape` is still laid out in a rectangular box and does not wrap to the shape—give the shape enough padding to clear cutouts/tapered corners, or apply `clip-path`/`mask-image` to a pseudo-element or adjacent decorative element (see {{ GUIDE_REF("shaped-cutouts") }}) while keeping readable text in an unclipped container.

## Circles, ellipses, pills, and blobs

- Circle: `border-radius: 50%` with `aspect-ratio: 1`, so the computed width equals the height.
- Pill: `border-radius: calc(infinity * 1px)`, never a large fixed pixel value.
- Ellipse or organic blob: `border-radius` with slash syntax (`horizontal radii / vertical radii`) so each corner gets separate horizontal and vertical radii.

## Corner-based shapes

Set a non-zero `border-radius` and add `corner-shape` (`squircle`, `bevel`, `scoop`, `notch`, or `superellipse(<number>)`) to reshape the corners. Borders, shadows, and outlines follow the corners.

- Slanted tag or slanted rectangle: asymmetric radii on opposite corners (via `border-radius` shorthand or corner properties such as `border-start-start-radius` and `border-end-end-radius`) with `corner-shape: bevel`.
- Diamond: `border-radius: 50%` with `corner-shape: bevel`.
- Parallelogram or arrow/chevron point: `corner-shape: bevel` with a horizontal radius of the slant or point and a vertical radius of `100%` (slant) or `50%` (arrow), using logical corner properties so RTL mirrors. This keeps per-side border widths, colors, and styles.
- Octagon or chamfered box: a fixed `border-radius` with `corner-shape: bevel`.
- Ticket or coupon edges: `corner-shape: scoop` or `notch` with a fixed `border-radius`.
- Soft, iOS-style rounded corners: `corner-shape: squircle`.

## Shape the box with border-shape

Use `border-shape` with `polygon()` or `shape()` only for outlines `corner-shape` can't make, such as speech bubbles with tails and notched ribbons. It shapes the border and `box-shadow` (an outer shadow is cast from the outer path) and clips overflow content to the inner shape, so keep a visible `border` or `box-shadow` on the element rather than relying on `clip-path`. For diamonds, `corner-shape` is simpler.

- Straight edges only (notched ribbons): `polygon()`. Any curves (speech bubbles with rounded corners, waves): `shape()`.
- Use percentages for proportional geometry and fixed lengths (such as tail height or notch depth) for parts that shouldn't scale with the element.
- Put a value in a custom property only when it is reused or tuned per instance.
- Reserve space for protruding parts (such as a tail) with padding so text doesn't collide with them.
- `clip-path` clips the focus outline and ignores pointer events outside the shape.
- Don't translate a shaped element on hover, because the moving hit area causes missed clicks.

## Clip with rounded polygons and shape()

- An element clipped with `clip-path` must not carry its own `box-shadow` because the clip cuts it off; put `filter: drop-shadow()` on a wrapping ancestor instead (`border-shape` reshapes `box-shadow` directly, and `filter: drop-shadow()` works on it too).
- Round polygon vertices with `polygon(round <length>, ...)` in `clip-path`.
- For a responsive curved cutout, use `clip-path: shape()` with percentage coordinates and reset `border-radius: 0` alongside the `shape()` declaration so fallback rounded corners don't interfere with the cutout.
- Express the outline's dimensions (tail height, notch size, wave depth) as custom properties so the shape is easy to customize.

## Fallbacks

Store the full outline in one custom property (for example `--badge-shape: polygon(...)`) and reuse it in both `border-shape` and the `clip-path` fallback so the two can't drift apart.

{{ BASELINE_STATUS("corner-shape") }}

Declare `corner-shape` directly after `border-radius` without an `@supports` wrapper, and keep the `border-radius` meaningful on its own because it is the shape unsupported browsers render. For `squircle` and `superellipse()`, plain rounded corners are an acceptable graceful degradation. If they are not acceptable (for example a diamond that would render as a circle), use the `corner` shorthand or gate the shape-specific `border-radius` inside `@supports (corner-shape: bevel)` so unsupported browsers keep a safe default.

When a design depends on distinct non-rounded silhouettes (`bevel`, `notch`, or `scoop`), recreate them inside `@supports not (corner-shape: squircle)`: reset `border-radius: 0`, set `border-color: transparent`, and clear `box-shadow: none` so the cutout doesn't slice them off without adding extra wrapper elements (if a shadow is essential and the shape only styles a background, clip or mask a `::before` pseudo-element and apply `filter: drop-shadow()` on the element itself). Parameterize horizontal and vertical corner radii with custom properties clamped via `min(<radius>, 50%)` so the primary `border-radius` and fallback match:

- `bevel` and `notch`: clip angled or stepped corner cutouts with `clip-path: polygon(...)` (and add a `:dir(rtl)` override when replicating logical corner properties such as slanted tags).
- `scoop`: cut concave corners with four corner `radial-gradient(ellipse var(--corner-x) var(--corner-y) at ..., transparent calc(100% - 1px), black 100%)` layers combined via `mask-composite: intersect` (`-webkit-mask-composite: source-in`).

{{ BASELINE_STATUS("border-shape") }}

If your Baseline target does not support `border-shape`, declare the `border-shape` outline inside `@supports (border-shape: circle(50%))` and provide a `clip-path` with the same outline inside `@supports not (border-shape: circle(50%))`. In the fallback, make the border color transparent, reset `border-radius: 0`, and clear `box-shadow: none` without adding extra wrapper elements (if a shadow is essential and the shape only styles a background, clip a `::before` pseudo-element and apply `filter: drop-shadow()` on the element itself). The fallback outline matches, but `clip-path` also clips the focus outline and ignores pointer events outside the shape.

```css
.badge { border: 2px solid var(--accent); box-shadow: var(--shadow); }

@supports (border-shape: circle(50%)) {
  .badge { border-shape: polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 12% 50%); }
}

@supports not (border-shape: circle(50%)) {
  .badge {
    border-color: transparent;
    box-shadow: none;
    clip-path: polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 12% 50%);
  }
}
```

{{ BASELINE_STATUS("shape-function") }}

If your Baseline target does not support `shape()`, gate the `shape()` cutout with `@supports (clip-path: shape(from 0% 0%, line to 100% 100%))` and use a `polygon()` with the same overall outline (straight edges instead of curves) outside it.

{{ BASELINE_STATUS("shapes-polygon-round") }}

If your Baseline target does not support rounded polygons, declare the plain `polygon()` first and the `polygon(round <length>, ...)` version inside `@supports (clip-path: polygon(round 10px, 0 0, 100% 0, 50% 100%))`. Unsupported browsers render sharp vertices as graceful degradation; if rounded vertices are required, use `clip-path: shape()` as a higher-fidelity fallback where supported.
