---
name: create-layered-navigation-menus
description: Create swipeable layered navigation menus using the Popover API and Scroll Snap. This approach combines the Top Layer benefits of popovers with the gesture capabilities of scroll containers. The page is inert when the menu is open.
web-feature-ids:
- popover
- scroll-snap
- inert
sources:
- https://web.dev/blog/popover-api
- https://codepen.io/una/pen/ZYOeQaR
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

* **DO** use `popover="manual"` to ensure the menu appears above all other content (Top Layer), avoiding the strict native dismiss logic of `auto`.
* **DO** rely on CSS Scroll Snap for the gesture physics. It provides a native, smooth 1:1 touch response.
* **DO** use the `scrollend` event (or a scroll polling fallback) to synchronize the JavaScript state (open/closed) with the physical scroll position.
* **DO** tie the `::backdrop` opacity directly to the scroll position via CSS custom properties. It maps exactly 1-to-1 without artificial delays.
* **DO** manually manage the `inert` attribute on your main content. When the menu is open, the main content MUST be inert. When closed (scrolled away), it must be interactive.
* **DO** manually handle backdrop clicks and the `Escape` key. Because we use `popover="manual"`, you must provide the logic to trigger the smooth scroll-out animation when the user intentionally dismisses the menu outside of swiping.

### Fallback Strategies
#### popover

The Popover API is not supported in older browsers. Without it, the menu cannot be promoted to the Top Layer, which means it won't naturally sit above all other page content and won't receive the `::backdrop` pseudo-element.

* **Guidance:** For browsers that do not support `popover`, fall back to a `<div>` positioned with `position: fixed` and a high `z-index`. Manually manage focus trapping and the backdrop overlay using JavaScript. Replace any `::backdrop` styles with a separate fixed-position overlay element and toggle visibility using a class. Check support with `'popover' in HTMLElement.prototype`.

#### scroll-snap

CSS Scroll Snap is widely supported, but in environments where it is absent, the scroll container will still function — the drawer will open and close — but the snap-to-position physics will be missing, leaving the menu in an indeterminate in-between position after a swipe.

* **Guidance:** Listen for the `scrollend` event and programmatically snap the container to the nearest position (0 or the full drawer width) using `scrollTo({ left: targetX, behavior: 'smooth' })` if `scroll-snap-type` is not supported. Detect support with `CSS.supports('scroll-snap-type', 'x mandatory')`.

#### inert

The `inert` attribute is broadly supported in modern browsers. In browsers that do not support it, the main page content will remain interactive while the menu is open, creating a keyboard trap and accessibility issue.

* **Guidance:** Use the [`inert` polyfill](https://github.com/WICG/inert) to replicate the behavior in unsupported browsers. As a manual fallback, set `aria-hidden="true"` on the main content and apply `tabindex="-1"` to all focusable descendants while the menu is open, reversing both on close.
