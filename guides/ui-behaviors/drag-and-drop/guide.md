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
  - icons
---

# Rearrange Items with Drag and Drop

Add reordering to an existing list, grid, or other collection. Reorder the real children in the DOM so visual, keyboard, and reading order stay aligned. For why CSS `order` is not a substitute for reordering interactive content, see {{ GUIDE_REF("css-layout") }}.

For choosing a drag handle, preserving the pointer offset, and applying handle-scoped `touch-action` and `user-select`, see {{ GUIDE_REF("drag") }}.

## Keep movement active while reordering

A drag implementation that moves the dragged item in the DOM can lose pointer capture when the item is removed and reinserted. Register `pointermove`, `pointerup`, and `pointercancel` on `document` for the active drag, and remove them when it ends.

Determine the destination from the pointer's position over the remaining items. Move the actual item when its destination changes rather than recreating it. To preserve item state (such as focused controls, scroll position, media, or custom element instances), use `moveBefore()` to move elements atomically; see {{ GUIDE_REF("move-dom-element-without-losing-state") }} for feature detection and fallback.

```js
function reorderAtPointer(event, container, draggedItem) {
  // Find the list item currently under the pointer coordinates
  const target = document.elementFromPoint(event.clientX, event.clientY)
    ?.closest('[data-reorder-item]');
  if (!target || target.parentElement !== container || target === draggedItem) return;

  const rect = target.getBoundingClientRect();
  const before = event.clientY < rect.top + rect.height / 2
    ? target
    : target.nextElementSibling;

  if (before !== draggedItem && before !== draggedItem.nextElementSibling) {
    if (typeof container.moveBefore === 'function') {
      container.moveBefore(draggedItem, before);
    } else {
      container.insertBefore(draggedItem, before);
    }
  }
}
```

## Support keyboard reordering

Avoid using a "grab-and-drag" keyboard mode (e.g., Space to grab, arrows to move). Screen readers like NVDA and JAWS operate in **Browse Mode** by default, using the arrow keys to navigate text. Because a standard `<button>` does not trigger automatic mode switching into Forms Mode, arrow key presses are intercepted by the screen reader and never reach the page.

Instead, provide explicit, standard movement controls for each item. This completely avoids virtual cursor traps. To keep the UI clean, declare vector icons as CSS custom variables and use the **CSS-driven icon engine** to style your handles and controls; see {{ GUIDE_REF("icons") }}.

### Align reading order with visual layout
Structure your DOM row naturally so the focusable context (the label or input) precedes the action controls. Visually place your drag handle on the left, but mark it with `aria-hidden="true"` so keyboard and screen-reader users completely bypass it:

```html
<li class="task" data-label="Outline project">
  <!-- 1. Drag handle is visually on the left, but ignored by keyboard/screen reader users -->
  <div class="drag-handle icon" aria-hidden="true" style="--icon: var(--icon-grip);"></div>
  
  <!-- 2. Screen readers read context first; focus starts here -->
  <label>Outline project <input value="Write the first draft"></label>
  
  <!-- 3. Action controls are next in focus sequence -->
  <div class="task-controls">
    <button class="move-up-button" type="button" aria-label="Move Outline project up" title="Move up">
      <span class="icon" style="--icon: var(--icon-chevron-up);" aria-hidden="true"></span>
    </button>
    <button class="move-down-button" type="button" aria-label="Move Outline project down" title="Move down">
      <span class="icon" style="--icon: var(--icon-chevron-down);" aria-hidden="true"></span>
    </button>
  </div>
</li>
```

For complex layouts where visual and DOM order cannot naturally align, use the experimental **`reading-flow`** CSS property inside grid/flex containers to instruct the browser's tab-order to follow visual coordinates rather than DOM source code:
```css
.task {
  display: grid;
  grid-template-columns: auto 1fr auto;
  reading-flow: grid-visual; /* Syncs visual layout and tab flow */
}
```

### Disable boundaries and safeguard focus
Disable the "Move up" button on the first item and the "Move down" button on the last item. 

When an item moves and causes a focused button to become disabled, the browser resets focus to the `body`. To prevent focus loss, programmatically shift focus to the sibling movement button of the moved item:

```js
function moveKeyboardItem(item, direction) {
  const container = item.parentElement;
  const sibling = direction === 'up' ? item.previousElementSibling : item.nextElementSibling;
  if (!sibling) return;

  const activeBtn = document.activeElement;
  
  // Reorder DOM node
  container.moveBefore(item, direction === 'up' ? sibling : sibling.nextElementSibling);
  updateDisabledStates(container);

  // If the clicked button is now disabled at the boundary, shift focus to save it
  if (activeBtn?.disabled) {
    const fallbackBtn = direction === 'up' 
      ? item.querySelector('.move-down-button') 
      : item.querySelector('.move-up-button');
    fallbackBtn?.focus();
  } else {
    activeBtn?.focus();
  }

  announce(`${item.dataset.label} moved ${direction}.`);
}
```

## Decide on fallback behavior

When reordering is supplementary, keep the collection readable and usable in its default DOM order without JavaScript. When reordering is essential to the experience, provide the required pointer and keyboard interactions instead of presenting the static order as equivalent behavior.

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("move-before") }}

{{ FEATURE_FALLBACKS("pointer-events-api") }}

{{ FEATURE_FALLBACKS("user-select") }}

{{ FEATURE_FALLBACKS("reading-flow") }}
