---
name: drag-and-drop
description: Support dragging to rearrange an element's children while preserving their state and accessible order.
web-feature-ids:
  - move-before
  - pointer-events-api
  - user-select
  - reading-flow
guides:
  - drag
  - move-dom-element-without-losing-state
---

# Rearrange Items with Drag and Drop

Add reordering to an existing list, grid, or board. Reorder the real children in the DOM (not via CSS `order` or `flex-direction: *-reverse`) so visual, keyboard, and reading order stay aligned. For free-form 2D repositioning of a floating element such as a dialog or toolbar, see {{ GUIDE_REF("drag") }}.

When items contain interactive controls or selectable text, provide a dedicated drag handle rather than making the entire item draggable. Start pointer drags only for the primary button (`event.button === 0`), record the initial pointer offset (`event.clientX - rect.left`, `event.clientY - rect.top`), and apply `cursor: grab`/`grabbing`, `touch-action: none`, and `user-select: none` to the handle so item text remains selectable and page scrolling works outside the handle.

## Keep movement active while reordering

Keep the drag active after the pointer leaves the handle with `handle.setPointerCapture(event.pointerId)` on `pointerdown`, and clean up on `lostpointercapture`. Because pointer capture redirects `pointermove` `event.target` to the capturing handle, find the destination item or container beneath the pointer with `document.elementFromPoint(event.clientX, event.clientY)`.

When the destination changes, move the existing item node atomically with `container.moveBefore(item, referenceNode)` rather than recreating it so internal state (such as focused controls, input values, scroll position, media, or custom element instances) and active pointer capture are preserved. If the design calls for a faded copy that follows the pointer, clone the item with `pointer-events: none`, `aria-hidden="true"`, and `inert` so it does not block hit-testing or expose duplicate content to assistive technology; otherwise, move the original item without creating a clone.

## Support keyboard reordering

Provide a keyboard-accessible alternative to pointer reordering. Choose an interaction that fits how frequently users reorder items and how easily they need to discover it:

- **Visible movement controls or an actions menu**: Best default for discoverability and screen-reader compatibility, because activating standard buttons works in screen-reader browse modes without intercepting arrow keys. Use an actions menu when persistent inline buttons add too much visual clutter.
- **Direct arrow keys (or modifier + arrow keys, such as `Alt` + arrow keys) on a focusable handle or item**: Suits frequent reordering with minimal UI chrome. Give the handle an accessible name that identifies both the item and the reorder action, and note that screen-reader browse modes may intercept bare arrow keys on a `<button>` handle unless paired with explicit movement controls or modifier keys.
- **Grab–move–drop mode (`Space` or `Enter` to pick up, arrow keys to move, `Space` or `Enter` to drop, `Escape` to cancel)**: Useful when reordering is infrequent and persistent controls are undesirable. Expose or announce the grabbed state and available keys on pickup, restore the item to its original DOM position on `Escape`, and verify how screen-reader browse modes interact with the arrow keys.

For any approach, announce the item and its new position in a polite live region.

### Align reading order with visual layout

Keep the DOM and keyboard focus order understandable in relation to the visual layout. If reordering is provided through separate controls, ensure the item's context is available before or alongside those controls. If the drag handle is focusable, give it an accessible name that identifies the item and its reordering function. Position controls to suit the layout and writing direction without making the resulting reading or focus order confusing.

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

When reordering is supplementary, keep the collection readable and usable in its default DOM order without JavaScript. If the order represents user-controlled data or directly affects behavior—for example, task priority, playlist order, or workflow sequence—treat reordering as essential and provide the required pointer and keyboard interactions rather than presenting the static order as equivalent behavior.

## Browser support and fallback strategies

### `moveBefore()`

{{ BASELINE_STATUS("move-before") }}

If your Baseline target does not support `moveBefore()`, feature-detect with `'moveBefore' in Element.prototype` and fall back to `insertBefore()` with the same destination and existing item node. Because `insertBefore()` removes and reinserts the node, it drops active pointer capture (so register `pointermove`, `pointerup`, and `pointercancel` on `document` during the drag rather than relying on `setPointerCapture()`) and blurs focused descendants (so explicitly call `.focus()` on the active handle or movement button after moving, and slightly delay or debounce the live-region update if focus re-announcement collides with the position announcement).

### `reading-flow`

{{ BASELINE_STATUS("reading-flow") }}

In browsers that do not support `reading-flow`, sequential focus navigation follows DOM source order. Structure each item's DOM order so interactive controls appear in a logical reading and tab sequence without relying on CSS visual reordering.

### `user-select`

{{ BASELINE_STATUS("user-select") }}

Include `-webkit-user-select: none` before `user-select: none` on the drag handle so text selection stays suppressed during dragging in Safari.