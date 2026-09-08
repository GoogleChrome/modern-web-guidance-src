---
name: drag
description: Support dragging to move a certain overlay element (e.g. a dialog) around the page.
web-feature-ids:
  - user-select
---

# Implementing Draggable Overlay Elements (Dialogs, Panels, Widgets)

## Purpose
This guide helps you implement a highly interactive "drag to move" behavior for overlay elements (dialogs, modals, floating panels, widgets) positioned freely on a page. It covers required techniques, common accessibility pitfalls, and fallback support.

## Core Concept
There is no native browser API for freely repositioning an element by dragging it around the viewport. The HTML Drag and Drop API (`draggable="true"`) is designed for drag-and-drop data transfer (such as reordering lists or uploading files), not continuous visual x/y repositioning. You must implement repositioning manually using Pointer, Mouse, or Touch events.

---

## Basic Implementation

### 1. HTML Markup Structure
Keep your markup semantic and clean. Designate a header inside the overlay element to behave as the drag handle:

```html
<div class="dialog" id="dialog">
  <!-- The header bar acts as the drag handle -->
  <div class="dialog-header" id="dialogHeader">Drag me</div>
  <div class="dialog-body">
    <p>Dialog content.</p>
    <!-- Explicitly selectable section -->
    <div class="selectable">This text remains copyable.</div>
  </div>
</div>
```

### 2. Styles (CSS)
Apply `user-select: none` only to the drag handle, and use `touch-action: none` to prevent touch-screen scrolling gestures from interfering with the drag:

```css
.dialog {
  position: absolute;
  /* Prevent touch gestures like scrolling from competing with the drag */
  touch-action: none; 
}

.dialog-header {
  cursor: grab;
  /* REQUIRED: prevents text-highlighting artifacts during a drag gesture */
  user-select: none;
  -webkit-user-select: none; /* Legacy support */
  -ms-user-select: none;     /* Legacy support */
}

.dialog-header.dragging {
  cursor: grabbing;
}

.selectable {
  /* Enforces text selection inside the content body */
  user-select: text;
  -webkit-user-select: text;
}
```

### 3. Repositioning Script (JS / Pointer Events)
Using standard **Pointer Events** (`pointerdown`, `pointermove`, `pointerup`) is the preferred approach because they automatically unify mouse, touch, and stylus actions into a single event model.

```javascript
const dialog = document.getElementById('dialog');
const header = document.getElementById('dialogHeader');
let isDragging = false, offsetX = 0, offsetY = 0;

// Track coordinate offsets to prevent the dialog from "jumping" on grab
header.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return; // ignore close buttons
  e.preventDefault();
  
  isDragging = true;
  header.classList.add('dragging');
  
  const rect = dialog.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;
});

// Bind move and up to the document so dragging continues even if the cursor leaves the handle
document.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  
  let left = e.clientX - offsetX;
  let top = e.clientY - offsetY;
  
  // Bounds checking: constrain dialog coordinates within the viewport limits
  const maxLeft = window.innerWidth - dialog.offsetWidth;
  const maxTop = window.innerHeight - dialog.offsetHeight;
  
  left = Math.max(0, Math.min(left, maxLeft));
  top = Math.max(0, Math.min(top, maxTop));
  
  dialog.style.left = `${left}px`;
  dialog.style.top = `${top}px`;
});

document.addEventListener('pointerup', () => {
  isDragging = false;
  header.classList.remove('dragging');
});
```

---

## Strategic Implementation & Best Practices

*   **DO use `user-select: none` strictly on the drag handle**, not the entire dialog. Ensure users can highlight and copy content inside the dialog body.
*   **DO calculate cursor coordinate offsets.** Capturing the delta between pointer coordinates and the dialog's top-left corner on grab prevents the dialog from "jumping" or snapping.
*   **DO attach move and release events to the `document`**, not the drag handle. Fast cursor movements can temporarily outrun the handle, resulting in a frozen drag if listeners are bound only to the header.
*   **DO perform bounds-checking.** Always constrain positioning using `Math.max` and `Math.min` against the window dimensions so users cannot drag dialogs off-screen.
*   **DO utilize Pointer Events** to support mouse, touch, and pen actions natively under a single model, and declare `touch-action: none` to stop scrolling conflicts on touch devices.
*   **DO reset positions on close/open cycles** to ensure the modal starts in a predictable viewport coordinate.

---

## Fallbacks & Native Alternatives

*   **Opening/closing & Stacking**: Use native `<dialog>` with the `popover` attribute to leverage top-layer promoting and light dismissal natively without any manual `z-index` management or backdrop scripting:
    ```html
    <dialog id="myDialog" popover>
      <p>Content</p>
      <button popovertarget="myDialog" popovertargetaction="hide">Close</button>
    </dialog>
    <button popovertarget="myDialog" popovertargetaction="show">Open</button>
    ```
*   **Progressive Enhancement**: Treat dragging as a progressive layout enhancement. If JavaScript is disabled or unavailable, ensure the dialog remains fully visible, readable, and closable on the page.
*   **Accessibility (A11y)**: Drag interactions are inherently pointer-centric. Ensure the drag handle carries descriptive text or appropriate `aria-label` tags. For keyboard accessibility, support alternative repositioning methods (such as keyboard arrow key mappings) or keep positions static for keyboard-only users.

## Feature Reference
- CSS property: `user-select` (web-feature id: `user-select`)
- Browser support: Universally supported across all modern browsers. For browsers that require legacy engine compatibility, utilize vendor prefixes (`-webkit-`, `-ms-`).
