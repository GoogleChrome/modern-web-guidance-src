---
name: scroll-snap-state-sync
description: Synchronize navigation indicators, linked content panels, and analytics tracking with the actively snapped item in a scrollable container.
web-feature-ids:
  - scroll-snap-events
  - scroll-snap
sources:
  - https://developer.chrome.com/blog/scroll-snap-events
  - https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollsnapchange_event
  - https://developer.mozilla.org/en-US/docs/Web/API/SnapEvent
  - https://blog.logrocket.com/javascript-scroll-snap-events-scroll-triggered-animations/
---

Synchronizing UI state with a scrollable container's snap position traditionally required complex scroll event listeners, manual calculations of scroll offsets, and intersection observers. The `scrollsnapchange` event provides a native, efficient way to detect when a scroller has settled on a new snap target.

## Implementation

Important: this guide is NOT a guide for implementing a carousel.

### 1. Configure Scroll Snap in CSS
The container must have `scroll-snap-type` defined, and its children must have `scroll-snap-align` for the browser to track snap targets.

```css
.carousel {
  display: flex;
  overflow-x: auto;
  /* MANDATORY: Enable scroll snapping */
  scroll-snap-type: x mandatory;
}

.slide {
  flex: 0 0 100%;
  /* MANDATORY: Define how children align when snapped */
  scroll-snap-align: center;
}
```

### 2. Listen for Snap Changes
Use the `scrollsnapchange` event on the scroll container to react when the user finishes scrolling and the browser snaps to a new element.

```javascript
const carousel = document.getElementById('carousel');

// The event fires when the scroller settles on a new snap target
carousel.addEventListener('scrollsnapchange', (event) => {
  // Use snapTargetInline for horizontal or snapTargetBlock for vertical
  const snappedElement = event.snapTargetInline;
  
  // Update your UI and accessibility state, trigger side effects like analytics.
  setActiveSlide(snappedElement);
});
```

### 3. Eager Feedback (Optional)
If you need to update the UI *while* the user is still scrolling (e.g., highlighting a pending slide), use the `scrollsnapchanging` event. This event fires as soon as the browser determines a new "intended" snap target, even if the scroll hasn't finished.

```javascript
carousel.addEventListener('scrollsnapchanging', (event) => {
  const pendingElement = event.snapTargetInline;

  setPendingSlide(pendingElement);
});
```

## Accessibility

Caution: While Scroll Snap Events make it possible to visually synchronize other content to the state of the scroller, it does not automatically expose that information programmatically. Relationships between elements, active states, and live content must be reflected in the Accessibility Tree. This will be use case specific, and you must test your specific implementation. 

## Fallback strategies

{{ BASELINE_STATUS("scroll-snap-events") }}

If `scrollsnapchange` is not supported, use `IntersectionObserver` to detect which element is currently centered in the scroller. Note this is different behavior than `scrollsnapchange`, as this will trigger while the scroll happens, rather than when scroll has settled.

```javascript
// Feature detect support for scroll snap events
if (!('onscrollsnapchange' in HTMLElement.prototype)) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      // Use a high threshold to ensure the element is actually the snap target
      if (entry.isIntersecting) {
        setActiveSlide(entry.target);
      }
    });
  }, { 
    root: carousel, 
    threshold: 0.9 // Adjust based on your snap alignment
  });

  // Observe all snap targets
  document.querySelectorAll('.slide').forEach(slide => observer.observe(slide));
}
```
