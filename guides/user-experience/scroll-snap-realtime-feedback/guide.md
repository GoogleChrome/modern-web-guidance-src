---
name: scroll-snap-realtime-feedback
description: Provide real-time visual feedback in linked UI elements while a user scrolls through snap-aligned content, before the scroll gesture completes.
web-feature-ids:
  - scroll-snap-events
  - scroll-snap
sources:
  - https://developer.chrome.com/blog/scroll-snap-events
  - https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollsnapchanging_event
  - https://developer.mozilla.org/en-US/docs/Web/API/SnapEvent
---

## Overview
Users expect immediate visual feedback when interacting with UI elements like carousels or galleries. Traditional scroll snap only provides feedback *after* the scroll gesture completes and the element settles. By using Scroll Snap Events, specifically `scrollsnapchanging`, you can provide real-time feedback during the scroll gesture, highlighting the pending snap target before the user releases their touch or mouse.

## Implementation

### 1. Listen for `scrollsnapchanging`
Attach an event listener for `scrollsnapchanging` to the scroll container. This event fires when the browser determines a new snap target is likely to be selected.

```javascript
const container = document.querySelector('#gallery');
const thumbnails = document.querySelectorAll('.thumbnail');
const items = document.querySelectorAll('.gallery-item');

container.addEventListener('scrollsnapchanging', (event) => {
  // Highlight pending snap target during scroll for real-time feedback.
  const pendingTarget = event.snapTargetInline;
  const index = [...items].indexOf(pendingTarget);

  // Use lightweight class toggle to avoid layout thrashing during rapid events.
  thumbnails.forEach((thumb) => thumb.classList.remove('pending'));
  thumbnails[index].classList.add('pending');
});
```

> [!NOTE]
> This example uses `snapTargetInline` because the gallery scrolls horizontally. If your scroll container scrolls vertically, use `snapTargetBlock` instead.

### 2. Listen for `scrollsnapchange`
To finalize the state when the scroll gesture completes and the element actually snaps, listen for the `scrollsnapchange` event. This is required to establish the final active state.

```javascript
container.addEventListener('scrollsnapchange', (event) => {
  // Promote pending state to active on scroll completion.
  const snappedTarget = event.snapTargetInline;
  const index = [...items].indexOf(snappedTarget);

  // Establish final active state and clean up pending.
  thumbnails.forEach((thumb) => {
    thumb.classList.remove('pending', 'active');
  });
  thumbnails[index].classList.add('active');
});
```

### Fallback strategies
{{ BASELINE_STATUS("scroll-snap-events") }}

For browsers that do not support `scrollsnapchanging`, the UI will not provide eager feedback during the scroll gesture. The experience degrades gracefully to standard scroll snap behavior.

If real-time feedback is critical, you can use a feature detection check and fallback to standard `scroll` events with intersection observers or complex position calculations, though these are more expensive and less precise.

```javascript
if ('onscrollsnapchanging' in Element.prototype) {
  // Use scroll snap events
} else {
  // Fallback to standard scroll listeners or progressive enhancement
}
```
