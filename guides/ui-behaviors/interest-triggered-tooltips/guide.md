---
name: interest-triggered-tooltips
description: Show a tooltip or supplemental information when a user hovers over, focuses on, or long-presses an interactive element, without requiring a click.
web-feature-ids:
  - interest-invokers
  - popover
  - popover-hint
  - anchor-positioning
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

### Accessibility built in to `interestfor`

{{ FEATURE("interest-invokers", "accessibility") }}

### Accessibility Constraints (WCAG 1.4.13)

Even with `interestfor` handling the semantics above, your implementation MUST still satisfy WCAG 1.4.13 (Content on Hover or Focus):
- **Dismissible:** Users must be able to dismiss the tooltip without moving pointer hover or keyboard focus (e.g., by pressing the `Escape` key). The native `popover` attribute manages this binding automatically.
- **Hoverable:** The pointer must be able to move over the tooltip content itself without the tooltip disappearing. This allows users with magnification tools to read the tooltip text safely.
- **Persistent:** The tooltip must remain visible until the hover or focus trigger is removed, the user explicitly dismisses it, or its content is no longer valid.

### Positioning the tooltip

The tooltip is positioned using **CSS Anchor Positioning**. When the tooltip is opened using `interestfor` (or a popover invoker like `popovertarget`), the trigger element automatically becomes an **implicit anchor** for the popover.

In modern browsers supporting native anchor positioning, you do **not** need to define an `anchor-name` on the trigger or a `position-anchor` on the tooltip. You can position the tooltip directly relative to its implicit anchor using `position-area` and handle collision flipping with `position-try-fallbacks`:

```css
[popover] {
  /* Implicit anchor from interestfor / popovertarget: no anchor-name or position-anchor needed */
  position-area: top;
  position-try-fallbacks: flip-block;
  margin: unset;
}
```

### Fallback strategies

{{ FEATURE_FALLBACKS("interest-invokers") }}

{{ FEATURE_FALLBACKS("popover") }}

{{ BASELINE_STATUS("popover-hint") }}

The `popover-polyfill` does not polyfill the hint behavior in browsers that support `popover` but not `popover="hint"`. For those browsers, a tooltip opened via focus may stay open when a second tooltip opened via hover.

{{ BASELINE_STATUS("anchor-positioning") }}

When using the `@oddbird/css-anchor-positioning` polyfill for legacy browser support, be aware that the polyfill does not support implicit anchors or `position-area` on popovers.

To support browsers without anchor positioning, you must conditionally install the polyfill, explicitly set an `anchor-name` on the trigger, set `position-anchor` on the popover, and position using `anchor()` inset functions instead of `position-area`: 

```html
<!-- MANDATORY: Conditionally install the anchor positioning polyfill -->
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

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