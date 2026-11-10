---
name: viewport-aware-dropdowns
description: Position dropdowns, flyouts, or contextual action panels tethered to a trigger button so they automatically flip axes at viewport edges instead of getting clipped.
web-feature-ids:
  - anchor-positioning
  - popover
---

# Viewport-Aware Dropdowns

A revealed action panel or popover button group is a useful pattern for users to access additional functionality while taking up minimal space. This overlay pattern comes with layout complexity, as the panel must remain tethered to a trigger element while adapting to viewport constraints. Traditionally, this required complex JavaScript libraries (like Popper.js or Floating UI) to calculate positions and handle collisions.

CSS Anchor Positioning provides a declarative, performance-optimized way to handle these relationships entirely in CSS, allowing browsers to manage the positioning and overflow logic natively.

> [!NOTE]
> This guide demonstrates anchor-positioning and popover mechanics — it does not prescribe a specific accessible UI pattern. The trigger and panel below are shown as a plain **button-revealing-a-button-group**. If you need a true ARIA menu (`role="menu"` with arrow-key navigation), a combobox, a disclosure widget, or any other named pattern, layer that pattern's full semantics and keyboard contract on top of the positioning techniques shown here.

### 1. Define the Button and Panel Relationship

The first step is to create a trigger button that opens the overlay container using the Popover API.

**MANDATORY Accessibility Distinction:** This pattern explicitly models a **button group revealed inside a popover** rather than a true ARIA menu. Do not apply `role="menu"` or `role="menuitem"` unless you fully implement the corresponding keyboard navigation contract (such as handling spatial arrow-key navigation between items). For the same reason, do not add `aria-haspopup` to the trigger — its value (`menu`, `listbox`, `tree`, `grid`, or the legacy `true`) is a promise that the target exposes a matching role, which this pattern does not.

```html
<button popovertarget="action-panel">
  Open Actions
</button>
<!-- Use the Popover API (`popover="auto"`) for the overlay to ensure it is placed in the top layer and handled accessibly by the browser. -->
<div id="action-panel" popover="auto" class="panel">
  <button class="action-item" type="button">Edit</button>
</div>
```

This creates an *implicit* anchor association between the button and the panel, so that the panel can be positioned relative to the button natively without needing `anchor-name` on the button or `position-anchor` on the panel.

### 2. Positioning with `position-area`

Instead of manual `top`/`left` offsets, use `position-area` to place the target on a 3x3 grid relative to the anchor.

```css
.panel {
  /* 
     Position the panel below the anchor (block-end), 
     aligned to the start of the anchor and spanning to its end (span-inline-end).
  */
  position-area: block-end span-inline-end;
  
  /* Reset insets to allow the grid to take control */
  inset: auto;
}
```

Prefer logical keywords (`span-inline-end`, `block-start`) over physical ones (`left`, `top`) to support RTL and different writing modes automatically.

**MANDATORY**: Do not mix physical and logical keywords in `position-area`.

### 3. Implement Edge-Resilience (Fallbacks)

To prevent the panel from being cut off at the edge of the screen, define "try tactics" that the browser should attempt if the default position overflows.

```css
.panel {
  /* 
     If the panel overflows the bottom, flip it to the top (flip-block).
     If it overflows the inline edges, flip it horizontally (flip-inline).
     If it overflows both (e.g., in a corner), flip on both axes (flip-block flip-inline).
  */
  position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
}
```

If your dropdown or flyout includes a directional arrow or border that needs to change style depending on which fallback position was chosen, see {{ GUIDE_REF("position-aware-tooltips") }}. For declarative invocation of dialogs and popovers without JavaScript, see {{ GUIDE_REF("declarative-dialog-popover-control") }}.

## Fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE("anchor-positioning", "popover-fallbacks") }}
