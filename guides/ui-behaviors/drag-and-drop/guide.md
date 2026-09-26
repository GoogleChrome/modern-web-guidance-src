---
name: drag-and-drop
description: Support dragging to rearrange an element's children while preserving their state and accessible order.
web-feature-ids:
  - move-before
  - pointer-events-api
  - user-select
  - reading-flow
  - container-style-queries
  - masks
  - registered-custom-properties
guides:
  - drag
  - move-dom-element-without-losing-state
---

# Rearrange Items with Drag and Drop

Add reordering to an existing list, grid, or other collection. Reorder the real children in the DOM so visual, keyboard, and reading order stay aligned. For why CSS `order` is not a substitute for reordering interactive content, see {{ GUIDE_REF("css-layout") }}.

When appropriate, provide a dedicated drag handle rather than making the entire item draggable. For choosing a drag handle, preserving the pointer offset, and applying handle-scoped `touch-action` and `user-select`, see {{ GUIDE_REF("drag") }}.

## Keep movement active while reordering

A drag implementation that moves the dragged item in the DOM can lose pointer capture when the item is removed and reinserted. Register `pointermove`, `pointerup`, and `pointercancel` on `document` for the active drag, and remove them when it ends.

Determine the destination from the pointer's position over the remaining items. Move the actual item when its destination changes rather than recreating it. To preserve item state (such as focused controls, scroll position, media, or custom element instances), use `moveBefore()` to move elements atomically; see {{ GUIDE_REF("move-dom-element-without-losing-state") }}. If the design calls for a faded copy that follows the pointer, clone the item for that feedback; otherwise, move the original item without creating a clone.

## Support keyboard reordering

Avoid using a separate "grab-and-drag" keyboard mode (for example, Space to grab followed by arrow keys to move). Instead, make the drag handle keyboard-focusable and give it an accessible name that communicates its reordering function. When the handle has focus, support `ArrowUp` and `ArrowDown` to move the item, and announce the item's new position. A keyboard-operable handle avoids requiring permanently visible movement buttons or a separate interaction mode. The reordering action must remain available to keyboard and screen-reader users.

### Align reading order with visual layout
Keep the DOM order logical: place each item's accessible context before its keyboard-operable drag handle, and keep the handle's focus order consistent with the DOM. Choose the handle's visual position to suit the layout, including its writing direction, without changing the logical order.

For complex layouts where visual and DOM order cannot naturally align, use the **`reading-flow`** CSS property inside grid/flex containers to instruct the browser's tab order to follow visual coordinates rather than DOM source order:
```css
.task {
  display: grid;
  grid-template-columns: auto 1fr auto;
  reading-flow: grid-rows; /* Follows visual layout and tab order by row */
}
```

### Disable boundaries and safeguard focus
Prevent movement past the first and last items. For a keyboard-operable handle, ignore or prevent the corresponding arrow key at each boundary.

After moving an item, keep focus on its handle. If the implementation uses separate movement buttons instead, keep focus on the activated button or shift it to the alternative movement control on the same item when the activated control becomes disabled.

## Decide on fallback behavior

When reordering is supplementary, keep the collection readable and usable in its default DOM order without JavaScript. If the order represents user-controlled data or directly affects behaviour—for example, task priority, playlist order, or workflow sequence—treat reordering as essential and provide the required pointer and keyboard interactions rather than presenting the static order as equivalent behaviour.

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("move-before") }}

When `moveBefore()` is unavailable, use `insertBefore()` as a fallback while preserving the same destination and existing item node. This fallback keeps the item in the DOM rather than recreating it, but may not preserve all state that `moveBefore()` retains.

{{ FEATURE_FALLBACKS("pointer-events-api") }}

{{ FEATURE_FALLBACKS("user-select") }}

{{ FEATURE_FALLBACKS("reading-flow") }}
