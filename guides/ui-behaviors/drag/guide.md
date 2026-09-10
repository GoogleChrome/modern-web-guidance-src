---
name: drag
description: Support dragging to move a certain overlay element (e.g. a dialog) around the page.
web-feature-ids:
  - user-select
---

# Build a Draggable Dialog Element

Draggable overlay elements (such as native modals or floating dialogs) enhance user interaction by allowing content to be repositioned freely across the viewport. Using the native HTML `<dialog>` element gives you a robust, highly accessible starting point with native top-layer promotion and boundary confinement out of the box.

Dragging is particularly useful when users need to move an overlay out of the way to **reveal and interact with underlying page content** underneath.

## Stacking & Interaction Choice (Decision Tree)

Before implementing, choose the correct display API based on your interaction requirements:

```
                  ┌───────────────────────────────┐
                  │ Need to block background?     │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │ YES                           │ NO
                  ▼                               ▼
     ┌─────────────────────────┐     ┌─────────────────────────┐
     │ Modal (showModal())     │     │ Non-Modal (show())      │
     │ ─────────────────────── │     │ ─────────────────────── │
     │ • Has native ::backdrop │     │ • No backdrop           │
     │ • Focus is trapped      │     │ • Background stays active│
     │ • Native Escape close   │     │ • Manual Esc close needed│
     └─────────────────────────┘     └─────────────────────────┘
```

* **Modal (via `dialog.showModal()`)**: Best for focused tasks. The browser automatically traps focus and closes the dialog on `Escape` keypresses without any custom JavaScript.
* **Non-Modal (via `dialog.show()`)**: Best for floating utility panels. Keeps the underlying document fully editable while the user rearranges or drags the dialog. **Note**: Modeless dialogs do not natively close on `Escape`; a minor `keydown` listener must be added manually (see the Variation section below).

## How to implement (Standard Modal)

To implement a draggable modal element:
1. **Define the Dialog Element**: Use a native HTML `<dialog>` element opened with `showModal()`.
2. **Override Default Centering**: You **MUST** override the default browser centering style (`margin: auto`) with `margin: 0` in CSS so manual `style.left` and `style.top` coordinate changes are respected without layout conflicts.
3. **Designate a Keyboard-Focusable Handle**: Apply `user-select: none` to your header handle to prevent text-selection highlights. Add `tabindex="0"` to the handle and listen for arrow keys to nudge the dialog.
4. **Track Coordinated Offsets**: Store the offset delta between the cursor's coordinates and the dialog's top-left corner on grab start to prevent the dialog from "jumping" on click.
5. **Bind Listeners to the Document**: Attach `pointermove` and `pointerup` event listeners to the `document` rather than the drag handle itself. This keeps the drag continuous if the user moves their mouse rapidly.
6. **Enforce Viewport Boundaries**: Clamp coordinates during movement against the window bounds to keep the dialog fully on-screen.

## Standard Modal Code Implementation

This is the standard, 100% complete implementation of a draggable **Modal Dialog**.

### HTML Structure
```html
<dialog class="dialog" id="dialog">
  <!-- tabindex="0" makes the header keyboard-focusable for arrow-key repositioning -->
  <div class="dialog-header" id="dialogHeader" tabindex="0" role="application" aria-label="Dialog header. Use arrow keys to move.">
    <span>Draggable Dialog</span>
    <button id="closeBtn">✕</button>
  </div>
  <div class="dialog-body">
    <p>Drag my header, or focus it and use the arrow keys to move this dialog.</p>
  </div>
</dialog>

<button id="openBtn">Open Modal Dialog</button>
```

### CSS Style Rules
```css
dialog.dialog {
  position: fixed;
  /* REQUIRED: Overrides default 'margin: auto' so coordinate left/top are respected */
  margin: 0; 
  padding: 0;
  
  /* REQUIRED: Prevents touch-scrolling from competing with dragging on mobile */
  touch-action: none; 
  
  display: none;
  flex-direction: column;
}

dialog.dialog[open] {
  display: flex;
}

/* Modal Backdrop (Renders natively during showModal() states) */
dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px); /* Modern backdrop blur */
}

.dialog-header {
  cursor: grab;
  /* REQUIRED: Prevents text-selection highlighting during drags */
  user-select: none;
  -webkit-user-select: none; /* Safari prefix */
}

.dialog-header.dragging {
  cursor: grabbing;
}

/* Clear visual focus indicator for keyboard users */
.dialog-header:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -4px;
}
```

### JavaScript Pointer Event & Keyboard Engine
```javascript
const dialog = document.getElementById('dialog');
const header = document.getElementById('dialogHeader');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');

let isDragging = false, offsetX = 0, offsetY = 0;

openBtn.addEventListener('click', () => {
  dialog.showModal(); // Opens natively in top-layer with backdrop
  centerDialog();
});

closeBtn.addEventListener('click', () => {
  dialog.close();
  isDragging = false;
  header.classList.remove('dragging');
});

function centerDialog() {
  const x = (window.innerWidth - dialog.offsetWidth) / 2;
  const y = (window.innerHeight - dialog.offsetHeight) / 2;
  dialog.style.left = `${Math.max(0, x)}px`;
  dialog.style.top = `${Math.max(0, y)}px`;
}

// --------------------------------------------------
// DRAG POINTER COORDINATES ENGINE
// --------------------------------------------------
header.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, input, select')) return;
  e.preventDefault();
  
  isDragging = true;
  header.classList.add('dragging');
  
  const rect = dialog.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;
});

document.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  
  let left = e.clientX - offsetX;
  let top = e.clientY - offsetY;
  
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

// --------------------------------------------------
// ACCESSIBILITY EXTENSION (Keyboard Arrow Key Nudging)
// --------------------------------------------------
header.addEventListener('keydown', (e) => {
  const key = e.key;
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
  e.preventDefault();

  const rect = dialog.getBoundingClientRect();
  let left = rect.left;
  let top = rect.top;

  const nudgeAmount = 15; // Nudge by 15px per press

  if (key === 'ArrowLeft') left -= nudgeAmount;
  if (key === 'ArrowRight') left += nudgeAmount;
  if (key === 'ArrowUp') top -= nudgeAmount;
  if (key === 'ArrowDown') top += nudgeAmount;

  const maxLeft = window.innerWidth - dialog.offsetWidth;
  const maxTop = window.innerHeight - dialog.offsetHeight;

  left = Math.max(0, Math.min(left, maxLeft));
  top = Math.max(0, Math.min(top, maxTop));

  dialog.style.left = `${left}px`;
  dialog.style.top = `${top}px`;
});
```

## Modeless / Non-Modal Variation

If you want a **Modeless Dialog** (allowing users to interact with background text inputs or canvases while dragging the dialog aside), make the following **two adjustments** to the code above:

### Delta 1: Change JS Launcher method
Replace the `.showModal()` trigger with `.show()`. This launches the dialog without a blocking backdrop or focus trap.

```javascript
// Change this:
openBtn.addEventListener('click', () => {
  dialog.showModal();
  centerDialog();
});

// To this:
openBtn.addEventListener('click', () => {
  dialog.show(); // Launch modelessly (keeps background page fully active)
  centerDialog();
});
```

### Delta 2: Add Manual Escape Listener
Modeless dialogs do not natively close on the `Escape` key. Add this event listener to manually handle keyboard-dismissal:

```javascript
// Add this under the accessibility keydown listener block:
dialog.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dialog.open && !dialog.matches(':modal')) {
    e.preventDefault();
    dialog.close();
  }
});
```

## Best Practices

* **DO** apply `user-select: none` strictly to the drag handle. This prevents annoying text-selection/highlighting artifacts on the header during dragging.
* **DO** set `margin: 0` on draggable `<dialog>` elements. Failure to override the default browser `margin: auto` styling will cause manual left/top coordinate positioning to conflict with centering styles.
* **DO** enable complete keyboard accessibility for your drag mechanics. Make the drag handle focusable (`tabindex="0"`) and implement arrow key nudging so non-pointer users can move the dialog.
* **DO** ensure modeless overlays can be closed via keyboard. Add manual listeners to handle the `Escape` key on modeless (non-modal) dialogs, as browsers do not provide native Escape closing for modeless elements.
* **DO** calculate cursor offsets relative to the element's top-left corner on grab start. This prevents the element from snapping or jumping suddenly to align its top-left corner directly under the pointer.
* **DO** attach `pointermove` and `pointerup` event listeners to the `document` or `window`. This ensures the drag sequence remains continuous even if the user moves their mouse rapidly and temporarily slides off the drag handle.
* **DO** perform strict viewport bounds-checking. Clamping coordinates with `Math.max` and `Math.min` ensures elements cannot be accidentally dragged off-screen.
* **DO** declare `touch-action: none` on the draggable container. This tells the browser on mobile devices to suppress standard scrolling or pinch-to-zoom gestures that would otherwise compete with dragging.
* **DO** treat dragging as a progressive enhancement. If JavaScript is disabled or fails to load, ensure the element remains centered, visible, readable, and functional.
* **OPTIONAL** provide grab cursors (`cursor: grab` on rest, `cursor: grabbing` when dragging) to provide clear visual interaction affordances.

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("user-select") }}

If JavaScript is disabled or unsupported, ensure that the overlay element degrades gracefully. The element should still be rendered in a readable, centered position, allowing interactions like reading and dismissing content to work seamlessly.
