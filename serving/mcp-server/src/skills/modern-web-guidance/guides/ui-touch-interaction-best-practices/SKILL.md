---
description: Enhancing user interaction by making web apps responsive to touch input through state changes and custom gestures.
filename: touch-interaction-best-practices
category: ui
---

# Touch Interaction Best Practices

This document outlines best practices for implementing touch interactions in web applications, ensuring a responsive and intuitive user experience.

## Best Practices

### 1. Respond to Element States

Provide visual feedback to users when they interact with elements by styling pseudo-classes like `:hover`, `:focus`, and `:active`. This reassures users that their input is registered and contributes to a snappy feel.

**Key Considerations:**

*   **Visual Feedback:** Simply changing an element's color on touch or interaction can significantly improve the perceived responsiveness of your site.
*   **Pseudo-classes:** Utilize `:hover`, `:focus`, and `:active` CSS pseudo-classes to style elements based on user interaction.
*   **Suppressing Default Styles:** Be mindful of and selectively suppress default browser styles (like outlines or tap highlight colors) that might interfere with your custom feedback. Ensure you have replacement styles in place.
    *   For `:focus`, use `outline: 0;` and consider adding a replacement focus style (e.g., a border).
    *   For Webkit browsers (Chrome, Safari), use `-webkit-tap-highlight-color: transparent;` to remove the tap highlight.
    *   For Internet Explorer on Windows Phone, use the `<meta name="msapplication-tap-highlight" content="no">` tag.
    *   For Firefox, use `border: 0;` for `::-moz-focus-inner` and `background-image: none;` for buttons.
*   **Caution:** Only suppress default styles if you provide your own custom styles for `:hover`, `:active`, and `:focus`.

```css
/* Example: Styling button states */
.btn {
  background-color: #4285f4;
  -webkit-tap-highlight-color: transparent; /* For Webkit browsers */
}

.btn:hover {
  background-color: #296cdb;
}

.btn:focus {
  background-color: #0f52c1;
  outline: 0; /* Suppress default outline */
}

.btn:active {
  background-color: #0039a8;
}

/* Firefox specific */
.btn {
  background-image: none;
}
.btn::-moz-focus-inner {
  border: 0;
}
```

### 2. Implement Custom Gestures Efficiently

When creating custom gesture interactions, prioritize cross-browser compatibility and high frame rates.

**Key Considerations:**

*   **Event Handling Strategy:**
    *   For modern browsers (Chrome 55+, IE & Edge), use `PointerEvents` (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`). This unifies mouse, touch, and pen input.
    *   For other browsers, use a combination of `TouchEvents` (`touchstart`, `touchmove`, `touchend`, `touchcancel`) and `MouseEvents` (`mousedown`, `mousemove`, `mouseup`).
*   **Single vs. Multi-element Interaction:** Decide if your gesture should affect a single element or multiple elements.
    *   **Single Element:** If a gesture starts on an element, allow it to continue even if the touch moves off the element. This often involves adding event listeners to the `document` for `mousemove` and `mouseup` (for mouse events) or using `setPointerCapture()` (for PointerEvents).
    *   **Multiple Elements:** If users need to interact with multiple elements simultaneously (multi-touch), restrict touch events to specific elements.
*   **Performance Optimization:**
    *   Minimize work within event callbacks that fire on the main thread.
    *   Use `requestAnimationFrame()` to schedule UI updates just before the browser paints a frame. This helps maintain a high frame rate and prevents jank. Store touch coordinates and update the UI within the `requestAnimationFrame` callback.
*   **`touch-action` CSS Property:** Utilize `touch-action` to control default browser touch behaviors.
    *   `touch-action: none;`: Prevents all default browser touch behaviors, giving your JavaScript full control. Use this when you need to intercept all touch events.
    *   Other values like `manipulation`, `pinch-zoom`, `pan-y`, `pan-x` allow for more granular control, disabling specific gestures while leaving others to the browser.

```javascript
// Example: Handling Pointer Events and Touch Events
if (window.PointerEvent) {
  // Add Pointer Event Listeners
  element.addEventListener('pointerdown', handleGestureStart, true);
  element.addEventListener('pointermove', handleGestureMove, true);
  element.addEventListener('pointerup', handleGestureEnd, true);
  element.addEventListener('pointercancel', handleGestureEnd, true);
} else {
  // Add Touch Listeners
  element.addEventListener('touchstart', handleGestureStart, true);
  element.addEventListener('touchmove', handleGestureMove, true);
  element.addEventListener('touchend', handleGestureEnd, true);
  element.addEventListener('touchcancel', handleGestureEnd, true);

  // Add Mouse Listener
  element.addEventListener('mousedown', handleGestureStart, true);
}

function handleGestureMove(evt) {
  evt.preventDefault();
  // ... logic to get touch position ...
  if (rafPending) return;
  rafPending = true;
  window.requestAnimFrame(onAnimFrame); // Assuming requestAnimFrame is available
}

function onAnimFrame() {
  // ... update UI based on touch position ...
  rafPending = false;
}
```

```css
/* Example: Disabling all touch actions */
.custom-touch-logic {
  touch-action: none;
}
```

### 3. Handle Edge Cases and Older Browsers

*   **Disabling User Select:** Use `user-select: none;` sparingly to prevent text selection on elements where it might interfere with intended interactions. Be cautious, as this can be frustrating for users who *do* want to select text.
*   **Supporting Older IE:** For IE10, handle vendor-prefixed Pointer Events (`MSPointerDown`, `MSPointerUp`, `MSPointerMove`) by checking `window.navigator.msPointerEnabled`.
*   **iOS Active State:** On iOS devices, the `:active` state might not be triggered reliably. Add a `touchstart` event listener to `document.body` or specific elements to ensure the active state is applied. This should be done behind a user agent test.

```javascript
// Example: Ensuring active state on iOS
window.onload = function() {
  if (/iP(hone|ad)/.test(window.navigator.userAgent)) {
    document.body.addEventListener('touchstart', function() {}, false);
  }
};