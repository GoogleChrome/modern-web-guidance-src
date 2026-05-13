---
name: resilient-context-menus-and-nested-dropdowns
description: Build accessible, responsive menus, tooltips, dropdowns, or contextual overlays that must be tethered to specific UI elements, guaranteeing that the overlay automatically repositions itself (e.g., flipping axes) when it encounters viewport edges, ensuring it never gets cut off.
web-feature-ids:
  - anchor-positioning
  - popover
sources:
  - https://web.dev/learn/css/anchor-positioning
  - https://css-tricks.com/css-anchor-positioning-guide/
  - https://webkit.org/blog/17240/a-gentle-introduction-to-anchor-positioning/
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning
---

A revealed action panel or popover button group is a useful pattern for users to access additional functionality while taking up minimal space. This overlay pattern comes with layout complexity, as the panel must remain tethered to a trigger element while adapting to viewport constraints. Traditionally, this required complex JavaScript libraries (like Popper.js or Floating UI) to calculate positions and handle collisions.

CSS Anchor Positioning provides a declarative, performance-optimized way to handle these relationships entirely in CSS, allowing browsers to manage the positioning and overflow logic natively.

### 1. Define the Button and Panel Relationship

The first step is to create a trigger button that opens the overlay container using the Popover API.

**MANDATORY Accessibility Distinction:** This pattern explicitly models a **button group revealed inside a popover** rather than a true ARIA menu. Do not apply `role="menu"` or `role="menuitem"` unless you fully implement the corresponding keyboard navigation contract (such as handling spatial arrow-key navigation between items).

```html
<button popovertarget="action-panel" aria-haspopup="true">
  Open Actions
</button>
<!-- Use the Popover API (`popover="auto"`) for the overlay to ensure it is placed in the top layer and handled accessibly by the browser. -->
<div id="action-panel" popover="auto" class="panel">
  <button class="action-item" type="button">Edit</button>
</div>
```

This creates an *implicit* anchor association between the button and the panel, so that the panel can be positioned relative to the button.

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
  */
  position-try-fallbacks: flip-block, flip-inline;
}
```

## Fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

Popover must conditionally be polyfilled with the `@oddbird/popover-polyfill` polyfill.

```html
<script type="module">
  if(!HTMLElement.prototype.hasOwnProperty("popover")){
    await import("https://unpkg.com/@oddbird/popover-polyfill@latest");
  }
</script>
```

{{ BASELINE_STATUS("anchor-positioning") }}

To support browsers without anchor positioning, you must set a reasonable position. By default popovers are centered in the middle of the screen, which may work for your use case.

For some use cases, you may be able to use the `@oddbird/css-anchor-positioning` polyfill, which adds support for some anchor positioning use cases. It does not support implicit anchors, so you MUST add anchor names to the trigger. Additionally, `position-area` is not supported on popovers by the polyfill, so you MUST use `anchor()` on the desired insets. 

```html
<!-- MANDATORY: Conditionally install the anchor positioning polyfill -->
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

```css
.panel {
  /* Mandatory: use explicit anchor name */
  position-anchor: --kebab-anchor;
  /* Mandatory: use insets rather that position-area for positioning */
  bottom: auto;
  right: auto;
  top: anchor(bottom);
  left: anchor(left);
  margin: 0;
}
```