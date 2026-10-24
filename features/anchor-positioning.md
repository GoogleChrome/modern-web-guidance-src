# Anchor Positioning

## Fallbacks

Decide first whether a fixed fallback position is acceptable. Popovers are centered in the viewport by default, and a `@supports not` block can pin the element somewhere sensible (for example the bottom of the viewport) without any script. Reach for the polyfill only when the element must stay tethered to its anchor.

The `@oddbird/css-anchor-positioning` polyfill emulates anchor positioning for most layouts. **MANDATORY:** Load it conditionally, only when native support is missing. Prefer bundling over the CDN.

```html
<script type="module">
  if (!CSS.supports("anchor-name: --a")) {
    // CDN link only used for example, prefer bundling.
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

The polyfill does not support implicit anchors (from `popovertarget`, `commandfor`, or `interestfor`) or `position-area` on popovers. When using it:

- Set an explicit `anchor-name` on the trigger and `position-anchor` on the positioned element. Each trigger and target pair needs a unique name.
- Position with `anchor()` inset functions instead of `position-area`.

```css
.trigger {
  anchor-name: --tip;
}
.positioned {
  position-anchor: --tip;
  /* `anchor()` insets work in the polyfill; `position-area` on a popover does not */
  top: anchor(bottom);
  left: anchor(left);
  margin: 0;
}
```
