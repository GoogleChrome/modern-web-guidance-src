---
name: drag
description: Support dragging to move a floating element around the page.
web-feature-ids:
  - pointer-events-api
  - touch-action
  - user-select
---

# Build a Draggable Element

Add dragging to an existing floating element such as a panel, palette, toolbar, inspector, or dialog. Dragging does not determine how the element is displayed, dismissed, stacked, or focused.

## Use a dedicated handle

Start dragging from a dedicated handle when the element contains selectable text, buttons, inputs, or links. This keeps its normal contents usable. Make the handle focusable for keyboard movement and give it an accessible name that mentions the arrow-key interaction.

Do not apply `role="application"` to the handle. It unnecessarily changes assistive-technology interaction.

Apply `cursor: grab`/`grabbing`, `touch-action: none`, and both `user-select: none` and `-webkit-user-select: none` to the handle—not the entire draggable element—so text outside it remains selectable and touch gestures retain their usual behaviour:

```css
.drag-handle {
  cursor: grab;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

.drag-handle.dragging {
  cursor: grabbing;
}
```

## Preserve pointer position and reachability

Use a viewport-relative positioning model such as `position: fixed` when clamping movement to the viewport.

- Start a drag only for the primary pointer button (`event.button === 0`).
- Record the pointer offset on `pointerdown` and use it on every move so the element does not jump when grabbed away from its corner.
- Keep the drag active after the pointer leaves the handle, preferably with `setPointerCapture()`; document-level `pointermove`, `pointerup`, and `pointercancel` listeners are an alternative. Consider waiting for roughly 4px of movement before entering the dragging state, so a click on the handle does not trigger drag styling. Remove that state on `lostpointercapture`, which covers both pointer release and cancellation.

With pointer capture, the movement listeners can remain on the handle:

```js
handle.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('button, input, select, textarea, a')) return;

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

Clamp every pointer and keyboard position through the same helper so the element stays reachable. Re-clamp its current position after viewport or element-size changes. For layout-heavy elements, consider translating during the drag to avoid per-frame layout, then commit the final position to `left` and `top` on release.

## Provide keyboard movement

When the handle has focus, move the element with the arrow keys and call `preventDefault()` for those keys. Use the same clamped positioning helper as pointer movement. A 15px increment is a reasonable starting point; adapt it to the component's size and precision needs.

## Dialog-specific note

A `<dialog>` or `[popover]` can use this mechanism with its header as the handle. Set `margin: 0` before assigning `left` and `top`, because the browser's default margins interfere with manual positioning. For dialog and popover opening, closing, focus, and dismissal behaviour, see {{ GUIDE_REF("declarative-dialog-popover-control") }} and {{ GUIDE_REF("platform-controls-dismiss-dialog") }}.

## Fallback strategies

When dragging only repositions a component, treat it as progressive enhancement: without JavaScript, keep the element, its content, and its controls visible, readable, and functional in a sensible default position. Do not show a drag handle that cannot provide dragging; hide it by default and reveal it when JavaScript initialises the behaviour.

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("user-select") }}
