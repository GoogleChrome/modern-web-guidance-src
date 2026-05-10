---
name: corner-shape
description: Shape an element's corners beyond the default rounded curve, using values like squircle, bevel, notch, scoop, or a custom superellipse.
web-feature-ids:
  - corner-shape
sources:
  - https://drafts.csswg.org/css-borders-4/#corner-shaping
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/corner-shape
---

# Shape an element's corners

The `corner-shape` CSS property sets the geometry of an element's corners within the area defined by `border-radius`. It unlocks shapes other than the default quarter-ellipse: smoothly rounded squircles, straight chamfered bevels, sharp inward notches, concave scoops, and any custom curve via `superellipse()`.

`corner-shape` is a paint-time property: it changes the painted shape of the border and the corresponding clipping path, but it requires no JavaScript and adds no extra DOM. Border, outline, `box-shadow`, and the `overflow` clip all follow the same shaped edge automatically, so child content with `overflow: hidden` is correctly clipped to the new shape.

## Implementation

1. **MANDATORY: Set `border-radius` on the element.** `corner-shape` defines the curve *within* the corner area that `border-radius` reserves. If `border-radius` is `0` (or unset) for a given corner, `corner-shape` has no visible effect on that corner.
2. **MANDATORY: Apply `corner-shape: <value>`.** Use a keyword (`round`, `squircle`, `bevel`, `notch`, `scoop`, `square`) or `superellipse(<number>)` for fine control.
3. **OPTIONAL: Use per-corner longhands for asymmetric designs.** The `corner-shape` shorthand also accepts 1-4 values that follow the same clockwise-from-top-left corner cascade as `border-radius`. For layouts that flip in right-to-left writing modes, prefer the logical longhands (`corner-start-start-shape`, `corner-start-end-shape`, `corner-end-start-shape`, `corner-end-end-shape`) so the shape mirrors with `direction` automatically.
4. **OPTIONAL: Animate between any two values.** Every keyword maps to a point on the same continuous superellipse family, so transitions between, say, `squircle` and `notch` interpolate smoothly without `discrete` keyframes.

```css
.card {
  /* MANDATORY: corner-shape only paints inside the area border-radius reserves.
     Without a non-zero border-radius the property is a no-op. */
  border-radius: 16px;

  /* MANDATORY: pick the shape. Keyword values map to fixed points on the
     superellipse curve family:
       round    = superellipse(1)   default quarter-ellipse
       squircle = superellipse(2)   convex, between round and square
       square   = superellipse(infinity)  sharp 90deg corner
       bevel    = superellipse(0)   straight diagonal chamfer
       scoop    = superellipse(-1)  concave quarter-ellipse
       notch    = superellipse(-infinity)  sharp inward 90deg
     Pick the keyword that matches the design intent; reach for
     superellipse(K) only when fine tuning is needed. */
  corner-shape: squircle;
}

.tag {
  /* OPTIONAL: per-corner asymmetry. Each longhand only affects a corner that
     also has a matching non-zero radius; e.g. corner-start-start-shape paired
     with border-start-start-radius: 0 silently does nothing. Logical longhands
     mirror automatically when direction or writing-mode flip. */
  border-start-start-radius: 0;
  border-start-end-radius: 12px;
  border-end-end-radius: 12px;
  border-end-start-radius: 0;
  corner-start-end-shape: notch;
  corner-end-end-shape: notch;
  /* Inward shapes (notch, scoop, negative superellipse) eat into the box.
     Layout still treats the full rectangle as the content area, so text in
     the notched corners can collide with the cut. Add padding on the affected
     side equal to roughly the radius value to keep content clear. */
  padding-inline-end: 16px;
}

.badge {
  /* OPTIONAL: 1-4 values follow the same corner cascade as border-radius
     (clockwise from top-left): 1 = all corners, 2 = TL+BR / TR+BL,
     3 = TL / TR+BL / BR, 4 = TL TR BR BL. */
  border-radius: 8px;
  corner-shape: squircle bevel; /* TL+BR squircle, TR+BL bevel */
}

.fine-tuned {
  border-radius: 24px;
  /* OPTIONAL: superellipse(K) for custom curvature.
     K = 2 is squircle; K = 3 is more square-like; K between 1 and 2 sits
     between round and squircle. Negative K produces concave shapes
     (K = -1 = scoop). Treat the exact number as design-tuned, not magic. */
  corner-shape: superellipse(3);
}

.morph {
  border-radius: 16px;
  corner-shape: squircle;
  /* OPTIONAL: corner-shape interpolates continuously, so a transition between
     any two values renders without `animation-timing-function: step-end`.
     Like every paint property, this triggers a repaint per frame; keep it
     scoped to user-driven interactions (hover, focus) rather than always-on
     animation on many elements at once. */
  transition: corner-shape 200ms ease;
}
.morph:hover { corner-shape: notch; }
```

DO NOT reach for `clip-path` or an SVG mask to fake corner-shape. Both require an inline path expressed in absolute or percentage units that has to be recomputed when the box resizes, and they replace the box's normal border, outline, and `box-shadow` rendering. `corner-shape` integrates with all of those automatically and inherits the responsiveness of `border-radius`.

## Fallback strategies

{{ BASELINE_STATUS("corner-shape") }}

`corner-shape` is a progressive enhancement. In browsers without support the existing `border-radius` value is honored unchanged, so the element renders as a plain rounded box. Verify the rounded baseline still looks acceptable for your design.

DO NOT recommend any polyfill. `corner-shape` is implemented inside the browser's paint pipeline; there is no JavaScript shim that can reproduce its effect on the real border, outline, `box-shadow`, and overflow clip together. Any "polyfill" would have to replace the element with an SVG or canvas substitute and lose the inheritance and per-property integration that the native property preserves.

If a specific shape is brand-critical and must look identical across every browser today, render that one element as an inline SVG instead of using `corner-shape`. Use `corner-shape` only where the rounded baseline is acceptable as the fallback. Do not maintain two parallel CSS implementations of the same shape (one with `corner-shape`, one approximated with `box-shadow` or `clip-path`): they will drift out of sync as the design evolves and the approximation will never match the native curve.

`@supports` is still useful here for adjusting *surrounding* layout, not for re-creating the shape. For example, if a deep `notch` cuts into the area where text would otherwise sit, you can widen padding only when `corner-shape` is supported so the rounded fallback doesn't waste space. Test the exact value the rule applies (e.g., `@supports (corner-shape: notch)`) so partial keyword support in a future browser can't bypass the gate.

