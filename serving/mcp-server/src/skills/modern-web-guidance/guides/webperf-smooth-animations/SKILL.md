---
description: Optimize web animations for smooth user experiences by leveraging V-sync, requestAnimationFrame, and CSS animations.
filename: smooth-animations
category: webperf
---

# Jank busting for better rendering performance

## Best Practices

To achieve smooth, "native"-feeling UI animations and transitions, developers should prioritize rendering performance optimization. This involves understanding and addressing "jank," which are noticeable hitches or pauses in animation.

### Timing is Everything: `requestAnimationFrame`

Instead of using `setInterval` or `setTimeout` for animations, leverage [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame). This API synchronizes your animation callbacks with the browser's screen refresh rate, ensuring frames are ready precisely when the display refreshes.

- **Benefits of `requestAnimationFrame`:**
    - **V-sync:** Ensures new frames are generated only between screen refreshes, preventing screen tearing and dropped frames.
    - **Resource Conservation:** Animations in background tabs are automatically paused, saving system resources and battery life.
    - **Adaptive Throttling:** If the system struggles to render at the screen's refresh rate, `requestAnimationFrame` can throttle animations to maintain consistency, which is visually smoother than inconsistent frame rates.

### Frame Budget

Be mindful of the "frame budget" – the time the browser has to produce a new frame. On a 60Hz display, this is approximately 16ms. Ensure that the JavaScript execution within your `requestAnimationFrame` callback, along with layout and painting, completes within this budget.

- **Tools for Optimization:** Chrome's Developer Tools (specifically the Timeline view) can help identify if your callbacks are exceeding the frame budget. Look for long execution times within `requestAnimationFrame` callbacks, often caused by excessive layout recalculations or DOM manipulations.

### Avoiding Other Sources of Jank

Even lean `requestAnimationFrame` callbacks can be interrupted by other browser activities, such as processing XHR requests, input event handlers, or timer-scheduled updates. These interruptions can cause significant animation delays, especially on mobile devices.

- **Architectural Best Practices:**
    - **Minimize Input Handler Work:** Avoid performing extensive JavaScript processing or large-scale DOM rearrangements within input event handlers (e.g., `onscroll`).
    - **Offload Heavy Processing:** Push time-consuming operations into `requestAnimationFrame` callbacks or use [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API).
    - **Chunk Work:** If processing heavy tasks within `requestAnimationFrame`, chunk the work into smaller pieces that can be processed over multiple frames to avoid blocking the main thread for too long.

### CSS Animations

For animations that don't require complex JavaScript logic, consider using [CSS Animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations/Using_CSS_animations). In browsers like Chrome for Android, CSS animations can often run independently of JavaScript execution, allowing them to remain smooth even when the main thread is busy. This simplifies your code and improves performance.

```css
#my-element {
  animation-duration: 3s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-name: rotate;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

## Wrap Up

1.  **V-sync is Crucial:** Prioritize producing frames in sync with screen refreshes for a fluid user experience.
2.  **Choose the Right Tool:** Use CSS animations for simpler, declarative animations. For more complex or dynamic animations, `requestAnimationFrame` is the preferred JavaScript approach.
3.  **Maintain Healthy Callbacks:** Ensure other event handlers don't interfere with `requestAnimationFrame` callbacks and keep these callbacks concise (ideally under 15ms).

These principles extend beyond simple UI animations to Canvas2D, WebGL, and even scrolling performance.