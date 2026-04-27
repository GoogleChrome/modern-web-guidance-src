# PR Review Takeaways: Navigation Drawer (#601)

This document summarizes the core technical and architectural preferences extracted from senior reviewer feedback on the Navigation Drawer implementation.

## 🔑 Core Takeaways

### 1. Accessibility & Focus Management
*   **Takeaway:** Modal-like components (drawers, dialogs, overlays) must handle programmatic focus correctly.
*   **Context:** Rick Viscomi (`rviscomi`) noted that the "Keyboard focus is moved inside the drawer after it opens" expectation requires the container to be focusable.
*   **Constraint:** Use `tabindex="-1"` on the drawer's root container (`.Drawer-sheet`) to allow it to receive focus via JavaScript without being part of the natural tab order.

### 2. Reduced Motion Support
*   **Takeaway:** Always respect user motion preferences in interactive transitions.
*   **Context:** Motion-heavy features (like sliding drawers) can cause distress or disorientation for some users.
*   **Constraint:** Implement a "smooth-scroll escape hatch". If `prefers-reduced-motion: reduce` is detected, fall back to instant positioning or simplified transitions.

### 3. Performance Optimization
*   **Takeaway:** Optimize scroll-linked animations and event handling.
*   **Context:** The drawer uses a scroll listener to map scroll position to backdrop opacity.
*   **Constraint:** Use **passive scroll listeners** (`{ passive: true }`) for any event listener that doesn't need to cancel the scroll event. This prevents main-thread blocking and ensures high-performance scrolling.

---

## 🛠 Implementation Examples

### Accessible Container
```html
<nav class="Drawer-sheet" tabindex="-1">
  <!-- Content -->
</nav>
```

### Passive Scroll Listener
```javascript
scroller.addEventListener('scroll', () => {
  // Update UI based on scroll
  const ratio = 1 - scroller.scrollLeft / sheet.offsetWidth;
  drawer.style.setProperty('--drawer-backdrop', ratio);
}, { passive: true });
```

### Reduced Motion Escape Hatch (CSS)
```css
@media (prefers-reduced-motion: reduce) {
  .Drawer-sheet {
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
```

---
*Generated based on review comments by @rviscomi in PR #601.*
TAG=agy
CONV=7b9e6415-9ea2-4888-ad53-f79337768606
