---
name: interest-triggered-tooltips
description: Show a tooltip or supplemental information when a user hovers over, focuses on, or long-presses an interactive element, without requiring a click.
web-feature-ids:
  - interest-invokers
  - popover
  - popover-hint
  - anchor-positioning
sources:
  - https://open-ui.org/components/interest-invokers.explainer/
  - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
  - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
---

# Show a tooltip when hovering

Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.

## Creating the tooltip

You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.

It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.

The tooltip element must have an `id` attribute with a unique value:

```html
<!-- MANDATORY: The tooltip container `<div>` must have a `popover` attribute.
     the value of `"hint"` ensures it can be "light dismissed". -->
<div popover="hint" id="tooltip">Tooltip content</div>
```

A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.

```html
<!-- The `interestfor` attribute can be applied to a `<button>` element: -->
<button interestfor="tooltip">Tooltip trigger</button>

<!-- The `interestfor` attribute can also be applied to an `<a>` element: -->
<a interestfor="tooltip" href="">Tooltip trigger</a>
```

The trigger must have a visual indicator to indicate that there is additional information available by interacting with the trigger. 

### Positioning the tooltip

The tooltip can be positioned using anchor positioning. When the tooltip is opened using `interestfor`, the trigger becomes an implicit anchor for the tooltip, meaning you don't have to add `anchor-name` or `position-anchor` CSS properties. DO use `position-area: block-start` with `position-try: flip-block`, or `position-area: inline-end` with `position-try: flip-inline`.

```css
[popover]{
  position-area: block-start;
  position-try: flip-block;
}
```
### Fallback strategies

{{ BASELINE_STATUS("interest-invokers") }}

Interest invokers must be conditionally polyfilled with the `interestfor` polyfill, available at https://github.com/mfreed7/interestfor or on NPM. Do prefer bundling the polyfill over using the CDN.

```html
<script type="module">
  if(!HTMLButtonElement.prototype.hasOwnProperty("interestForElement")){
    await import("https://unpkg.com/interestfor@latest");
  }
</script>
```

{{ BASELINE_STATUS("popover") }}
{{ BASELINE_STATUS("popover-hint") }}

Popover and popover hint must conditionally be polyfilled with the `@oddbird/popover-polyfill` polyfill. The hint behavior will not be polyfilled in browsers that support `popover` but not `popover="hint"`. For those browsers, a tooltip opened via focus may stay open when a second tooltip opened via hover.

```html
<script type="module">
  if(!HTMLElement.prototype.hasOwnProperty("popover")){
    await import("https://unpkg.com/@oddbird/popover-polyfill@latest");
  }
</script>
```

{{ BASELINE_STATUS("anchor-positioning") }}

To support browsers without anchor positioning, provide a fallback by putting the popover in the center of the user's screen. Add a `@supports (anchor-name: auto){}` supports block around the anchor positioning rules on the tooltip so browsers with anchor positioning show the tooltip in the desired location.

```html
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

```css
[popover]{
  position: fixed;
  margin: auto;
}
@supports (position-anchor: auto) {
  [popover] {
    margin: unset;
    position-anchor: auto;
    position-area: block-start;
    position-try-fallbacks: flip-block;
    margin-bottom: 0.5rem;
  }
}
```

Alternatively, you may use the `@oddbird/css-anchor-positioning` polyfill. It does not support implicit anchors, so you must add anchor names to the trigger. Additionally, `position-area` is not supported on popovers, so you must use `anchor()` on the desired insets. 

```css
button[interestfor="tooltip-attrs"] {
  /* MANDATORY: Each trigger and popover pair must have a unique anchor name, referenced by `anchor-name` on the trigger and `position-anchor` on the popover. */
  anchor-name: --tooltip-attrs;
}
#tooltip-attrs {
  position-anchor: --tooltip-attrs;
  /* If using the anchor positioning polyfill with a popover, DO use `anchor()` functions, and not `position-area. */
  top: anchor(bottom);
  left: anchor(right);
  margin: unset;
}
```