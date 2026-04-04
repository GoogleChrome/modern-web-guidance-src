---
name: light-dismiss-content-overlay
description: Create swipeable layered navigation menus using native overlays and scroll gestures.
web-feature-ids:
  - popover
  - scroll-snap
  - inert
sources:
  - https://web.dev/blog/popover-api
  - https://codepen.io/una/pen/ZYOeQaR
  - https://github.com/WICG/inert
---

# Creating Swipeable Layered Navigation

Modern mobile navigation requires a "swipe to close" gesture. While the native `popover` API handles Top Layer promotion and accessibility well, it doesn't natively support swipe gestures.

We can achieve the best of both worlds by combining `popover="manual"` with a CSS Scroll Snap container, and inerting the page with JavaScript.

### Core Concept

1. **The Popover:** Acts as the top-layer container. Use `popover="manual"` to fully control its visibility and lifecycle. While `popover="auto"` provides native light dismissal, it actively conflicts with this scroll-snap gesture pattern (native backdrop clicks fail due to the element's 100vw bounding box, and native `Escape` dismissal instantly hides the menu abruptly without animation).
2. **The Scroll Container:** Inside the popover, we create a horizontally scrolling container with `scroll-snap-type: x mandatory`.
3. **The Drawer & Ghost:** 
   - The **Drawer** is the first snap point (visible when scrolled to 0).
   - A **Ghost Element** (spacer) is the second snap point (visible when scrolled to the menu width).
4. **The Backdrop:** Use the native `::backdrop` pseudo-element for the dimmed background. By linking its opacity to the scroll position using CSS custom properties via a `scroll` event listener, the fade feels fully organic with the swipe gesture.
5. **Gesture Logic:** "Swiping left" naturally scrolls the container from the Drawer (0) to the Ghost (Width). This feels like pushing the menu away.

### Implementation Guidelines

* Use `popover="manual"` to ensure the menu appears above all other content (Top Layer), avoiding the strict native dismiss logic of `auto`.
* Rely on CSS Scroll Snap for gesture physics. It provides a native, smooth 1:1 touch response.
* Use the `scrollend` event (or a scroll polling fallback) to synchronize the JavaScript state (open/closed) with the physical scroll position.
* Tie the `::backdrop` opacity directly to the scroll position via CSS custom properties. It maps exactly 1-to-1 without artificial delays.
* **MANDATORY**: Manually manage the `inert` attribute on your main content. When the menu is open, the main content MUST be inert. When closed (scrolled away), it must be interactive.
* Manually handle backdrop clicks and the `Escape` key. Because we use `popover="manual"`, you must provide the logic to trigger the smooth scroll-out animation when the user intentionally dismisses the menu outside of swiping.

### Recommended Implementation

Here is a minimal example showing how to combine Popover and Scroll Snap for swipeable overlays.

**HTML Structure:**
```html
<!-- MANDATORY: Use popover="manual" to control lifecycle and avoid conflicts with gestures -->
<div id="swipe-overlay" popover="manual">
  <!-- The actual menu/drawer -->
  <nav class="drawer" id="side-nav">
    <!-- Menu items go here -->
    <button class="close-btn">Close</button>
  </nav>
  <!-- A ghost spacer is needed as the second snap point. You can use a real element or a pseudo-element like ::after -->
</div>
```

**Key CSS:**
```css
#swipe-overlay {
  border: none;
  padding: 0;
  margin: 0;
  width: 100vw;
  height: 100vh;
  background: transparent;
  
  /* Enable horizontal scroll snap */
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  overscroll-behavior-x: contain;
  scroll-behavior: smooth;
}

#swipe-overlay:popover-open {
  display: flex;
}

.drawer {
  width: 280px; /* Or any width less than 100vw */
  height: 100%;
  flex-shrink: 0;
  scroll-snap-align: start; /* Snap point 1 (Open) */
}

/* Ghost Spacer using pseudo-element */
#swipe-overlay::after {
  content: '';
  flex: 0 0 100vw;
  height: 100%;
  scroll-snap-align: start; /* Snap point 2 (Closed) */
}

/* Link backdrop opacity to a CSS variable */
#swipe-overlay::backdrop {
  background-color: rgba(0, 0, 0, var(--backdrop-alpha, 0));
}
```

**Key JavaScript:**
```javascript
const overlay = document.getElementById('swipe-overlay');
const nav = document.getElementById('side-nav');
const main = document.getElementById('main-content');
let isAnimating = false;

function openMenu() {
  overlay.showPopover();
  // Snap to ghost spacer initially to animate in
  overlay.scrollTo({ left: nav.offsetWidth, behavior: 'instant' });
  main.setAttribute('inert', '');
  isAnimating = true;
  
  // Force layout and animate to drawer open position
  requestAnimationFrame(() => {
    overlay.scrollTo({ left: 0, behavior: 'smooth' });
    setTimeout(() => isAnimating = false, 500);
  });
}

function closeMenu() {
  // Animate to ghost spacer, triggering scrollend to hide popover
  overlay.scrollTo({ left: nav.offsetWidth, behavior: 'smooth' });
}

// Live Backdrop Update (Immediate feedback during swipe)
overlay.addEventListener('scroll', () => {
  const width = nav.offsetWidth;
  // Calculate how far we have scrolled relative to the menu width
  const fraction = 1 - (overlay.scrollLeft / width);
  // Map this to a backdrop opacity (max 0.4 in this example)
  overlay.style.setProperty('--backdrop-alpha', Math.max(0, fraction * 0.4));
}, { passive: true }); // Passive listener for performance

// Handle gestures completing
overlay.addEventListener('scrollend', () => {
  if (isAnimating) return; // Prevent early closure during opening animation
  
  const width = nav.offsetWidth;
  // If we scrolled past half the width, close the menu
  if (overlay.scrollLeft > (width / 2)) {
    if (overlay.matches(':popover-open')) {
      overlay.hidePopover();
    }
    main.removeAttribute('inert');
  } else {
    // Otherwise keep it open and ensure main content is inert
    main.setAttribute('inert', '');
  }
});
```

### Fallback strategies

#### popover

{{ BASELINE_STATUS("popover") }}

The Popover API is not supported in older browsers. Without it, the menu cannot be promoted to the Top Layer, which means it won't naturally sit above all other page content and won't receive the `::backdrop` pseudo-element.

* **Guidance:** For browsers that do not support `popover`, fall back to a `<div>` positioned with `position: fixed` and a high `z-index`. Manually manage focus trapping and the backdrop overlay using JavaScript. Replace any `::backdrop` styles with a separate fixed-position overlay element and toggle visibility using a class. Check support with `'popover' in HTMLElement.prototype`.

#### scroll-snap

{{ BASELINE_STATUS("scroll-snap") }}

CSS Scroll Snap is widely supported, but in environments where it is absent, the scroll container will still function — the drawer will open and close — but the snap-to-position physics will be missing, leaving the menu in an indeterminate in-between position after a swipe.

* **Guidance:** Listen for the `scrollend` event and programmatically snap the container to the nearest position (0 or the full drawer width) using `scrollTo({ left: targetX, behavior: 'smooth' })` if `scroll-snap-type` is not supported. Detect support with `CSS.supports('scroll-snap-type', 'x mandatory')`.

#### inert

{{ BASELINE_STATUS("inert") }}

The `inert` attribute is broadly supported in modern browsers. In browsers that do not support it, the main page content will remain interactive while the menu is open, creating a keyboard trap and accessibility issue.

* **Guidance:** Use the `inert` polyfill to replicate the behavior in unsupported browsers. Conditionally load it only when needed: `if (!('inert' in HTMLElement.prototype)) { await import('path/to/inert-polyfill.js'); }`. As a manual fallback, set `aria-hidden="true"` on the main content and apply `tabindex="-1"` to all focusable descendants while the menu is open, reversing both on close.
