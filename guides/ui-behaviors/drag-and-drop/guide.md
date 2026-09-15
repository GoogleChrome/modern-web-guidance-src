---
name: drag-and-drop
description: Support dragging to rearrange an element's children while preserving their state and accessible order.
web-feature-ids:
  - move-before
  - pointer-events-api
  - user-select
guides:
  - drag
  - move-dom-element-without-losing-state
---

# Rearrange Items with Drag and Drop

Add reordering to an existing list, grid, or other collection. Reorder the real children in the DOM so visual, keyboard, and reading order stay aligned. For why CSS `order` is not a substitute for reordering interactive content, see {{ GUIDE_REF("css-layout") }}.

For choosing a drag handle, preserving the pointer offset, and applying handle-scoped `touch-action` and `user-select`, see {{ GUIDE_REF("drag") }}.

## Keep movement active while reordering

A drag implementation that moves the dragged item in the DOM can lose pointer capture when the item is removed and reinserted. Register `pointermove`, `pointerup`, and `pointercancel` on `document` for the active drag, and remove them when it ends. Call `preventDefault()` on the handle's `pointerdown` to prevent browser text selection and native HTML drag behavior from competing with the custom interaction.

Determine the destination from the pointer's position over the remaining items. Move the actual item when its destination changes, rather than recreating it. For a direct-manipulation pointer interaction, show a lightweight visual preview while dimming the original item in the collection. The preview must have `pointer-events: none` so it does not obscure potential destinations.

```js
function createDragPreview(item) {
  const rect = item.getBoundingClientRect();
  const preview = item.cloneNode(true);
  preview.classList.add('drag-preview');
  preview.inert = true; // A visual copy must not become keyboard-focusable.
  preview.style.width = `${rect.width}px`;
  preview.style.left = `${rect.left}px`;
  preview.style.top = `${rect.top}px`;
  document.body.append(preview);
  return preview;
}
```

Position the preview from the same pointer offset used for dragging, and remove it when the drag ends or is cancelled.

The following fragment moves a real child before the point where the pointer enters another item's upper or lower half. It assumes `draggedItem` is set by the handle's `pointerdown` listener and that each reorderable child has `data-reorder-item`:

```js
function moveItem(item, before) {
  // moveBefore() preserves item state; insertBefore() is its fallback.
  if (typeof container.moveBefore === 'function') {
    container.moveBefore(item, before);
  } else {
    container.insertBefore(item, before);
  }
}

function reorderAtPointer(event) {
  const target = document.elementFromPoint(event.clientX, event.clientY)
    ?.closest('[data-reorder-item]');
  if (!target || target.parentElement !== container || target === draggedItem) return;

  const rect = target.getBoundingClientRect();
  const before = event.clientY < rect.top + rect.height / 2
    ? target
    : target.nextElementSibling;

  if (before !== draggedItem && before !== draggedItem.nextElementSibling) {
    moveItem(draggedItem, before);
  }
}
```

## Preserve item state

When reordered items contain focused controls, media, iframes, animations, or custom elements, use `moveBefore()` to move them atomically. It preserves the item's state while changing its position. Feature-detect it and fall back to `insertBefore()` when necessary; see {{ GUIDE_REF("move-dom-element-without-losing-state") }} for the API and fallback.

## Support keyboard reordering

Use an actual `<button>` for each reorder handle rather than adding button semantics to a non-button element. Give the handle an accessible name that identifies the item and explains the keyboard interaction.

Use `Space` or `Enter` to enter and leave reordering mode, arrow keys to move the grabbed item, and `Escape` to cancel and restore its original position. Keep focus on the item's handle after each DOM move. Expose the grabbed state with `aria-pressed` and announce grab, move, drop, and cancel outcomes in a live region so screen-reader users know the item's current position.

For a vertical collection, move the grabbed item relative to its adjacent sibling, then restore focus because the DOM move can otherwise interrupt the keyboard interaction:

```js
function moveKeyboardItem(item, direction) {
  const sibling = direction === 'up'
    ? item.previousElementSibling
    : item.nextElementSibling;
  if (!sibling) return;

  moveItem(item, direction === 'up' ? sibling : sibling.nextElementSibling);
  item.querySelector('.reorder-button').focus();
  announce(`${item.dataset.label} is now position ${getPosition(item)}.`);
}
```

Snapshot the original child sequence when keyboard reordering starts. On `Escape`, move each item from that snapshot back into the container's original order before clearing `aria-pressed` and the grabbed state.

## Decide on fallback behavior

When reordering is supplementary, keep the collection readable and usable in its default DOM order without JavaScript. When reordering is essential to the experience, provide the required pointer and keyboard interactions instead of presenting the static order as equivalent behavior.

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("move-before") }}

{{ FEATURE_FALLBACKS("pointer-events-api") }}

{{ FEATURE_FALLBACKS("user-select") }}
