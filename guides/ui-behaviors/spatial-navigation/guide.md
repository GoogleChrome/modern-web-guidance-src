---
name: spatial-navigation
description: Implement accessible spatial navigation using arrow keys that works correctly in different layout modes (grid etc)
web-feature-ids:
  - scroll-into-view
guides:
  - accessibility
  - css-layout
---

# Spatial Navigation (Directional Keypad Focus)

Directional focus navigation (using arrow keys or D-Pads) enables keyboard-only and alternative-input users to navigate interactive items based on their visual 2D layout. It is highly beneficial for spatial user interfaces (such as media rails, dashboard panels, or nested catalogs), but it must be implemented carefully to avoid breaking native browser behaviors like viewport scrolling.

This guide covers the core guidelines for building accessible, visual-based 2D directional navigation inside composite widgets.

---

### Core Architectural Principles

When implementing custom arrow-key spatial focus, adhere to these foundational rules:

1. **Limit to composite widgets**: Do not override arrow keys on normal document text flow or simple vertical list layouts where default sequential Tab navigation is expected. See {{ GUIDE_REF("accessibility") }} for general document flow guidance.
2. **Preserve native boundary scrolling**: If a user presses an arrow key but there is no focusable element in that direction, **do not prevent default browser behavior**. Allow the event to bubble naturally so the browser scrolls the page. Overriding arrow keys unconditionally breaks accessibility, especially under zoom/reflow constraints (WCAG 1.4.10).
3. **Ensure focus visibility and alignment**: When focus changes, ensure the newly focused element is scrolled into view (e.g., using `scrollIntoView` or a container scroll adjustment) so that it remains fully visible.
4. **Coordinate with the layout system**: Determine focus candidate positions using live bounding geometries (`getBoundingClientRect()`) to ensure that spatial calculations automatically adapt to responsive shifts, flex wrapping, or grid column adjustments. See {{ GUIDE_REF("css-layout") }} for modern layout recommendations.

---

### Accessible Focus Management

To prevent cluttering the browser's sequential tab order, the spatial container should expose a single tab stop to the page. Inside the widget, manage keyboard focus using one of two patterns:

#### Option A: The Roving Tabindex Pattern
* The active item has `tabindex="0"`.
* All inactive items have `tabindex="-1"`.
* When an arrow key is pressed, programmatic focus is moved by setting `tabindex="0"` on the target and `-1` on the previously active element.

#### Option B: The Active-Descendant Pattern
* The parent container remains the focused element (`tabindex="0"`).
* The parent manages state and points to the active child using `aria-activedescendant="[active-child-id]"`.
* The visual highlight is moved to the target child, and screen readers are notified of the change through the parent's attribute.

---

### Visual Candidate Selection

In asymmetrical or wrapped layouts (such as wrapped flex rows or grids with varying card sizes), simple index-based mapping (row/column indexing) fails. Instead, identify focus targets dynamically using visual bounding boxes.

#### The Visual Distance Heuristic
To find the best target in a direction (`up`, `down`, `left`, `right`), filter your candidates using their center coordinates, then rank them by combining their **projection distance** (distance along the navigation axis) and **orthogonal distance** (distance along the perpendicular axis):

$$\text{Distance} = d_{\text{projection}} + (w \times d_{\text{orthogonal}})$$

Applying a weight ($w \ge 2$) penalizes candidates that are misaligned with the current element's trajectory, ensuring the browser favors elements directly on-axis while allowing diagonal moves if no direct path exists.

```javascript
// Conceptual fragment for directional spatial navigation
function getBestCandidate(currentEl, direction, candidates) {
  const currentRect = currentEl.getBoundingClientRect();
  const currentCenter = {
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2
  };

  let best = null;
  let minDistance = Infinity;
  const weight = 2.5; // Favor on-axis targets over diagonal targets

  for (const candidate of candidates) {
    if (candidate === currentEl) continue;

    const candidateRect = candidate.getBoundingClientRect();
    const candidateCenter = {
      x: candidateRect.left + candidateRect.width / 2,
      y: candidateRect.top + candidateRect.height / 2
    };

    let isCorrectDirection = false;
    let projectionDistance = 0;
    let orthogonalDistance = 0;

    switch (direction) {
      case 'right':
        isCorrectDirection = candidateCenter.x > currentCenter.x;
        projectionDistance = candidateRect.left - currentRect.right;
        orthogonalDistance = Math.abs(candidateCenter.y - currentCenter.y);
        break;
      case 'left':
        isCorrectDirection = candidateCenter.x < currentCenter.x;
        projectionDistance = currentRect.left - candidateRect.right;
        orthogonalDistance = Math.abs(candidateCenter.y - currentCenter.y);
        break;
      case 'down':
        isCorrectDirection = candidateCenter.y > currentCenter.y;
        projectionDistance = candidateRect.top - currentRect.bottom;
        orthogonalDistance = Math.abs(candidateCenter.x - currentCenter.x);
        break;
      case 'up':
        isCorrectDirection = candidateCenter.y < currentCenter.y;
        projectionDistance = currentRect.top - candidateRect.bottom;
        orthogonalDistance = Math.abs(candidateCenter.x - currentCenter.x);
        break;
    }

    if (isCorrectDirection) {
      const distance = Math.max(0, projectionDistance) + (weight * orthogonalDistance);
      if (distance < minDistance) {
        minDistance = distance;
        best = candidate;
      }
    }
  }
  return best;
}
```

---

### Preserving Viewport Scroll & Reflow (WCAG 1.4.10)

To keep the page fully functional under responsive constraints and zoom, your spatial navigation handler must cooperate with native scrolling:

* **Keep focused items visible**: After shifting focus, ensure the new element is positioned in view.

```javascript
document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  if (!active || !candidates.includes(active)) return;

  const direction = getDirectionFromKey(e.key); // Maps Arrow keys to 'up' | 'down' | 'left' | 'right'
  if (!direction) return;

  const nextEl = getBestCandidate(active, direction, candidates);

  if (nextEl) {
    // Prevent standard arrow-scrolling only when a focus transition is actually occurring
    e.preventDefault();

    // Perform focus management update (e.g., roving tabindex or aria-activedescendant)
    shiftFocus(active, nextEl);

    // Ensure the focused element remains visible
    nextEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // If nextEl is null, no preventDefault() is called.
  // The event bubbles and the browser scrolls the page natively.
});
```

---

### User Controls & Shortcut Disabling (WCAG 2.1.4)

To prevent breaking accessibility for screen-readers and standard keyboard navigators, spatial navigation must be customizable:

* **Opt-out switch**: Provide a prominent UI switch (or persistent setting) that disables arrow-key hijacking entirely, letting the arrow keys scroll the viewport as normal.
* **Character-key safeguards**: If you support single-character hotkeys (like `h`/`j`/`k`/`l` or `W`/`A`/`S`/`D`) for power users, **you must provide an explicit setting to turn them off**, or require a modifier key (like Alt or Ctrl) to satisfy WCAG 2.1.4 (Character Key Shortcuts).

```javascript
let spatialNavEnabled = true;
let singleKeyShortcutsEnabled = false; // Off by default to respect WCAG 2.1.4

function handleKeyDown(e) {
  if (!spatialNavEnabled) return;

  let direction = null;
  if (e.key === 'ArrowRight') direction = 'right';
  if (e.key === 'ArrowLeft') direction = 'left';
  if (e.key === 'ArrowDown') direction = 'down';
  if (e.key === 'ArrowUp') direction = 'up';

  if (singleKeyShortcutsEnabled) {
    if (e.key === 'l') direction = 'right';
    if (e.key === 'h') direction = 'left';
    if (e.key === 'j') direction = 'down';
    if (e.key === 'k') direction = 'up';
  }

  if (direction) navigateSpatially(direction, e);
}
```

---

### Experimental Note: Native CSS Spatial Navigation

Native CSS Spatial Navigation is experimental for production use. Treat any native spatial-navigation properties or events as optional future enhancements and provide a tested custom behavior for current target browsers.
