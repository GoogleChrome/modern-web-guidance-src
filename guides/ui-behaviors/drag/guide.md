---
name: drag
description: Support dragging to move a floating element around the page.
web-feature-ids:
  - user-select
---

# Build a Draggable Element

Add dragging to an existing floating element such as a panel, palette, toolbar, inspector, or dialog. Dragging does not determine how the element is displayed, dismissed, stacked, or focused.

## Use a dedicated handle

Start dragging from a dedicated handle when the element contains selectable text, buttons, inputs, or links. This keeps its normal contents usable. Make the handle focusable for keyboard movement and give it an accessible name that mentions the arrow-key interaction.

Do not apply `role="application"` to the handle. It unnecessarily changes assistive-technology interaction.

Apply these styles to the handle, not to the entire draggable element, so text outside the handle remains selectable and touch gestures outside it keep their usual behavior:

```css
.drag-handle {
  cursor: grab;
  touch-action: none; /* Prevent a touch drag from becoming page scrolling. */
  user-select: none;
  -webkit-user-select: none;
}

.drag-handle.dragging {
  cursor: grabbing;
}
```

## Preserve pointer position and reachability

On `pointerdown`, record the pointer offset from the element's top-left corner. Use it on every move; positioning directly at the pointer makes the element jump when grabbed away from its corner.

Keep the drag active after the pointer leaves the handle. Either call `setPointerCapture()` on the handle or register `pointermove`, `pointerup`, and `pointercancel` listeners on `document`. With pointer capture, the movement listeners can remain on the handle:

```js
handle.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button, input, select, textarea, a')) return;

  const rect = draggable.getBoundingClientRect();
  offsetX = event.clientX - rect.left;
  offsetY = event.clientY - rect.top;
  handle.setPointerCapture(event.pointerId);
});

function moveTo(left, top) {
  const maxLeft = Math.max(0, window.innerWidth - draggable.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - draggable.offsetHeight);

  draggable.style.left = `${Math.max(0, Math.min(left, maxLeft))}px`;
  draggable.style.top = `${Math.max(0, Math.min(top, maxTop))}px`;
}
```

Clamp every pointer and keyboard position through the same helper so the element stays reachable. Re-clamp its current position after viewport or element-size changes.

## Provide keyboard movement

When the handle has focus, move the element with the arrow keys and call `preventDefault()` for those keys. Use the same clamped positioning helper as pointer movement. A 15px increment is a reasonable starting point; adapt it to the component's size and precision needs.

## Dialog-specific note

A `<dialog>` can use this mechanism with its header as the handle. Set `margin: 0` before assigning `left` and `top`, because the browser's default dialog centering margins interfere with manual positioning. For dialog opening, closing, focus, and dismissal behavior, see {{ GUIDE_REF("declarative-dialog-popover-control") }} and {{ GUIDE_REF("platform-controls-dismiss-dialog") }}.

## Decide on fallback behavior

Treat dragging as progressive enhancement when it only repositions a component: without JavaScript, keep the element, its content, and its controls visible, readable, and functional in a sensible default position.

When dragging is essential to the experience, such as moving a game piece, do not present a non-draggable fallback as equivalent behavior. Ensure the required pointer and keyboard interactions are available instead.

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("user-select") }}
