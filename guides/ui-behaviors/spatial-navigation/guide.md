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

This guide covers building performant, accessible 2D directional navigation inside composite widgets.

---

### Core Architectural Principles

When implementing custom arrow-key spatial focus, adhere to these foundational rules:

1. **Limit to composite widgets**: Do not override arrow keys on normal document text flow or simple vertical list layouts where default sequential Tab navigation is expected. See {{ GUIDE_REF("accessibility") }} for general document flow guidance.
2. **Preserve native boundary scrolling**: If there is no focusable element in the pressed direction, **do not prevent default browser behavior**. Let the event bubble so the browser can scroll the viewport natively. Overriding arrow keys unconditionally breaks accessibility (WCAG 1.4.10).
3. **Ensure focus visibility and alignment**: When focus changes, ensure the newly focused element is scrolled into view (e.g., using `scrollIntoView({ block: 'nearest', inline: 'nearest' })`) so that it remains fully visible.
4. **Coordinate with the layout system**: Determine focus candidate positions using live bounding geometries (`getBoundingClientRect()`). **DO**: Keep spatial calculations highly performant by storing the bounding client rects in a globally scoped cache rather than querying them on-demand inside the selection loop. Invalidate this cache on events that change layout positions, such as window `resize` and `scroll`, or via a `ResizeObserver` on the parent layout container. See {{ GUIDE_REF("css-layout") }} for modern layout recommendations.

---

### Accessible Focus Management

The spatial container must expose a single tab stop to sequential Page Tab navigation. Inside the widget, manage keyboard focus using the **Roving Tabindex Pattern**:
* The active item has `tabindex="0"`.
* All inactive items have `tabindex="-1"`.
* When navigating, programmatically move focus by shifting the `tabindex="0"` attribute and calling `focus()`.

---

### Visual Candidate Selection

In asymmetrical, wrapped, or grid layouts, index-based mapping fails. Instead, query live visual bounding boxes and calculate 2D distance.

To find the best target in a direction (`up`, `down`, `left`, `right`), filter candidates by their center coordinates, then rank them by combining **projection distance** (distance along the navigation axis) and **orthogonal distance** (distance along the perpendicular axis), applying a penalty weight ($w \ge 2$) on the orthogonal axis to favor on-axis movement.

```javascript
// Global cache for candidate bounding client rects to prevent layout thrashing
let rectCache = null;
let invalidationFrameId = null;

function getRectCache(currentEl, candidates) {
  if (!rectCache) {
    rectCache = new Map();
    rectCache.set(currentEl, currentEl.getBoundingClientRect());
    for (const cand of candidates) {
      rectCache.set(cand, cand.getBoundingClientRect());
    }
  }
  return rectCache;
}

function invalidateRectCache() {
  rectCache = null;
}

function queueCacheInvalidation() {
  if (invalidationFrameId) {
    cancelAnimationFrame(invalidationFrameId);
  }
  invalidationFrameId = requestAnimationFrame(invalidateRectCache);
}

// Invalidate cache on window resize/scroll, debounced to once per frame
window.addEventListener('resize', queueCacheInvalidation, { passive: true });
window.addEventListener('scroll', queueCacheInvalidation, { passive: true });

// Invalidate cache when container layout shifts
const container = document.querySelector('.spatial-container');
if (container && typeof ResizeObserver !== 'undefined') {
  const observer = new ResizeObserver(() => queueCacheInvalidation());
  observer.observe(container);
}

// Visual 2D Distance Heuristic Algorithm
function getBestCandidate(currentEl, direction, candidates) {
  const rects = getRectCache(currentEl, candidates);
  const currentRect = rects.get(currentEl);
  const currentCenter = {
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2
  };

  let best = null;
  let minDistance = Infinity;
  const weight = 2.5; // Penalty weight on the perpendicular axis

  for (const candidate of candidates) {
    if (candidate === currentEl) continue;

    const candidateRect = rects.get(candidate);
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

### Keypress Integration & Scroll Cooperation

Your event router must prevent standard viewport scrolling **only** when a valid spatial focus transition occurs.

```javascript
document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  if (!active || !candidates.includes(active)) return;

  let direction = null;
  if (e.key === 'ArrowRight') direction = 'right';
  if (e.key === 'ArrowLeft') direction = 'left';
  if (e.key === 'ArrowDown') direction = 'down';
  if (e.key === 'ArrowUp') direction = 'up';

  if (!direction) return;

  const nextEl = getBestCandidate(active, direction, candidates);

  if (nextEl) {
    e.preventDefault(); // Intercept arrow navigation and handle programmatically
    shiftFocus(active, nextEl); // Update roving tabindex and focus
    nextEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // If nextEl is null, event bubbles naturally allowing the browser to scroll
});
```

---

### Customizable Settings & WCAG Compliance

Provide settings to disable arrow-key hijacking entirely or disable single-character keyboard shortcuts to satisfy WCAG:

* **Opt-out Switch**: Allow users to toggle custom arrow key navigation off.
* **Character-key Shortcuts**: Disable custom keys like `h`/`j`/`k`/`l` or `W`/`A`/`S`/`D` by default, or require modifier keys (e.g. `Alt`, `Ctrl`) to satisfy WCAG 2.1.4 (Character Key Shortcuts).
