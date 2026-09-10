---
name: drag-and-drop
description: Support dragging to rearrange the order of an element’s children in a way that works across different CSS layouts (grid etc).
web-feature-ids:
  - pointerevents
---

# Rearrange Grid and List Layouts with Pointer Events

Rearranging elements dynamically within a list, grid, or flexbox container is a fundamental requirement for interactive interfaces like dashboard widgets, kanban boards, and image galleries. Creating a reordering system that is completely **layout-agnostic** (working natively on columns, inline-blocks, flex rows, or complex grids) can be achieved reliably across all browsers using Pointer Events and a lightweight **Ghost Clone**.

By dragging a temporary "ghost clone" on top of the layout while keeping the actual element hidden inside the container, you completely decouple spatial mouse-tracking from the DOM reflow of the other elements. This bypasses WebKit sub-pixel rounding drift and prevents visual jumping, resulting in a robust, butter-smooth 60fps interaction on all desktop and mobile browsers.

---

## How to implement

To build a layout-agnostic draggable rearrangement system:
1. **Unify Input with Pointer Events**: Exclusively use Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) to unify mouse, touch, and stylus actions under a single API model.
2. **Bind Move Listeners to the Document**: On `pointerdown` of the drag handle, store starting offsets and attach `pointermove` and `pointerup` event listeners directly to the **`document`**. This is critical: if you use native Pointer Capture (`setPointerCapture`) on an element and then dynamically mutate its position inside the DOM tree (which is required to reorder items), both Chrome and Safari **instantly and automatically abort the pointer capture**, terminating your movement tracking loop. Document-bound listeners are 100% immune to this abort.
3. **Prevent WebKit Drag Interruptions**: Call `e.preventDefault()` inside the `pointerdown` listener. This blocks the browser from starting its default text-selection or native HTML5 drag-ghosting cycles, which would otherwise abort the pointer tracking loop on WebKit.
4. **Deploy a Visual Ghost Clone**: During `pointerdown`, create a copy of the card using `card.cloneNode(true)`. Style it with `position: fixed` to align its visual coordinates directly with the viewport mouse, and add it to `document.body` so it follows the pointer.
5. **Hide the Original Card**: Apply a class to the original card (e.g., `opacity: 0.3`) inside the container. This preserves its layout footprint so the other items do not collapse.
6. **Detect Boundary Collisions**: During `pointermove`, check which sibling card the cursor coordinates (`e.clientX`, `e.clientY`) are **physically hovering inside** (using bounding box limits). This boundary collision check is incredibly stable and prevents rapid layout "thrashing" or flickering that occurs with simple distance checks.
7. **Rearrange in the DOM Tree**: If the cursor is physically hovering over a sibling card, swap the actual card around it in the DOM using `parent.insertBefore()`. The remaining elements in the container will reflow smoothly around the swap, regardless of the active layout stylesheet (Grid, Flexbox, flow, etc.).
8. **Restore the Regular Flow**: On pointer release, remove the document event listeners, delete the visual ghost from the body, and restore the actual card's visibility. It naturally remains positioned in its new DOM layout location.

---

## Example code

The following code implements a completely layout-agnostic, WebKit-stable drag reordering engine that works flawlessly on Grid, Flexbox, or flow lists.

### HTML Structure
```html
<div class="reorder-container" id="reorderContainer">
  <div class="card" id="card1">
    <!-- Only grabbing the handle initiates dragging -->
    <div class="card-handle" aria-label="Drag handle">:::</div>
    <div class="card-content">Item 1</div>
  </div>
  <div class="card" id="card2">
    <div class="card-handle" aria-label="Drag handle">:::</div>
    <div class="card-content">Item 2</div>
  </div>
  <!-- Additional cards ... -->
</div>
```

### CSS Style Rules
```css
.reorder-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.card {
  /* REQUIRED: Suppresses touch-scrolling/gestures during drags on mobile devices */
  touch-action: none; 
}

.card-handle {
  cursor: grab;
  /* REQUIRED: Shuts off mouse-selection highlight artifacting on handle clicks */
  user-select: none;
  -webkit-user-select: none; /* iOS Safari fallback */
}

/* Original card is dimmed inside the layout stream */
.card.dragging-hide {
  opacity: 0.3;
}

/* Floating clone tracking the cursor directly */
.card.ghost-clone {
  position: fixed; /* REQUIRED: Align visual coords directly to viewport mouse */
  pointer-events: none; /* REQUIRED: let pointer events pass through to find siblings underneath */
  z-index: 1000;
  opacity: 0.85;
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.15);
}
```

### JavaScript Layout-Agnostic Engine
```javascript
const container = document.getElementById('reorderContainer');

let draggedElement = null;
let ghost = null;
let offsetX = 0, offsetY = 0;

container.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('.card-handle');
  if (!handle) return; // Ignore drag starts outside the designated handle
  
  const card = handle.closest('.card');
  if (!card) return;

  // Prevent WebKit/Safari default text selection or native image drag ghosting
  e.preventDefault();

  draggedElement = card;
  
  const rect = card.getBoundingClientRect();
  
  // Track client offset relative to the card's top-left corner
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;

  // 1. Create the visual ghost clone and append to body
  ghost = card.cloneNode(true);
  ghost.className = 'card ghost-clone';
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  
  document.body.appendChild(ghost);

  // 2. Hide the actual card from view but keep its layout footprint
  card.classList.add('dragging-hide');

  // 3. Bind movement and release directly to document to bypass DOM-mutation capture aborts
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
});

function onPointerMove(e) {
  if (!draggedElement || !ghost) return;

  // Move the visual ghost directly relative to pointer coordinates
  ghost.style.left = `${e.clientX - offsetX}px`;
  ghost.style.top = `${e.clientY - offsetY}px`;

  // Find all sibling elements inside the container
  const siblings = [...container.children].filter(child => child !== draggedElement);
  
  // Find which sibling the cursor is physically hovering inside (Boundary Detection)
  const closestSibling = siblings.find(sibling => {
    const box = sibling.getBoundingClientRect();
    return e.clientX >= box.left && e.clientX <= box.right &&
           e.clientY >= box.top && e.clientY <= box.bottom;
  });

  // Swap the actual card in the DOM if we are hovering over an active sibling (No thrashes/flicker)
  if (closestSibling && closestSibling !== draggedElement) {
    const children = [...container.children];
    const draggedIndex = children.indexOf(draggedElement);
    const targetIndex = children.indexOf(closestSibling);

    if (draggedIndex < targetIndex) {
      container.insertBefore(draggedElement, closestSibling.nextSibling);
    } else {
      container.insertBefore(draggedElement, closestSibling);
    }
  }
}

// Clean up drag layout classes and restore regular flow
function onPointerUp() {
  if (!draggedElement) return;
  
  // Remove document listeners
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', onPointerUp);

  // Remove the visual ghost clone
  if (ghost) {
    ghost.remove();
    ghost = null;
  }

  // Restore the original card back to regular flow
  draggedElement.classList.remove('dragging-hide');
  draggedElement = null;
}
```

---

## Known Issues & Shortcomings

* **Pointer Capture DOM-Mutation Aborts**: A major shortcoming of standard `setPointerCapture` inside rearrangeable containers is that **mutating an element's position in the DOM (via `insertBefore`) instantly and silently aborts any active pointer capture on that element in Chrome and Safari**. This triggers a `lostpointercapture` cycle and freezes further dragging.
  * *Circumvention*: Bypass element-level capture completely. Instead, attach the `pointermove` and `pointerup` event listeners dynamically to the **`document`** on `pointerdown` and remove them on `pointerup`. Document-bound event streams are completely immune to DOM-mutation capture aborts.
* **WebKit Selection / Drag Interruptions**: WebKit (Safari) aggressively starts its own native selection highlight or HTML5 drag-ghosting cycles during drags. This cancels any Pointer Event flow.
  * *Circumvention*: Always call **`e.preventDefault()` inside the `pointerdown` listener** on your handles to suppress WebKit's default text/image drag routines.
* **Layout Thrashing & Flickering**: Dragging-distance calculations based on simple proximity can trigger rapid DOM node swaps back and forth when the pointer sits directly near a shared boundary, resulting in extreme layout flickering.
  * *Circumvention*: Use physical boundary collision checks (`e.clientX >= box.left ...`) instead. This requires the cursor to physically cross into the sibling card's layout boundary before initiating a swap, which moves the sibling card away from the cursor and prevents rapid thrashed feedback loops.

---

## Best Practices

* **DO** bind active movement (`pointermove`) and release (`pointerup`/`pointercancel`) event listeners directly to the **`document`** during the active drag cycle. This prevents standard Chrome and Safari DOM-mutation pointer capture aborts and keeps dragging completely continuous.
* **DO** clone a lightweight ghost with `pointer-events: none` to follow the mouse while dimming the original card inside the container. This eliminates complex layout-displacement calculations and prevents sub-pixel WebKit rounding jitter.
* **DO** check physical boundary entry to identify swaps. Ensuring the pointer has actually crossed inside the sibling card's rectangle ensures maximum reordering stability and completely eliminates flickering and thrashing.
* **DO** apply `touch-action: none` in CSS on the draggable items. This ensures mobile touch scrolls and browser gestures do not fight or interrupt active drag sequences.
* **DO** declare `user-select: none` strictly on the drag handle. This prevents annoying browser text-highlighting artifacts on handle click-drags, leaving list text copyable.
* **DO** treat drag reordering as a progressive layout enhancement. If JavaScript is disabled or fails to load, ensure all container children remain fully visible, readable, and positioned in their default markup flow order.
* **OPTIONAL** apply active style classes to visual ghosts to provide styled grab state feedback to users.

---

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("pointerevents") }}

If JavaScript is disabled or unsupported, ensure that children elements degrade gracefully. Children should still be fully readable and rendered in their standard semantic order, keeping document visibility intact.
