---
name: diagonal-panning
description: Allow users to freely pan or scroll two-dimensional surfaces—such as maps, zoomed images, infinite canvases, or large data grids—in any diagonal direction without the gesture locking to a single horizontal or vertical axis.
web-feature-ids:
  - tmp-scroll-axis-lock
---

# Diagonal Panning

When a user scrolls a two-dimensional scroll container, browsers typically apply a scroll axis-locking heuristic (also known as "railing"). If a gesture begins with significantly more movement along one axis than the perpendicular axis, the browser locks the scroll to a single horizontal or vertical axis and ignores perpendicular deltas—often for the remainder of the gesture.

While axis-locking prevents accidental sideways drift in one-dimensional reading flows, it creates friction on two-dimensional panning surfaces such as interactive maps, zoomed images, infinite canvases, node graphs, and large data grids. The CSS `scroll-axis-lock` property disables this heuristic directly on a native scroll container, allowing immediate diagonal panning while preserving compositor-thread scrolling, momentum physics, native scrollbars, and keyboard navigation.

## Implementation

### 1. Disable axis-locking on the 2D scroll container

Apply `scroll-axis-lock: none` directly to the element that establishes the two-dimensional scroll container (`overflow: auto` or `overflow: scroll`).

### Property Values

- `auto`: The browser may lock the scroll gesture to a single axis when it determines the gesture is predominantly one-dimensional. This is the default (`initial`) value.
- `none`: Disables scroll axis-locking. The scroll container applies scroll deltas on both axes simultaneously from the start of the gesture across touchscreens, trackpads, and mouse wheels.

### 2. Preserve keyboard focusability and accessibility

Because a 2D panning surface often lacks focusable child controls (for example, a map or zoomed image), ensure keyboard users can focus the container and pan it with the Arrow keys by adding `tabindex="0"`, an appropriate `role` and accessible label, and a visible `:focus-visible` indicator.

## Example Code

```html
<!-- Make the 2D scroll container keyboard-focusable and labeled so keyboard
     users can focus the viewport and pan in all directions with Arrow keys. -->
<div class="pan-viewport" tabindex="0" role="region" aria-label="Interactive canvas">
  <div class="pan-surface">
    <!-- 2D overflowing content (map tiles, zoomed image, canvas nodes, or grid) -->
  </div>
</div>
```

```css
.pan-viewport {
  /* Example viewport dimensions; adjust to fit your layout. */
  inline-size: 100%;
  block-size: 500px;

  /* MANDATORY: Establish a scroll container that can overflow on both axes. */
  overflow: auto;

  /* MANDATORY: Disable browser scroll axis-locking ("railing") so gestures
     immediately pan diagonally in response to both X and Y scroll deltas. */
  scroll-axis-lock: none;
}

/* Provide a clear focus indicator when keyboard users focus the viewport. */
.pan-viewport:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}

.pan-surface {
  /* Example surface dimensions larger than .pan-viewport in both axes. */
  inline-size: 3000px;
  block-size: 3000px;
}
```

## Best Practices & Constraints

- **MANDATORY**: Apply `scroll-axis-lock: none` directly to the scroll container element itself, never to an ancestor wrapper. `scroll-axis-lock` is **not inherited**, so setting it on a wrapper has no effect on descendant scroll containers.
- **DO**: Take advantage of non-inheritance when nesting UI panels inside a 2D canvas. Because `scroll-axis-lock` does not inherit, any one-dimensional scroll containers nested inside `.pan-viewport` (such as a sidebar or inspector panel) automatically retain the default `scroll-axis-lock: auto` behavior.
- **DO**: Keep `scroll-axis-lock: auto` on standard vertical feeds, articles, and one-dimensional lists. Axis-locking is an accessibility feature for unidirectional content that prevents unintentional perpendicular drift.
- **DO NOT**: Set `touch-action: none` unconditionally when `scroll-axis-lock: none` is supported. `touch-action` controls whether the browser handles touch gestures at all (and has no effect on trackpad or wheel input); setting `touch-action: none` disables native compositor touch scrolling. Only apply `touch-action: none` inside an `@supports not (scroll-axis-lock: none)` block when implementing a JavaScript pointer fallback.
- **DO NOT**: Replace native scrolling (`scrollLeft` and `scrollTop`) with CSS `transform` translations (`translate3d(...)`), even in a JavaScript fallback. Using `transform` stops the element from functioning as a scroll container—breaking native scrollbars, automatic boundary clamping, keyboard Arrow-key scrolling, `scroll` events, `IntersectionObserver`, and scroll-driven animations.

## Fallback strategies

Choose between **progressive enhancement** and a **JavaScript fallback** based on your application's requirements:

### Option 1: Progressive Enhancement (No JavaScript)

Use progressive enhancement when preserving native compositor-thread touch scrolling, inertial fling momentum, and pinch-to-zoom is more important than eliminating initial axis-locking in unsupported browsers:

- **Supporting browsers**: The browser disables scroll axis-locking on the scroll container, allowing immediate diagonal panning from the start of any touch or trackpad gesture.
- **Unsupported browsers**: Browsers that do not recognize `scroll-axis-lock: none` safely ignore the declaration and keep their standard native 2D scrolling behavior. Users can still scroll and pan across both axes natively.

### Option 2: JavaScript Fallback (`wheel` + `pointermove` with `scrollLeft`/`scrollTop`)

If immediate, unrestricted diagonal panning across all browsers is required, use `@supports not (scroll-axis-lock: none)` and `CSS.supports('scroll-axis-lock', 'none')` to conditionally intercept `wheel` and pointer drag gestures.

Because `wheel` (`e.deltaX`, `e.deltaY`) and `pointermove` (`e.clientX`, `e.clientY`) expose raw, unlocked 2D deltas before the browser's scrolling engine applies axis-locking, you can apply those deltas directly to `scrollLeft` and `scrollTop`:

- **Why `scrollLeft`/`scrollTop` instead of CSS `transform`**: Updating `scrollLeft` and `scrollTop` keeps the element as a true scroll container. The browser automatically clamps scroll positions to `[0, scrollWidth - clientWidth]` and `[0, scrollHeight - clientHeight]`, native scrollbars stay synchronized, keyboard Arrow-key scrolling continues to work, and `scroll` events and `IntersectionObserver` fire normally.
- **Trade-offs**: Intercepting `wheel` with `{ passive: false }` moves scrolling onto the main thread, and setting `touch-action: none` on touchscreens disables native inertial fling momentum after `pointerup` (as well as native pinch-to-zoom).

```css
/* Only disable native touch scrolling when scroll-axis-lock is unsupported
   and the JavaScript pointer fallback below is active. */
@supports not (scroll-axis-lock: none) {
  .pan-viewport {
    touch-action: none;
  }
}
```

```javascript
// Only attach the main-thread gesture fallback when native support is missing
if (!CSS.supports('scroll-axis-lock', 'none')) {
  const viewport = document.querySelector('.pan-viewport');
  let lastPointer = null;

  // 1. Trackpad and mouse wheel fallback
  viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      viewport.scrollLeft += e.deltaX;
      viewport.scrollTop += e.deltaY;
    },
    { passive: false },
  );

  // 2. Touch and pointer drag fallback
  viewport.addEventListener('pointerdown', (e) => {
    // Ignore non-primary buttons and clicks on native scrollbars
    if (
      !e.isPrimary ||
      e.button !== 0 ||
      e.offsetX >= viewport.clientWidth ||
      e.offsetY >= viewport.clientHeight
    ) {
      return;
    }
    lastPointer = { x: e.clientX, y: e.clientY };
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!lastPointer) return;
    viewport.scrollLeft -= e.clientX - lastPointer.x;
    viewport.scrollTop -= e.clientY - lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };
  });

  const endPointerPan = () => {
    lastPointer = null;
  };
  viewport.addEventListener('pointerup', endPointerPan);
  viewport.addEventListener('pointercancel', endPointerPan);
}
```
